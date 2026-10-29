import type { QuestionPart, QuestionSummary } from './types';

// Original text summaries, not playable/exam-ready questions. No options, answers,
// group/media/transcript claims, or imports from the student app's attempt fixtures.
const summaries: readonly (readonly [string, string])[] = [
  [
    'Look at the photograph of a receptionist greeting a visitor.',
    'A visitor is at an office reception desk.',
  ],
  [
    'Look at the photograph of passengers waiting on a platform.',
    'People are waiting for a train.',
  ],
  [
    'Look at the photograph of employees arranging chairs.',
    'The conference room is being prepared.',
  ],
  [
    'Look at the photograph of a customer choosing a jacket.',
    'A customer is browsing clothing in a shop.',
  ],
  ['Where can I find the meeting agenda?', 'The agenda is available at the reception desk.'],
  ['When does the next airport shuttle leave?', 'The shuttle leaves in fifteen minutes.'],
  [
    'Who is interviewing the applicants this afternoon?',
    'The hiring manager is conducting the interviews.',
  ],
  ['Would you like a receipt for your purchase?', 'The customer requests an email receipt.'],
  [
    'What are the speakers discussing about the new office?',
    'The conversation concerns an office relocation.',
  ],
  ['Why does the traveler contact the hotel?', 'The traveler needs to change a reservation.'],
  ['What does the manager ask the new employee to do?', 'The employee should attend orientation.'],
  [
    'What problem does the customer report with a delivery?',
    'An item was missing from the shipment.',
  ],
  [
    'What is the purpose of the announcement about the conference?',
    'The speaker announces a change of meeting room.',
  ],
  ['What should passengers do before boarding?', 'Passengers should prepare their tickets.'],
  [
    'What does the speaker say about the training session?',
    'New staff will receive safety training.',
  ],
  ['When will the store reopen after renovation?', 'The announcement provides the reopening date.'],
  [
    'All employees must submit their expense reports before Friday.',
    'The sentence concerns an office deadline.',
  ],
  ['Passengers are advised to arrive at the terminal early.', 'The sentence gives travel advice.'],
  [
    'Candidates with relevant experience are encouraged to apply.',
    'The sentence describes a recruitment notice.',
  ],
  [
    'Customers may request a refund within the stated period.',
    'The sentence describes a store refund policy.',
  ],
  [
    'Complete the email about a revised meeting schedule.',
    'The text discusses scheduling an office meeting.',
  ],
  [
    'Complete the notice about a temporary bus route change.',
    'The text informs travelers of a route change.',
  ],
  [
    'Complete the letter inviting an applicant to an interview.',
    'The text provides interview arrangements.',
  ],
  [
    'Complete the message confirming an online purchase.',
    'The text confirms an order and its delivery date.',
  ],
  [
    'According to the memo, why has the weekly meeting been moved?',
    'Read a memo about an office schedule change.',
  ],
  [
    'What is included in the hotel package described in the advertisement?',
    'Read an advertisement for a travel package.',
  ],
  [
    'What qualification is requested in the job advertisement?',
    'Read a recruitment advertisement.',
  ],
  [
    'What should a customer do to exchange a damaged item?',
    'Read instructions about returning a purchase.',
  ],
];
const tags = ['office', 'travel', 'recruitment', 'shopping'] as const;
const levels = ['EASY', 'MEDIUM', 'HARD'] as const;

export const QUESTION_FIXTURES: readonly QuestionSummary[] = summaries.map(
  ([stem, explanation], index) => ({
    id: `demo-q-${String(index + 1).padStart(3, '0')}`,
    stem,
    explanation,
    part: (Math.floor(index / 4) + 1) as QuestionPart,
    difficulty: levels[index % levels.length],
    tags: [tags[index % tags.length]],
  }),
);
export const QUESTION_TAGS = [...tags];
