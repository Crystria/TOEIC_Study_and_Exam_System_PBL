import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { installExamNavigationGuard } from '../src/lib/exams/navigation-guard';

const examUrl = 'http://localhost/exam/server/take?attempt=attempt-1';

/** A browser history/event harness, including capture-before-bubble ordering. */
function browser() {
  type Listener = { callback: (event: any) => void; capture: boolean };
  const listeners = new Map<string, Listener[]>();
  const location = { href: examUrl };
  const initialState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['exam', 'take'] };
  const pushes: { state: any; url: string }[] = [];
  const history = {
    state: initialState as any,
    pushState(state: any, _title: string, url: string) {
      history.state = state;
      location.href = url;
      pushes.push({ state, url });
    },
  };
  const target = {
    location,
    history,
    addEventListener(type: string, callback: Listener['callback'], capture = false) {
      listeners.set(type, [...(listeners.get(type) ?? []), { callback, capture }]);
    },
    removeEventListener(type: string, callback: Listener['callback'], capture = false) {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter(
          (listener) => listener.callback !== callback || listener.capture !== capture,
        ),
      );
    },
  };
  function emit(type: string, values: Record<string, unknown> = {}) {
    const event = {
      defaultPrevented: false,
      stopped: false,
      button: 0,
      target: null,
      preventDefault() {
        event.defaultPrevented = true;
      },
      stopImmediatePropagation() {
        event.stopped = true;
      },
      ...values,
    };
    const ordered = [...(listeners.get(type) ?? [])].sort(
      (left, right) => Number(right.capture) - Number(left.capture),
    );
    for (const listener of ordered) {
      listener.callback(event);
      if (event.stopped) break;
    }
    return event;
  }
  function anchor(href: string, attributes: Record<string, string> = {}) {
    const attributesWithHref = { ...attributes, href };
    const node = {
      hasAttribute(name: string) {
        return Object.hasOwn(attributesWithHref, name);
      },
      getAttribute(name: string) {
        return (attributesWithHref as Record<string, string>)[name] ?? null;
      },
    };
    return { closest: () => node };
  }
  return {
    target: target as unknown as Window,
    location,
    history,
    initialState,
    pushes,
    emit,
    anchor,
    listenerCount: () => [...listeners.values()].reduce((total, list) => total + list.length, 0),
  };
}

test('Back and multi-entry jumps restore the exam before Next can navigate', () => {
  const b = browser();
  let blocked = 0;
  let routerNavigations = 0;
  b.target.addEventListener('popstate', () => routerNavigations++);
  const guard = installExamNavigationGuard(b.target, 'attempt-1', () => blocked++);
  assert.equal(b.pushes.length, 1);
  assert.equal(b.pushes[0].state.__NA, true);
  assert.deepEqual(
    b.pushes[0].state.__PRIVATE_NEXTJS_INTERNALS_TREE,
    b.initialState.__PRIVATE_NEXTJS_INTERNALS_TREE,
  );

  for (const url of [examUrl, 'http://localhost/history', 'http://localhost/dashboard']) {
    b.location.href = url;
    b.history.state = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['departed'] };
    const event = b.emit('popstate', { state: b.history.state });
    assert.equal(event.stopped, true);
    assert.equal(b.location.href, examUrl);
    assert.deepEqual(
      b.history.state.__PRIVATE_NEXTJS_INTERNALS_TREE,
      b.initialState.__PRIVATE_NEXTJS_INTERNALS_TREE,
    );
  }
  assert.equal(blocked, 3);
  assert.equal(routerNavigations, 0);

  b.emit('popstate', { state: b.history.state });
  assert.equal(blocked, 3);
  assert.equal(routerNavigations, 1);
  guard.dispose();
});

test('Only ordinary same-tab departures are blocked; question hashes and new tabs remain usable', () => {
  const b = browser();
  let blocked = 0;
  const guard = installExamNavigationGuard(b.target, 'attempt-1', () => blocked++);
  for (const href of ['/history', '/exam/server/take?attempt=other', 'https://example.com']) {
    const event = b.emit('click', { target: b.anchor(href) });
    assert.equal(event.defaultPrevented, true);
    assert.equal(event.stopped, true);
  }
  for (const values of [
    { target: b.anchor('#question-2') },
    { target: b.anchor(examUrl) },
    { target: b.anchor('/history', { target: '_blank' }) },
    { target: b.anchor('/history', { target: 'other-window' }) },
    { target: b.anchor('/history', { download: '' }) },
    { target: b.anchor('/history'), ctrlKey: true },
    { target: b.anchor('/history'), metaKey: true },
    { target: b.anchor('/history'), shiftKey: true },
    { target: b.anchor('/history'), button: 1 },
    { target: null },
  ]) {
    const event = b.emit('click', values);
    assert.equal(event.defaultPrevented, false);
    assert.equal(event.stopped, false);
  }
  assert.equal(blocked, 3);
  guard.dispose();
});

test('Unload warns while active; synchronous release permits confirmed submission navigation', () => {
  const b = browser();
  let blocked = 0;
  const guard = installExamNavigationGuard(b.target, 'attempt-1', () => blocked++);
  assert.equal(b.emit('beforeunload').defaultPrevented, true);
  guard.release();
  assert.equal(b.emit('beforeunload').defaultPrevented, false);
  assert.equal(b.emit('click', { target: b.anchor('/history') }).defaultPrevented, false);
  b.location.href = 'http://localhost/history';
  assert.equal(b.emit('popstate', { state: {} }).stopped, false);
  assert.equal(b.location.href, 'http://localhost/history');
  assert.equal(blocked, 0);
  guard.dispose();
});

test('Strict Mode reinstall adds no duplicate entry and disposal removes every listener', () => {
  const b = browser();
  const first = installExamNavigationGuard(b.target, 'attempt-1', () => {});
  assert.equal(b.listenerCount(), 3);
  first.dispose();
  assert.equal(b.listenerCount(), 0);
  const second = installExamNavigationGuard(b.target, 'attempt-1', () => {});
  assert.equal(b.pushes.length, 1);
  second.dispose();
  assert.equal(b.listenerCount(), 0);
  assert.equal(b.emit('beforeunload').defaultPrevented, false);
  b.location.href = 'http://localhost/history';
  b.emit('popstate', { state: {} });
  assert.equal(b.location.href, 'http://localhost/history');
});
