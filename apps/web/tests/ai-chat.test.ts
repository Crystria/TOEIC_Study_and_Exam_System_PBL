import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createDemoChatState, updateDemoChat } from '../src/lib/ai-chat/conversation';
import { sampleChatResponse } from '../src/lib/ai-chat/fixture';
import { createDemoChatRepository, DemoChatError } from '../src/lib/ai-chat/repository';
import { parseLessonMarkdown, safeMarkdownHref } from '../src/lib/learning/markdown';
import {
  CHAT_TIMEOUT_MS,
  chatCharacterCount,
  shouldSendChatKey,
  validateChatContent,
} from '../src/lib/ai-chat/validation';

test('AI input rejects whitespace and over-limit raw content; counts Unicode like Pydantic', () => {
  assert.ok(validateChatContent(' \n\t'));
  assert.equal(validateChatContent('a'.repeat(1000)), null);
  assert.ok(validateChatContent('a'.repeat(1001)));
  assert.equal(chatCharacterCount('😀'.repeat(1000)), 1000);
  assert.equal(validateChatContent('😀'.repeat(1000)), null);
  assert.ok(validateChatContent(' ' + 'a'.repeat(1000)));
  assert.equal(CHAT_TIMEOUT_MS, 10000);
});

test('Enter submits, Shift+Enter and composition/legacy IME Enter never submit', () => {
  const enter = { key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13 };
  assert.equal(shouldSendChatKey(enter), true);
  assert.equal(shouldSendChatKey({ ...enter, shiftKey: true }), false);
  assert.equal(shouldSendChatKey({ ...enter, isComposing: true }), false);
  assert.equal(shouldSendChatKey({ ...enter, keyCode: 229 }), false);
  assert.equal(shouldSendChatKey({ ...enter, key: 'a' }), false);
});

test('Pending turn blocks duplicate sends and stale completions; success counts once', () => {
  const pending = updateDemoChat(createDemoChatState(), {
    type: 'send',
    id: 'one',
    content: 'hello',
  });
  assert.equal(updateDemoChat(pending, { type: 'send', id: 'two', content: 'again' }), pending);
  assert.equal(
    updateDemoChat(pending, { type: 'success', id: 'other', response: 'late' }),
    pending,
  );
  const done = updateDemoChat(pending, { type: 'success', id: 'one', response: 'sample' });
  assert.equal(done.successfulTurns, 1);
  assert.equal(done.turns.length, 1);
  assert.equal(updateDemoChat(done, { type: 'success', id: 'one', response: 'duplicate' }), done);
  assert.equal(updateDemoChat(done, { type: 'failure', id: 'one', issue: 'error' }), done);
});

test('Error and timeout preserve content, charge zero demo turns and retry in place', () => {
  for (const issue of ['error', 'timeout'] as const) {
    const content = 'borrow\n  lend';
    const pending = updateDemoChat(createDemoChatState(), { type: 'send', id: 'one', content });
    const failed = updateDemoChat(pending, { type: 'failure', id: 'one', issue });
    assert.equal(failed.successfulTurns, 0);
    assert.equal(failed.turns[0].content, content);
    assert.equal(updateDemoChat(failed, { type: 'send', id: 'two', content }), failed);
    const retried = updateDemoChat(failed, { type: 'send', id: 'one', content: 'edited' });
    const done = updateDemoChat(retried, { type: 'success', id: 'one', response: 'sample' });
    assert.equal(done.turns.length, 1);
    assert.equal(done.turns[0].content, 'edited');
    assert.equal(done.successfulTurns, 1);
  }
});

test('Only twenty successful demo turns are accepted; invalid content never creates a turn', () => {
  let state = createDemoChatState();
  assert.equal(updateDemoChat(state, { type: 'send', id: 'bad', content: ' ' }), state);
  for (let i = 0; i < 20; i++) {
    state = updateDemoChat(state, { type: 'send', id: String(i), content: 'borrow' });
    state = updateDemoChat(state, { type: 'success', id: String(i), response: 'sample' });
  }
  assert.equal(state.successfulTurns, 20);
  assert.equal(updateDemoChat(state, { type: 'send', id: '21', content: 'borrow' }), state);
  assert.equal(createDemoChatState(true).successfulTurns, 20);
});

test('Loading and response errors are explicit one-shot demo scenarios, with successful retry', async () => {
  const signal = new AbortController().signal;
  const load = createDemoChatRepository('error');
  await assert.rejects(load.load(signal), DemoChatError);
  await load.load(signal);
  const reply = createDemoChatRepository('reply-error');
  await assert.rejects(
    reply.reply('borrow', signal),
    (error: unknown) => error instanceof DemoChatError && error.issue === 'error',
  );
  assert.match(await reply.reply('borrow', signal), /Borrow|borrow/);
});

test('Repository cancellation rejects pending work, including cancellation before invocation', async () => {
  const repository = createDemoChatRepository('timeout');
  const controller = new AbortController();
  const request = repository.reply('borrow', controller.signal);
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  await assert.rejects(repository.load(controller.signal), { name: 'AbortError' });
});

test('Standalone sample selection covers topics and explicitly discloses generic fallback', () => {
  assert.match(sampleChatResponse('borrow'), /người nhận/);
  assert.match(sampleChatResponse('HIỆN TẠI HOÀN THÀNH'), /have\/has/);
  assert.match(sampleChatResponse('luyện nghe'), /transcript/);
  assert.match(sampleChatResponse('đáp án câu đang làm?'), /không phải kết quả gọi mô hình AI/);
});

test('Reused Markdown supports teaching formats and rejects executable/unsafe links', () => {
  assert.ok(
    parseLessonMarkdown(sampleChatResponse('borrow')).some((block) => block.kind === 'list'),
  );
  for (const href of [
    'javascript:alert(1)',
    'data:text/html,bad',
    '//evil.test',
    '/\\evil.test',
    'https://a.test\n.evil',
  ])
    assert.equal(safeMarkdownHref(href), undefined);
  assert.equal(safeMarkdownHref('/study/grammar'), '/study/grammar');
  assert.deepEqual(parseLessonMarkdown('<script>alert(1)</script>'), [
    { kind: 'paragraph', text: '<script>alert(1)</script>' },
  ]);
});
