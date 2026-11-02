import { fullFixture } from '../../test-fixtures';
import { bundleErrors, fullStructureErrors } from './test-rules';
describe('Full/Part test content validation', () => {
  it('requires 7 ordered parts, 200 questions, 100 Listening/100 Reading and 7200 seconds', () => {
    const { items } = fullFixture();
    expect(fullStructureErrors(items, 7200)).toEqual([]);
    expect(fullStructureErrors(items, 7199)).not.toEqual([]);
    expect(fullStructureErrors(items.slice(1), 7200)).not.toEqual([]);
    const duplicated = items.map((q) => ({ ...q }));
    duplicated[1].questionId = duplicated[0].questionId;
    expect(fullStructureErrors(duplicated, 7200)).toContain('Duplicate question IDs');
    duplicated[1].orderNo = 4;
    expect(fullStructureErrors(duplicated, 7200)).toContain('Positions must be consecutive from 1');
  });
  it('accepts complete groups and rejects a group missing one test member', () => {
    const { items, bundle, key } = fullFixture();
    expect(bundleErrors(items, bundle, key)).toEqual([]);
    const member = bundle.groups[0].question_ids[0];
    expect(
      bundleErrors(
        items.filter((q) => q.questionId !== member),
        bundle,
        key,
      ).join(),
    ).toContain('every group member');
  });
  it('detects revision changes between question and answer-key RPCs', () => {
    const { items, bundle, key } = fullFixture();
    key.answers[0].revision = 'revision-2';
    expect(bundleErrors(items, bundle, key).join()).toContain('content changed while snapshotting');
  });
  it('rejects missing questions, incomplete media, wrong parts and invalid Part 2 option D', () => {
    const { items, bundle, key } = fullFixture();
    bundle.missing_ids.push(items[0].questionId);
    bundle.questions[0].audio_key = '';
    bundle.questions[0].is_complete = false;
    bundle.questions[6].options.push({ id: 'D', option_key: 'D', content: 'D', media_url: '' });
    bundle.questions[7].part = 3;
    const errors = bundleErrors(items, bundle, key).join();
    expect(errors).toContain('missing');
    expect(errors).toContain('audio/transcript');
    expect(errors).toContain('invalid options');
    expect(errors).toContain('part mismatch');
  });
  it('requires group audio, passage and matching Part 6 placeholder positions', () => {
    const { items, bundle } = fullFixture();
    bundle.groups.find((g) => g.part === 3)!.audio_key = '';
    bundle.groups.find((g) => g.part === 6)!.passage_text = '[[99]]';
    bundle.groups.find((g) => g.part === 7)!.passage_text = '';
    const errors = bundleErrors(items, bundle).join();
    expect(errors).toContain('group audio');
    expect(errors).toContain('placeholders mismatch');
    expect(errors).toContain('Part 7 passage');
  });
});
