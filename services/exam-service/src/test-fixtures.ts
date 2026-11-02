import { randomUUID } from 'node:crypto';
import { AnswerBundle, QuestionBundle, Question, QuestionGroup } from './grpc/question-bank.client';
import { TestItem } from './modules/tests/test-rules';

// Shared deterministic structure; each fixture owns new IDs so tests can run concurrently.
export function fullFixture() {
  const counts = [6, 25, 39, 30, 30, 16, 54];
  const items: TestItem[] = [],
    questions: Question[] = [],
    groups: QuestionGroup[] = [];
  for (let part = 1; part <= 7; part++) {
    let group: QuestionGroup | undefined;
    const groupSize = part === 6 ? 4 : 3;
    for (let index = 0; index < counts[part - 1]; index++) {
      if ([3, 4, 6, 7].includes(part) && index % groupSize === 0) {
        group = {
          group_id: randomUUID(),
          part,
          type: 'STIMULUS',
          instruction: 'Read or listen',
          audio_key: part <= 4 ? 'groups/audio.mp3' : '',
          transcript: part <= 4 ? 'Group transcript' : '',
          passage_text:
            part === 6 ? 'Passage [[1]] [[2]] [[3]] [[4]]' : part === 7 ? 'Reading passage' : '',
          order_no: groups.length + 1,
          assets: [],
          question_ids: [],
        };
        groups.push(group);
      }
      const id = randomUUID(),
        q: Question = {
          id,
          part,
          type: 'SINGLE_CHOICE',
          stem: `Original question ${items.length + 1}`,
          question_text: `Original question ${items.length + 1}`,
          explanation: 'Private explanation',
          difficulty: 'EASY',
          media_url: '',
          options: (part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']).map((code) => ({
            id: `${id}:${code}`,
            option_key: code,
            content: `Option ${code}`,
            media_url: '',
          })),
          group_id: group?.group_id ?? '',
          position_in_group: group ? (index % groupSize) + 1 : 0,
          transcript: part <= 2 ? 'Question transcript' : '',
          audio_key: part <= 2 ? 'questions/audio.mp3' : '',
          image_key: part === 1 ? 'questions/image.png' : '',
          is_complete: true,
          revision: 'revision-1',
        };
      group?.question_ids.push(id);
      questions.push(q);
      items.push({ questionId: id, part, orderNo: items.length + 1 });
    }
  }
  const bundle: QuestionBundle = { questions, groups, missing_ids: [] };
  const key: AnswerBundle = {
    answers: questions.map((q) => ({
      question_id: q.id,
      correct_option: 'A',
      revision: q.revision,
    })),
    missing_ids: [],
  };
  return { items, bundle, key };
}
