import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createDemoProfile, profileDraft, profileInitials } from '../src/lib/profile/fixture';
import { createProfileRepository } from '../src/lib/profile/repository';
import {
  AVATAR_PREVIEW_MAX_BYTES,
  profileChanges,
  validateAvatarFile,
  validateProfile,
} from '../src/lib/profile/validation';

test('Profile validates documented storage limits without adding registration-only rules', () => {
  assert.ok(validateProfile({ fullName: ' \t ', phoneNumber: '' }).fullName);
  assert.deepEqual(validateProfile({ fullName: 'A', phoneNumber: '' }), {});
  assert.deepEqual(
    validateProfile({ fullName: '😀'.repeat(255), phoneNumber: 'x'.repeat(32) }),
    {},
  );
  assert.ok(validateProfile({ fullName: 'a'.repeat(256), phoneNumber: '' }).fullName);
  assert.ok(validateProfile({ fullName: 'A', phoneNumber: 'x'.repeat(33) }).phoneNumber);
  assert.deepEqual(validateProfile({ fullName: 'A', phoneNumber: '+84 (0) 123 ext. AB' }), {});
});

test('Profile payload includes only editable text fields; optional phone maps to null', () => {
  assert.deepEqual(profileChanges({ fullName: ' A ', phoneNumber: '  ' }), {
    fullName: ' A ',
    phoneNumber: null,
  });
  assert.deepEqual(profileDraft(createDemoProfile()), {
    fullName: 'Nguyễn Minh An',
    phoneNumber: '',
  });
  assert.equal(profileInitials(' Nguyễn  Minh An '), 'MA');
  assert.equal(profileInitials('😀'), '😀');
  assert.equal(profileInitials(''), '');
});

test('Avatar preview enforces the proposed file formats, type match and 2 MB boundary', () => {
  const file = { name: 'avatar.JPG', type: 'image/jpeg', size: AVATAR_PREVIEW_MAX_BYTES };
  assert.equal(validateAvatarFile(file), null);
  assert.equal(validateAvatarFile({ ...file, name: 'ảnh.png', type: 'image/png' }), null);
  assert.equal(validateAvatarFile({ ...file, name: 'ảnh.webp', type: 'image/webp' }), null);
  for (const invalid of [
    { ...file, size: 0 },
    { ...file, size: AVATAR_PREVIEW_MAX_BYTES + 1 },
    { ...file, type: 'image/png' },
    { ...file, name: 'avatar.svg', type: 'image/svg+xml' },
    { ...file, name: 'avatar.png.html', type: 'text/html' },
    { ...file, name: 'avatar.constructor', type: 'image/jpeg' },
  ])
    assert.ok(validateAvatarFile(invalid));
});

test('Profile repository clones fixtures and saves only text while retaining read-only identity', async () => {
  const repository = createProfileRepository('ready');
  const signal = new AbortController().signal;
  const first = await repository.load(signal);
  assert.ok(first);
  first.fullName = 'mutated copy';
  const saved = await repository.save({ fullName: 'Tên thử', phoneNumber: '+84 123' }, signal);
  assert.equal(saved.fullName, 'Tên thử');
  assert.equal(saved.phoneNumber, '+84 123');
  assert.equal(saved.email, createDemoProfile().email);
  assert.equal(saved.role, 'USER');
  assert.equal(saved.status, 'ACTIVE');
  saved.fullName = 'mutated response';
  assert.equal((await repository.load(signal))?.fullName, 'Tên thử');
});

test('Repository refuses identity/avatar fields and invalid text without changing its snapshot', async () => {
  const repository = createProfileRepository('ready');
  const signal = new AbortController().signal;
  for (const field of ['role', 'status', 'email', 'avatarUrl', 'avatar_key', 'userId']) {
    await assert.rejects(
      repository.save({ fullName: 'new', phoneNumber: null, [field]: 'bad' }, signal),
    );
  }
  await assert.rejects(repository.save({ fullName: '', phoneNumber: null }, signal));
  assert.deepEqual(await repository.load(signal), createDemoProfile());
});

test('Load/save failure scenarios retry explicitly and preserve the last in-memory profile', async () => {
  const signal = new AbortController().signal;
  const load = createProfileRepository('error');
  await assert.rejects(load.load(signal));
  assert.deepEqual(await load.load(signal), createDemoProfile());
  assert.equal(await createProfileRepository('empty').load(signal), null);
  const save = createProfileRepository('save-error');
  const changes = { fullName: 'Tên mới', phoneNumber: null };
  await assert.rejects(save.save(changes, signal));
  assert.deepEqual(await save.load(signal), createDemoProfile());
  assert.equal((await save.save(changes, signal)).fullName, 'Tên mới');
});

test('Aborting a save cannot modify data, and each new page repository starts with an isolated fixture', async () => {
  const repository = createProfileRepository('ready');
  const controller = new AbortController();
  const pending = repository.save({ fullName: 'Aborted', phoneNumber: null }, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(repository.load(controller.signal), { name: 'AbortError' });
  const signal = new AbortController().signal;
  assert.deepEqual(await repository.load(signal), createDemoProfile());
  await repository.save({ fullName: 'Changed', phoneNumber: null }, signal);
  assert.deepEqual(await createProfileRepository('ready').load(signal), createDemoProfile());
});
