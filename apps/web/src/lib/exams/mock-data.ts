import type { ExamTest, PartId, TestPart } from './types';

const partDefinitions: Omit<TestPart, 'questionCount' | 'durationSeconds'>[] = [
  {
    id: 1,
    name: 'Mô tả tranh',
    description: 'Nghe và chọn câu mô tả phù hợp với hình ảnh.',
    skill: 'LISTENING',
    active: true,
  },
  {
    id: 2,
    name: 'Hỏi – đáp',
    description: 'Nghe câu hỏi và chọn lời đáp phù hợp.',
    skill: 'LISTENING',
    active: true,
  },
  {
    id: 3,
    name: 'Hội thoại',
    description: 'Nghe hội thoại và trả lời các câu hỏi liên quan.',
    skill: 'LISTENING',
    active: true,
  },
  {
    id: 4,
    name: 'Bài nói ngắn',
    description: 'Nghe thông báo, hướng dẫn và bài nói ngắn.',
    skill: 'LISTENING',
    active: true,
  },
  {
    id: 5,
    name: 'Hoàn thành câu',
    description: 'Chọn từ hoặc cấu trúc phù hợp để hoàn thành câu.',
    skill: 'READING',
    active: true,
  },
  {
    id: 6,
    name: 'Hoàn thành đoạn văn',
    description: 'Điền từ hoặc câu còn thiếu theo ngữ cảnh.',
    skill: 'READING',
    active: true,
  },
  {
    id: 7,
    name: 'Đọc hiểu',
    description: 'Đọc văn bản đơn hoặc nhiều văn bản và trả lời câu hỏi.',
    skill: 'READING',
    active: true,
  },
];

function parts(
  counts: Partial<Record<PartId, number>>,
  durations: Partial<Record<PartId, number>> = {},
): TestPart[] {
  return partDefinitions
    .filter((part) => counts[part.id])
    .map((part) => ({
      ...part,
      questionCount: counts[part.id]!,
      durationSeconds: durations[part.id] ?? null,
    }));
}

const fullCounts = { 1: 6, 2: 25, 3: 39, 4: 30, 5: 30, 6: 16, 7: 54 };

// Original illustrative metadata only. No questions, answer keys or fake attempt IDs.
export const demoExamTests: ExamTest[] = [
  {
    id: 'full-test-01',
    title: 'TOEIC toàn diện 01',
    description: 'Làm quen cấu trúc 7 Part với các ngữ cảnh công việc và đời sống.',
    collection: 'TOEIC nền tảng',
    type: 'FULL_TEST',
    durationSeconds: 7200,
    parts: parts(fullCounts),
    available: true,
  },
  {
    id: 'full-test-02',
    title: 'TOEIC toàn diện 02',
    description: 'Rèn sức bền và khả năng phân bổ thời gian cho cả hai kỹ năng.',
    collection: 'TOEIC bứt phá',
    type: 'FULL_TEST',
    durationSeconds: 7200,
    parts: parts(fullCounts),
    available: true,
  },
  {
    id: 'mini-test-01',
    title: '30 phút ôn luyện mỗi ngày',
    description: 'Một đề ngắn kết hợp nghe hội thoại và đọc trong môi trường công sở.',
    collection: 'TOEIC nền tảng',
    type: 'MINI_TEST',
    durationSeconds: 1800,
    parts: parts({ 2: 10, 3: 9, 5: 15, 7: 16 }, { 2: 240, 3: 360, 5: 450, 7: 750 }),
    available: true,
  },
  {
    id: 'mini-reading-01',
    title: 'Đọc hiểu nơi công sở',
    description: 'Tập trung vào từ vựng, cấu trúc câu, email và thông báo.',
    collection: 'TOEIC bứt phá',
    type: 'MINI_TEST',
    durationSeconds: 1800,
    parts: parts({ 5: 15, 6: 8, 7: 17 }),
    available: true,
  },
];
