import assert from 'node:assert/strict';
import test from 'node:test';
import { groupContentErrors, moveGroupItem } from '../src/lib/questions/group-draft';

const draft = (part: number, passageText = '') => ({
  part,
  type: 'CUSTOM_GROUP_TYPE',
  passageText,
  transcript: '',
  assets: [] as { kind: string; content: string | null; storageKey: string | null }[],
});

test('Part 6 placeholders must cover the complete member order once', () => {
  assert.deepEqual(groupContentErrors(draft(6, 'First [[1]], second [[2]].'), 2), []);
  assert(groupContentErrors(draft(6, 'Missing [[1]].'), 2).length);
  assert(groupContentErrors(draft(6, 'Duplicate [[1]], [[1]].'), 2).length);
  assert(groupContentErrors(draft(6, 'Out of range [[0]], [[2]].'), 2).length);
  assert(groupContentErrors(draft(6, 'Extra [[1]], [[2]], [[3]].'), 2).length);
});

test('Listening groups can save without audio but require their shared transcript', () => {
  for (const part of [3, 4]) {
    assert(groupContentErrors(draft(part), 1).length);
    assert.deepEqual(
      groupContentErrors({ ...draft(part), transcript: 'Shared transcript.' }, 1),
      [],
    );
  }
});

test('Existing Part 6 groups leave archived position gaps to backend validation', () => {
  assert.deepEqual(
    groupContentErrors(draft(6, 'First [[1]], third [[3]].'), 2, { validatePart6: false }),
    [],
  );
});

test('Part 7 accepts a passage or valid text/media asset and preserves custom group types', () => {
  assert(groupContentErrors(draft(7), 1).length);
  assert.deepEqual(groupContentErrors(draft(7, 'A passage.'), 1), []);
  assert.deepEqual(
    groupContentErrors(
      { ...draft(7), assets: [{ kind: 'TEXT', content: 'A document.', storageKey: null }] },
      1,
    ),
    [],
  );
  assert.deepEqual(
    groupContentErrors(
      {
        ...draft(7),
        assets: [{ kind: 'IMAGE', content: null, storageKey: 'groups/owned/image.png' }],
      },
      1,
    ),
    [],
  );
  assert(
    groupContentErrors(
      { ...draft(7), assets: [{ kind: 'TEXT', content: ' ', storageKey: null }] },
      1,
    ).length,
  );
});

test('Question and asset reordering is immutable and keeps all members at the edges', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(moveGroupItem(ids, 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(moveGroupItem(ids, 1, 1), ['a', 'c', 'b']);
  assert.deepEqual(moveGroupItem(ids, 0, -1), ids);
  assert.deepEqual(moveGroupItem(ids, 2, 1), ids);
  assert.deepEqual(ids, ['a', 'b', 'c']);
});
