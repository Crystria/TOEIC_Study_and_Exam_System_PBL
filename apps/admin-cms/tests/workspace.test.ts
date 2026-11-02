import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceSeed } from '../src/lib/demo/workspace-seed';
import { createWorkspaceStore } from '../src/lib/demo/workspace-store';
import {
  blankRecord,
  canManage,
  type QuestionRecord,
  type WorkspaceState,
} from '../src/lib/demo/workspace-model';
import {
  effectiveQuestion,
  validateMediaFile,
  validateQuestion,
  validateRecord,
  validateTest,
} from '../src/lib/demo/workspace-validation';
import { workspaceHref, workspacePage } from '../src/lib/demo/workspace-query';
import { LESSON_FIXTURES } from '../src/lib/lessons/fixtures';
import { QUESTION_FIXTURES } from '../src/lib/questions/fixtures';
import { resolveCmsDestination } from '../src/lib/demo/cms-destination';

const content = 'CONTENT_ADMIN' as const;
const admin = 'SYSTEM_ADMIN' as const;
const lesson = () => ({
  ...blankRecord('lessons'),
  title: 'Bài mới',
  category: 'Ngữ pháp',
  contentMarkdown: '# Ví dụ\n\n**Hello**',
});
function question(part: QuestionRecord['part'] = 5): QuestionRecord {
  return {
    ...blankRecord('questions'),
    id: 'q',
    part,
    stem: 'Select the correct answer.',
    difficulty: 'EASY',
    options: { A: 'One', B: 'Two', C: 'Three', D: 'Four' },
    answer: 'A',
  };
}
function withMedia(): WorkspaceState {
  const s = createWorkspaceSeed();
  s.media = [
    { id: 'audio', name: 'a.mp3', kind: 'audio', mime: 'audio/mpeg', size: 100, url: 'blob:audio' },
    { id: 'image', name: 'a.png', kind: 'image', mime: 'image/png', size: 100, url: 'blob:image' },
  ];
  return s;
}

