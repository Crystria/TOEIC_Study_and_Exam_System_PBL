import type { ExamQuery, ExamSelection, ExamTest, SelectionResult } from './types';

export function validateSelection(test: ExamTest, selection: ExamSelection): string | null {
  if (!test.available) return 'Đề này hiện không khả dụng. Vui lòng chọn đề khác.';
  if (
    !['PRACTICE', 'MOCK_TEST'].includes(selection.mode) ||
    !['full', 'parts'].includes(selection.scope)
  )
    return 'Chế độ hoặc phạm vi làm bài không hợp lệ.';
  const ids = selection.partIds;
  if (!ids.length) return 'Chọn ít nhất một Part trước khi tiếp tục.';
  if (
    ids.some((id) => !Number.isInteger(id) || id < 1 || id > 7) ||
    new Set(ids).size !== ids.length
  )
    return 'Danh sách Part phải gồm các số từ 1 đến 7 và không trùng lặp.';
  if (
    ids.some(
      (id) => !test.parts.some((part) => part.id === id && part.active && part.questionCount > 0),
    )
  )
    return 'Có Part không thuộc đề hoặc đã ngừng hoạt động. Vui lòng chọn lại.';
  if (
    selection.scope === 'full' &&
    (ids.length !== test.parts.length || test.parts.some((part) => !ids.includes(part.id)))
  )
    return 'Thi toàn bộ đề cần đủ tất cả Part của đề. Hãy chọn lại phạm vi, hệ thống không tự đổi lựa chọn.';
  if (test.type === 'FULL_TEST' && selection.scope === 'full' && test.parts.length !== 7)
    return 'Full Test chưa có đủ 7 Part. Vui lòng chọn đề khác.';
  return null;
}

export function parseSelection(
  query: ExamQuery,
  test: ExamTest,
  required = false,
): SelectionResult {
  const supplied = ['mode', 'scope', 'parts'].some((key) => query[key] !== undefined);
  if (!supplied && !required)
    return {
      ok: true,
      selection: { mode: 'MOCK_TEST', scope: 'full', partIds: test.parts.map((part) => part.id) },
    };
  const { mode, scope, parts } = query;
  if (
    (mode !== 'PRACTICE' && mode !== 'MOCK_TEST') ||
    (scope !== 'full' && scope !== 'parts') ||
    typeof parts !== 'string' ||
    !/^[1-7](,[1-7])*$/.test(parts)
  ) {
    return {
      ok: false,
      message:
        'Liên kết chưa có lựa chọn hợp lệ. Vui lòng chọn chế độ và Part từ trang chi tiết đề.',
    };
  }
  const selection: ExamSelection = { mode, scope, partIds: parts.split(',').map(Number) };
  const message = validateSelection(test, selection);
  return message ? { ok: false, message } : { ok: true, selection };
}

export function selectionQuery(selection: ExamSelection): string {
  return new URLSearchParams({
    mode: selection.mode,
    scope: selection.scope,
    parts: [...selection.partIds].sort((a, b) => a - b).join(','),
  }).toString();
}

export function summarizeSelection(test: ExamTest, selection: ExamSelection) {
  const error = validateSelection(test, selection);
  if (error) throw new Error(error);
  const selected = test.parts.filter((part) => selection.partIds.includes(part.id));
  const totalQuestions = test.parts.reduce((sum, part) => sum + part.questionCount, 0);
  const questionCount = selected.reduce((sum, part) => sum + part.questionCount, 0);
  const entireTest = selected.length === test.parts.length;
  const configured = selected.every(
    (part) => part.durationSeconds !== null && part.durationSeconds > 0,
  );
  const durationSource = entireTest ? 'test' : configured ? 'parts' : 'proportional';
  const durationSeconds = entireTest
    ? test.durationSeconds
    : configured
      ? selected.reduce((sum, part) => sum + part.durationSeconds!, 0)
      : Math.ceil((test.durationSeconds * questionCount) / totalQuestions);
  const listeningCount = selected
    .filter((part) => part.skill === 'LISTENING')
    .reduce((sum, part) => sum + part.questionCount, 0);
  return {
    selected,
    questionCount,
    durationSeconds,
    durationSource,
    listeningCount,
    readingCount: questionCount - listeningCount,
    toeicEligible:
      selection.mode === 'MOCK_TEST' &&
      entireTest &&
      listeningCount > 0 &&
      questionCount > listeningCount,
  };
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} phút${remainder ? ` ${remainder} giây` : ''}`;
}

export function filterTests(tests: ExamTest[], search: string, type: string, skill: string) {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  return tests.filter(
    (test) =>
      (type === 'all' || test.type === type) &&
      (skill === 'all' || test.parts.some((part) => part.skill === skill)) &&
      normalize(`${test.title} ${test.description} ${test.collection}`).includes(normalize(search)),
  );
}
