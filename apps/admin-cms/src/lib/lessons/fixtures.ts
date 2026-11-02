import type { LessonSummary } from './types';

// Original CMS summaries. Category labels illustrate Word's field, not a confirmed taxonomy.
// No student fixture, Markdown body, publication status, level or progress is included.
export const LESSON_FIXTURES: readonly LessonSummary[] = [
  { id: 'demo-lesson-001', title: 'Hiện tại đơn trong email công việc', category: 'Thì động từ' },
  {
    id: 'demo-lesson-002',
    title: 'Hiện tại tiếp diễn khi mô tả hoạt động',
    category: 'Thì động từ',
  },
  { id: 'demo-lesson-003', title: 'Quá khứ đơn trong báo cáo công việc', category: 'Thì động từ' },
  {
    id: 'demo-lesson-004',
    title: 'Hiện tại hoàn thành và kết quả công việc',
    category: 'Thì động từ',
  },
  { id: 'demo-lesson-005', title: 'Danh từ đếm được và không đếm được', category: 'Từ loại' },
  { id: 'demo-lesson-006', title: 'Vị trí tính từ trong cụm danh từ', category: 'Từ loại' },
  { id: 'demo-lesson-007', title: 'Trạng từ trong thông báo công việc', category: 'Từ loại' },
  { id: 'demo-lesson-008', title: 'Đại từ thay thế trong văn bản', category: 'Từ loại' },
  {
    id: 'demo-lesson-009',
    title: 'Câu bị động trong quy trình làm việc',
    category: 'Cấu trúc câu',
  },
  { id: 'demo-lesson-010', title: 'Mệnh đề quan hệ trong email', category: 'Cấu trúc câu' },
  {
    id: 'demo-lesson-011',
    title: 'Câu điều kiện trong đề xuất công việc',
    category: 'Cấu trúc câu',
  },
  {
    id: 'demo-lesson-012',
    title: 'Cấu trúc so sánh trong lựa chọn dịch vụ',
    category: 'Cấu trúc câu',
  },
  { id: 'demo-lesson-013', title: 'Giới từ chỉ thời gian trong lịch hẹn', category: 'Liên kết ý' },
  { id: 'demo-lesson-014', title: 'Giới từ chỉ nơi chốn tại văn phòng', category: 'Liên kết ý' },
  { id: 'demo-lesson-015', title: 'Liên từ nối các ý trong báo cáo', category: 'Liên kết ý' },
  { id: 'demo-lesson-016', title: 'Từ nối chỉ nguyên nhân và kết quả', category: 'Liên kết ý' },
  { id: 'demo-lesson-017', title: 'Hòa hợp chủ ngữ và động từ', category: null },
  { id: 'demo-lesson-018', title: null, category: null },
];

export const LESSON_CATEGORIES = [
  ...new Set(LESSON_FIXTURES.flatMap((item) => (item.category ? [item.category] : []))),
];