test('seed is detached from all existing fixtures and from successive seeds', () => {
  const before = JSON.stringify([LESSON_FIXTURES, QUESTION_FIXTURES]);
  const a = createWorkspaceSeed(),
    b = createWorkspaceSeed();
  a.lessons[0].title = 'changed';
  a.questions[0].tags.push('changed');
  a.users[0].roles.splice(0);
  assert.notDeepEqual(a, b);
  assert.equal(JSON.stringify([LESSON_FIXTURES, QUESTION_FIXTURES]), before);
});
test('store creates IDs, freezes snapshots and preserves previous snapshots', () => {
  const store = createWorkspaceStore();
  const before = store.getSnapshot();
  const id = store.save('lessons', lesson(), content);
  assert.ok(id.startsWith('demo-created-lessons-'));
  assert.equal(store.getSnapshot().lessons[0].id, id);
  assert.equal(before.lessons.length + 1, store.getSnapshot().lessons.length);
  assert.throws(() => (store.getSnapshot().lessons[0].title = 'mutate'));
});
test('CRUD list and detail share updated data, subscriptions notify once and unsubscribe', () => {
  const store = createWorkspaceStore();
  let calls = 0;
  const unsub = store.subscribe(() => calls++);
  const id = store.save('lessons', lesson(), content);
  const record = store.getSnapshot().lessons.find((l) => l.id === id)!;
  store.save('lessons', { ...record, title: 'Sửa' }, content);
  record.title;
  assert.equal(calls, 2);
  const page = workspacePage('lessons', store.getSnapshot(), new URLSearchParams('keyword=Sửa'));
  assert.deepEqual(
    page.items.map((l) => l.id),
    [id],
  );
  unsub();
  store.remove('lessons', id, content);
  assert.equal(calls, 2);
  assert.ok(!store.getSnapshot().lessons.some((l) => l.id === id));
});
test('fresh store restores sample data and drops demo additions', () => {
  const a = createWorkspaceStore(),
    b = createWorkspaceStore();
  a.save('lessons', lesson(), content);
  assert.deepEqual(b.getSnapshot(), createWorkspaceSeed());
});
test('invalid saves are atomic and do not publish', () => {
  const store = createWorkspaceStore();
  const before = store.getSnapshot();
  assert.throws(() => store.save('lessons', blankRecord('lessons'), content));
  assert.equal(store.getSnapshot(), before);
});
test('persona checks cover all entity commands without implying authentication', () => {
  assert.ok(canManage('users', admin));
  assert.ok(!canManage('users', content));
  const store = createWorkspaceStore();
  assert.throws(() => store.save('lessons', lesson(), admin));
  assert.throws(() => store.remove('lessons', store.getSnapshot().lessons[0].id, admin));
  assert.throws(() => store.save('users', store.getSnapshot().users[0], content));
});
test('lesson title/category/Markdown are required without arbitrary length rules', () => {
  const s = createWorkspaceSeed();
  assert.equal(Object.keys(validateRecord('lessons', blankRecord('lessons'), s)).length, 3);
  assert.deepEqual(
    validateRecord(
      'lessons',
      { ...lesson(), title: 'a', contentMarkdown: '<script>literal</script>' },
      s,
    ),
    {},
  );
});
test('vocabulary requires existing topic, word and meaning, permits optional fields', () => {
  const s = createWorkspaceSeed();
  const r = { ...blankRecord('vocabulary'), word: 'a', meaning: 'b', topicId: s.topics[0].id };
  assert.deepEqual(validateRecord('vocabulary', r, s), {});
  assert.ok(validateRecord('vocabulary', { ...r, topicId: 'missing' }, s).topicId);
  assert.ok(validateRecord('vocabulary', { ...r, audioId: 'missing' }, s).audioId);
});
test('topic rename joins immediately; linked topic deletion blocks without mutation', () => {
  const store = createWorkspaceStore();
  const topic = store.getSnapshot().topics[0];
  store.save('topics', { ...topic, name: 'Renamed' }, content);
  assert.equal(
    store.getSnapshot().topics.find((t) => t.id === store.getSnapshot().vocabulary[0].topicId)
      ?.name,
    'Renamed',
  );
  const before = store.getSnapshot();
  assert.throws(() => store.remove('topics', topic.id, content));
  assert.equal(store.getSnapshot(), before);
});
test('all Parts enforce four options and one explicit answer, retaining Part 5 rules', () => {
  const s = withMedia();
  for (const part of [1, 2, 3, 4, 5, 6, 7] as const) {
    const q = { ...question(part), audioId: 'audio', imageId: 'image', transcript: 'Speech' };
    if (part >= 6) {
      q.groupId = 'g';
      s.groups.push({
        ...blankRecord('groups'),
        id: 'g',
        part,
        title: 'Shared',
        content: 'Passage',
      });
    }
    assert.deepEqual(validateQuestion(q, s), {});
    assert.ok(validateQuestion({ ...q, answer: '' }, s).answer);
    assert.ok(validateQuestion({ ...q, options: { ...q.options, D: ' ' } }, s)['option-D']);
    s.groups = s.groups.filter((g) => g.id !== 'g');
  }
});
test('listening requires usable media references and transcript; Part 1 also image', () => {
  const s = withMedia();
  const q = question(1);
  const e = validateQuestion(q, s);
  assert.ok(e.audioId && e.imageId && e.transcript);
  assert.deepEqual(
    validateQuestion({ ...q, audioId: 'audio', imageId: 'image', transcript: 'Speech' }, s),
    {},
  );
  assert.ok(
    validateQuestion({ ...q, audioId: 'image', imageId: 'image', transcript: 'Speech' }, s).audioId,
  );
});
test('shared stimulus supplies listening data and rejects cross-Part groups', () => {
  const s = withMedia();
  s.groups = [
    {
      ...blankRecord('groups'),
      id: 'g',
      part: 3,
      title: 'Conversation',
      audioId: 'audio',
      transcript: 'Speech',
    },
  ];
  const q = { ...question(3), groupId: 'g' };
  assert.equal(effectiveQuestion(q, s).audioId, 'audio');
  assert.deepEqual(validateQuestion(q, s), {});
  assert.ok(validateQuestion({ ...q, part: 4 }, s).groupId);
});
test('reading shared content requires known same-Part group, no invented passage count', () => {
  const s = withMedia();
  s.groups = [
    { ...blankRecord('groups'), id: 'g', part: 7, title: 'Reading', content: 'One passage' },
  ];
  assert.deepEqual(validateQuestion({ ...question(7), groupId: 'g' }, s), {});
  assert.ok(validateQuestion({ ...question(7), groupId: 'unknown' }, s).groupId);
});
test('group membership save is atomic and validates same-Part selections', () => {
  const seed = withMedia();
  seed.questions = [question(3), { ...question(5), id: 'other' }];
  const store = createWorkspaceStore(seed);
  const group = {
    ...blankRecord('groups'),
    part: 3 as const,
    title: 'Group',
    audioId: 'audio',
    transcript: 'Speech',
  };
  const before = store.getSnapshot();
  assert.throws(() => store.save('groups', group, content, ['other']));
  assert.equal(store.getSnapshot(), before);
  const id = store.save('groups', group, content, ['q']);
  assert.equal(store.getSnapshot().questions[0].groupId, id);
  store.remove('groups', id, content);
  assert.equal(store.getSnapshot().questions[0].groupId, '');
});
test('media type, MIME, size boundaries, empty and unsupported formats', () => {
  const file = { name: 'a.MP3', type: 'audio/mpeg', size: 5 * 1024 * 1024 };
  assert.equal(validateMediaFile(file), null);
  assert.ok(validateMediaFile({ ...file, size: file.size + 1 }));
  assert.ok(validateMediaFile({ ...file, size: 0 }));
  for (const [ext, mime] of [
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['webp', 'image/webp'],
  ]) {
    assert.equal(validateMediaFile({ name: 'a.' + ext, type: mime, size: 2 * 1024 * 1024 }), null);
    assert.ok(validateMediaFile({ name: 'a.' + ext, type: mime, size: 2 * 1024 * 1024 + 1 }));
  }
  for (const name of ['a.svg', 'a.wav', 'a.mp3.exe', 'a'])
    assert.ok(validateMediaFile({ ...file, name }));
  assert.ok(validateMediaFile({ ...file, type: 'image/png' }));
  assert.equal(validateMediaFile({ ...file, type: '' }), null);
});
test('removing media detaches all references including option images', () => {
  const s = withMedia();
  s.questions = [
    {
      ...question(1),
      audioId: 'audio',
      imageId: 'image',
      optionImages: { A: 'image', B: '', C: '', D: '' },
    },
  ];
  s.vocabulary[0].imageId = 'image';
  s.groups[0].imageId = 'image';
  const store = createWorkspaceStore(s);
  store.remove('media', 'image', content);
  const after = store.getSnapshot();
  assert.equal(after.questions[0].imageId, '');
  assert.equal(after.questions[0].optionImages.A, '');
  assert.equal(after.vocabulary[0].imageId, '');
  assert.equal(after.groups[0].imageId, '');
  assert.ok(validateQuestion(after.questions[0], after).imageId);
});
test('Mini structure accepts nonstandard count but validates Word duration', () => {
  const s = withMedia();
  s.questions = [question()];
  const t = { ...blankRecord('tests'), title: 'Mini', questionIds: ['q'] };
  assert.deepEqual(validateTest(t, s), {});
  assert.ok(validateTest({ ...t, durationSeconds: 7200 }, s).durationSeconds);
});
test('Full structure requires exactly 200 without imposing unconfirmed Part quotas', () => {
  const s = withMedia();
  s.questions = Array.from({ length: 200 }, (_, i) => ({ ...question(), id: 'q' + i }));
  const t = {
    ...blankRecord('tests'),
    title: 'Full',
    type: 'FULL' as const,
    durationSeconds: 7200,
    questionIds: s.questions.map((q) => q.id),
  };
  assert.deepEqual(validateTest(t, s), {});
  assert.ok(validateTest({ ...t, questionIds: t.questionIds.slice(1) }, s).questionIds);
});
test('structure rejects missing/duplicate/invalid questions and descending Parts', () => {
  const s = withMedia();
  s.questions = [question(), { ...question(2), id: 'q2', audioId: 'audio', transcript: 'Speech' }];
  const t = { ...blankRecord('tests'), title: 'Mini' };
  for (const ids of [[], ['missing'], ['q', 'q'], ['q', 'q2']])
    assert.ok(validateTest({ ...t, questionIds: ids }, s).questionIds);
  assert.deepEqual(validateTest({ ...t, questionIds: ['q2', 'q'] }, s), {});
});
test('structure preserves complete, contiguous groups and validates stimulus', () => {
  const s = withMedia();
  s.groups = [
    {
      ...blankRecord('groups'),
      id: 'g',
      part: 3,
      title: 'Shared',
      audioId: 'audio',
      transcript: 'Speech',
    },
  ];
  s.questions = [
    { ...question(3), id: 'a', groupId: 'g' },
    { ...question(3), id: 'b', groupId: 'g' },
    { ...question(3), id: 'c', audioId: 'audio', transcript: 'Speech' },
  ];
  const t = { ...blankRecord('tests'), title: 'Mini' };
  assert.ok(validateTest({ ...t, questionIds: ['a'] }, s).questionIds);
  assert.ok(validateTest({ ...t, questionIds: ['a', 'c', 'b'] }, s).questionIds);
  assert.deepEqual(validateTest({ ...t, questionIds: ['a', 'b', 'c'] }, s), {});
});
test('in-use questions/groups cannot be deleted until removed from tests', () => {
  const s = withMedia();
  s.questions = [question()];
  s.tests = [{ ...blankRecord('tests'), id: 't', title: 'Mini', questionIds: ['q'] }];
  const store = createWorkspaceStore(s);
  assert.throws(() => store.remove('questions', 'q', content));
  store.save('tests', { ...s.tests[0], questionIds: ['q'] }, content);
  store.remove('tests', 't', content);
  store.remove('questions', 'q', content);
  assert.equal(store.getSnapshot().questions.length, 0);
});
test('user update permits only valid roles/status and keeps identity read-only', () => {
  const store = createWorkspaceStore();
  const u = store.getSnapshot().users[0];
  assert.throws(() => store.save('users', { ...u, roles: [] }, admin));
  assert.throws(() => store.save('users', { ...u, status: '' }, admin));
  store.save(
    'users',
    {
      ...u,
      email: 'changed',
      fullName: 'changed',
      roles: ['USER', 'CONTENT_ADMIN'],
      status: 'DISABLED',
    },
    admin,
  );
  const next = store.getSnapshot().users[0];
  assert.equal(next.email, u.email);
  assert.equal(next.fullName, u.fullName);
  assert.equal(next.status, 'DISABLED');
  assert.throws(() => store.remove('users', u.id, admin));
  assert.throws(() => store.save('users', blankRecord('users'), admin));
});
test('fixed-path navigation preserves allowlisted list state and rejects returnTo', () => {
  const s = createWorkspaceSeed();
  const p = new URLSearchParams(
    'demoRole=CONTENT_ADMIN&keyword=agenda&size=1&returnTo=https://bad.test&detailPreview=long',
  );
  const href = workspaceHref('vocabulary', s, p, 'a/b');
  assert.ok(href.startsWith('/vocabulary/a%2Fb?'));
  assert.ok(href.includes('keyword=agenda'));
  assert.ok(href.includes('size=1'));
  assert.ok(!href.includes('returnTo'));
  assert.ok(!href.includes('detailPreview'));
});
test('RAM lists retain filtering and clamp page after deletion', () => {
  const s = createWorkspaceSeed();
  const r = workspacePage('lessons', s, new URLSearchParams('page=999'));
  assert.equal(r.page, r.totalPages);
  assert.ok(r.canonical.includes('page=' + r.totalPages));
  const v = workspacePage('vocabulary', s, new URLSearchParams('topicId=unknown'));
  assert.equal(v.total, 0);
});
test('all new nested routes resolve to the existing persona destinations', () => {
  for (const kind of [
    'questions',
    'tests',
    'lessons',
    'vocabulary',
    'topics',
    'groups',
    'media',
    'users',
  ])
    for (const suffix of ['', '/new', '/demo-id', '/demo-id/edit']) {
      const d = resolveCmsDestination('/' + kind + suffix);
      assert.ok(d);
      assert.equal(d.role, kind === 'users' ? 'SYSTEM_ADMIN' : 'CONTENT_ADMIN');
    }
  assert.equal(resolveCmsDestination('/users/a/edit/extra'), undefined);
});
