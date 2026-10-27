import {
  assertQuestion,
  groupErrors,
  isComplete,
  publicQuestion,
  QuestionRecord,
  GroupRecord,
} from './question-rules';

export function fixture(part = 5): QuestionRecord {
  return {
    id: 'q1',
    part,
    type: 'SINGLE_CHOICE',
    questionText: 'Choose the answer',
    explanation: 'Secret explanation',
    correctOption: 'A',
    difficulty: 'EASY',
    transcript: null,
    audioKey: null,
    imageKey: null,
    groupId: null,
    positionInGroup: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    group: null,
    tags: [],
    options: (part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']).map((optionCode) => ({
      questionId: 'q1',
      optionCode,
      optionText: `Option ${optionCode}`,
    })),
  };
}
describe('TOEIC question and group rules', () => {
  it('accepts exactly A-C for Part 2 and A-D for the other parts', () => {
    const q = fixture(2);
    expect(() => assertQuestion(q)).not.toThrow();
    q.options.push({ questionId: 'q1', optionCode: 'D', optionText: 'D' });
    expect(() => assertQuestion(q)).toThrow();
    const reading = fixture();
    reading.options[1].optionCode = 'A';
    expect(() => assertQuestion(reading)).toThrow();
  });
  it('requires an answer belonging to options and rejects groups on Part 1/2/5', () => {
    const q = fixture();
    q.correctOption = 'Z';
    expect(() => assertQuestion(q)).toThrow();
    q.correctOption = 'A';
    q.groupId = 'g1';
    expect(() => assertQuestion(q)).toThrow();
  });
  it.each([1, 2])('requires media and transcript for Part %s completeness', (part) => {
    const q = fixture(part);
    expect(isComplete(q)).toBe(false);
    q.audioKey = 'audio.mp3';
    q.transcript = 'Transcript';
    q.imageKey = 'image.png';
    expect(isComplete(q)).toBe(true);
  });
  it.each([3, 4, 6, 7])('requires a matching complete group for Part %s', (part) => {
    const q = fixture(part);
    expect(isComplete(q)).toBe(false);
    q.groupId = 'g1';
    q.positionInGroup = 1;
    const g = {
      id: 'g1',
      part,
      type: 'GROUP',
      audioKey: 'audio.mp3',
      transcript: 'Transcript',
      passageText: 'Passage [[1]]',
      deletedAt: null,
      assets: [],
      questions: [q],
    } as unknown as GroupRecord;
    q.group = g;
    expect(isComplete(q)).toBe(true);
    g.part = part === 7 ? 6 : 7;
    expect(isComplete(q)).toBe(false);
  });
  it('checks Part 6 placeholder correspondence and archived members', () => {
    const q = fixture(6);
    q.groupId = 'g1';
    q.positionInGroup = 1;
    const g = {
      id: 'g1',
      part: 6,
      passageText: '[[2]]',
      deletedAt: null,
      assets: [],
      questions: [q],
    } as unknown as GroupRecord;
    expect(groupErrors(g)).toContain('Part 6 placeholders must match question positions');
    g.passageText = '[[1]]';
    q.deletedAt = new Date();
    expect(groupErrors(g)).toContain('group contains archived or invalid questions');
    g.questions = [];
    expect(groupErrors(g)).toContain('group has no questions');
  });
  it('Part 7 accepts ordered text assets and rejects missing passage/assets', () => {
    const g = {
      id: 'g1',
      part: 7,
      deletedAt: null,
      passageText: null,
      assets: [],
      questions: [],
    } as unknown as GroupRecord;
    expect(groupErrors(g)).toContain('Part 7 passage or asset required');
    g.assets = [{ kind: 'TEXT', content: 'First passage', orderNo: 1 }] as GroupRecord['assets'];
    expect(groupErrors(g)).not.toContain('Part 7 passage or asset required');
  });
  it('does not expose answer keys or explanations to USER', () => {
    const q = fixture();
    const user = publicQuestion(q, false, () => null);
    expect(JSON.stringify(user)).not.toContain('correctOption');
    expect(JSON.stringify(user)).not.toContain('Secret explanation');
    expect(publicQuestion(q, true, () => null).correctOption).toBe('A');
  });
});
