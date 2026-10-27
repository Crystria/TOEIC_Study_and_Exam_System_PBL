import { summarizeSelection } from './selection';
import type { ExamQuestionSet, ExamGroup, ExamOption, ExamQuestion } from './session-types';
import type { ExamSelection, ExamTest, PartId } from './types';

const choices = (values: string[]): ExamOption[] =>
  values.map((text, index) => ({ key: 'ABCD'[index], text }));
const templates: Record<PartId, { prompts: string[]; options: string[][] }> = {
  1: {
    prompts: ['Listen and choose the statement that best describes the illustration.'],
    options: [['Statement A', 'Statement B', 'Statement C', 'Statement D']],
  },
  // Four options follow the current SRS; the production Part 2 contract is unresolved.
  2: {
    prompts: ['Listen to the question and choose the most appropriate response.'],
    options: [
      ['At ten o’clock.', 'In the meeting room.', 'Yes, I sent it yesterday.', 'The blue folder.'],
    ],
  },
  3: {
    prompts: [
      'What are the speakers discussing?',
      'When will the delivery arrive?',
      'What will the man do next?',
    ],
    options: [
      ['An office delivery', 'A training course', 'A holiday booking', 'A job interview'],
      ['This morning', 'Tomorrow afternoon', 'Next Friday', 'At the weekend'],
      ['Contact the supplier', 'Book a hotel', 'Cancel the meeting', 'Repair a printer'],
    ],
  },
  4: {
    prompts: [
      'Who is the announcement intended for?',
      'Where will the event take place?',
      'What are listeners asked to bring?',
    ],
    options: [
      ['New employees', 'Train passengers', 'Hotel guests', 'Restaurant customers'],
      ['The third-floor training room', 'The main entrance', 'A nearby café', 'The city library'],
      ['Their employee ID', 'A printed ticket', 'A suitcase', 'Some photographs'],
    ],
  },
  5: {
    prompts: [
      'The team will review the proposal _____ the meeting.',
      'Please submit the completed form _____ Friday.',
      'Our new system helps employees work more _____.',
    ],
    options: [
      ['during', 'between', 'among', 'unless'],
      ['by', 'at', 'on to', 'with'],
      ['efficiently', 'efficient', 'efficiency', 'efficiencies'],
    ],
  },
  6: {
    prompts: [
      'Select the word that best completes blank [1].',
      'Select the phrase that best completes blank [2].',
      'Select the word that best completes blank [3].',
      'Select the sentence that best completes blank [4].',
    ],
    options: [
      ['pleased', 'please', 'pleasingly', 'pleasure'],
      ['will open', 'opening', 'has open', 'to opening'],
      ['convenient', 'convenience', 'conveniently', 'convene'],
      [
        'Please contact reception if you have any questions.',
        'The museum closed a century ago.',
        'No train tickets were available.',
        'The weather was unusually cold.',
      ],
    ],
  },
  7: {
    prompts: [
      'What is the main purpose of the first message?',
      'What are staff members asked to do?',
      'What does the second message confirm?',
    ],
    options: [
      [
        'To announce a workshop',
        'To request a refund',
        'To describe a product',
        'To change a flight',
      ],
      [
        'Register by Thursday',
        'Bring a bicycle',
        'Pay a delivery charge',
        'Cancel their appointments',
      ],
      ['The room reservation', 'A price increase', 'An employee transfer', 'A restaurant opening'],
    ],
  },
};

// Original UI fixtures, intentionally repeated to exercise the full 200-question
// structure. They are not an ETS test and contain no answer keys or explanations.
export function buildDemoQuestions(test: ExamTest, selection: ExamSelection): ExamQuestionSet {
  summarizeSelection(test, selection);
  const questions: ExamQuestion[] = [];
  const groups: ExamGroup[] = [];
  let globalNumber = 0;
  for (const part of test.parts) {
    if (!selection.partIds.includes(part.id)) {
      globalNumber += part.questionCount;
      continue;
    }
    const groupSize = part.id === 3 || part.id === 4 || part.id === 7 ? 3 : part.id === 6 ? 4 : 1;
    for (let start = 0; start < part.questionCount; start += groupSize) {
      const groupIndex = Math.floor(start / groupSize) + 1;
      const id = `${test.id}-p${part.id}-g${groupIndex}`;
      const group: ExamGroup = {
        id,
        partId: part.id,
        title: `Part ${part.id} · ${part.name}`,
        instruction:
          part.id <= 4
            ? 'Nghe nội dung minh họa và chọn đáp án cho các câu trong nhóm.'
            : 'Đọc nội dung và chọn đáp án phù hợp. Bạn có thể tô sáng từng đoạn để xem lại.',
        audioUrl: part.id <= 4 ? `/demo/audio/listening-part-${part.id}.mp3` : null,
        imageUrl: part.id === 1 ? '/demo/exam/office.svg' : null,
        imageAlt: 'Minh họa một bàn làm việc với máy tính, sổ tay và cây xanh; không có người.',
        passages: [],
        questionIds: [],
      };
      if (part.id === 6)
        group.passages = [
          {
            id: `${id}-text`,
            title: `Office notice · Mẫu ${groupIndex}`,
            paragraphs: [
              'We are [1] to announce that our new staff lounge [2] next Monday.',
              'The lounge is located on the second floor, offering a [3] place to take a break. [4]',
            ],
          },
        ];
      if (part.id === 7)
        group.passages = [
          {
            id: `${id}-email`,
            title: `Email · Workshop invitation ${groupIndex}`,
            paragraphs: [
              'From: Training Team\nSubject: Customer service workshop',
              'Our customer service workshop will be held next Monday at 10 a.m. in Room 304. Staff members should register by Thursday. The workshop is free and all materials will be provided.',
            ],
          },
          {
            id: `${id}-reply`,
            title: 'Reply · Room confirmation',
            paragraphs: [
              'From: Reception\nTo: Training Team',
              'Room 304 has been reserved for your workshop. The projector and twenty chairs will be ready by 9:30 a.m. Please let us know if you need additional equipment.',
            ],
          },
        ];
      for (let offset = 0; offset < groupSize && start + offset < part.questionCount; offset++) {
        const template = templates[part.id];
        const templateIndex = (part.id === 5 ? start : offset) % template.prompts.length;
        const question: ExamQuestion = {
          id: `${test.id}-p${part.id}-q${start + offset + 1}`,
          partId: part.id,
          number: ++globalNumber,
          groupId: id,
          prompt: template.prompts[templateIndex],
          options: choices(template.options[templateIndex]),
        };
        questions.push(question);
        group.questionIds.push(question.id);
      }
      groups.push(group);
    }
  }
  return { questions, groups };
}

export async function loadDemoQuestions(
  test: ExamTest,
  selection: ExamSelection,
  preview: string | undefined,
  signal: AbortSignal,
): Promise<ExamQuestionSet> {
  await new Promise<void>((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, 300);
    if (signal.aborted) stop();
    else signal.addEventListener('abort', stop, { once: true });
  });
  if (preview === 'error') throw new Error('Chưa tải được câu hỏi demo.');
  if (preview === 'empty') return { questions: [], groups: [] };
  return buildDemoQuestions(test, selection);
}
