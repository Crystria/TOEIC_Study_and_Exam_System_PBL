import { ConflictException } from '@nestjs/common';
import { AnswerBundle, QuestionBundle } from '../../grpc/question-bank.client';

export interface TestItem {
  questionId: string;
  part: number;
  orderNo: number;
}
const grouped = [3, 4, 6, 7];
export function fullStructureErrors(items: TestItem[], duration: number): string[] {
  const errors: string[] = [];
  if (duration !== 7200) errors.push('Full tests require 7200 seconds');
  if (items.length !== 200) errors.push('Full tests require 200 questions');
  if (new Set(items.map((q) => q.questionId)).size !== items.length)
    errors.push('Duplicate question IDs');
  const ordered = [...items].sort((a, b) => a.orderNo - b.orderNo);
  if (ordered.some((q, i) => q.orderNo !== i + 1))
    errors.push('Positions must be consecutive from 1');
  if ([1, 2, 3, 4, 5, 6, 7].some((p) => !items.some((q) => q.part === p)))
    errors.push('All seven parts are required');
  if (
    items.filter((q) => q.part <= 4).length !== 100 ||
    items.filter((q) => q.part >= 5).length !== 100
  )
    errors.push('Exactly 100 Listening and 100 Reading questions are required');
  if (
    ordered.some(
      (q, i) =>
        !Number.isInteger(q.part) ||
        q.part < 1 ||
        q.part > 7 ||
        (i > 0 && q.part < ordered[i - 1].part),
    )
  )
    errors.push('Parts must be 1-7 and in order');
  return errors;
}
export function bundleErrors(
  items: TestItem[],
  bundle: QuestionBundle,
  key?: AnswerBundle,
): string[] {
  const errors: string[] = [];
  const questions = new Map(bundle.questions.map((q) => [q.id, q]));
  const groups = new Map(bundle.groups.map((g) => [g.group_id, g]));
  const answers = new Map(key?.answers.map((a) => [a.question_id, a]));
  if (new Set(items.map((q) => q.questionId)).size !== items.length)
    errors.push('Duplicate question IDs');
  if (bundle.missing_ids.length || key?.missing_ids.length)
    errors.push('Question Bank reported missing questions');
  for (const item of items) {
    const q = questions.get(item.questionId);
    const prefix = `Question ${item.questionId}: `;
    if (!q) {
      errors.push(prefix + 'missing or archived');
      continue;
    }
    if (!q.is_complete || q.part !== item.part) errors.push(prefix + 'incomplete or part mismatch');
    const expected = q.part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
    const codes = (q.options ?? []).map((o) => o.option_key);
    if (
      codes.length !== expected.length ||
      !expected.every((c) => codes.filter((code) => code === c).length === 1) ||
      !q.options.every((o) => o.content.trim())
    )
      errors.push(prefix + 'invalid options');
    if (key) {
      const answer = answers.get(q.id);
      if (!answer || !codes.includes(answer.correct_option))
        errors.push(prefix + 'invalid or missing answer key');
      if (!q.revision || q.revision !== answer?.revision)
        errors.push(prefix + 'content changed while snapshotting; retry start');
    }
    if (grouped.includes(q.part)) {
      const g = groups.get(q.group_id);
      if (!g || g.part !== q.part || !g.question_ids.includes(q.id) || q.position_in_group < 1) {
        errors.push(prefix + 'invalid group membership');
        continue;
      }
      const members = bundle.questions.filter(
        (m) => m.group_id === g.group_id && items.some((i) => i.questionId === m.id),
      );
      if (
        !g.question_ids.length ||
        g.question_ids.length !== members.length ||
        !g.question_ids.every((id) => members.some((m) => m.id === id))
      )
        errors.push(prefix + 'test must include every group member');
      if (new Set(members.map((m) => m.position_in_group)).size !== members.length)
        errors.push(prefix + 'duplicate group positions');
      if ([3, 4].includes(q.part) && (!g.audio_key?.trim() || !g.transcript?.trim()))
        errors.push(prefix + 'group audio/transcript required');
      if (q.part === 6) {
        const slots = [...(g.passage_text ?? '').matchAll(/\[\[(\d+)\]\]/g)].map((m) =>
          Number(m[1]),
        );
        if (
          !slots.length ||
          new Set(slots).size !== slots.length ||
          slots.length !== members.length ||
          !members.every((m) => slots.includes(m.position_in_group))
        )
          errors.push(prefix + 'Part 6 placeholders mismatch');
      }
      if (
        q.part === 7 &&
        !g.passage_text?.trim() &&
        !g.assets?.some((a) => (a.kind === 'TEXT' ? a.content?.trim() : a.storage_key?.trim()))
      )
        errors.push(prefix + 'Part 7 passage required');
    } else {
      if (q.group_id) errors.push(prefix + 'part does not allow a group');
      if ([1, 2].includes(q.part) && (!q.audio_key?.trim() || !q.transcript?.trim()))
        errors.push(prefix + 'audio/transcript required');
      if (q.part === 1 && !q.image_key?.trim()) errors.push(prefix + 'image required');
      if (q.part === 5 && !(q.question_text || q.stem)?.trim())
        errors.push(prefix + 'question text required');
    }
  }
  return [...new Set(errors)];
}
export function assertBundle(items: TestItem[], bundle: QuestionBundle, key?: AnswerBundle): void {
  const errors = bundleErrors(items, bundle, key);
  if (errors.length)
    throw new ConflictException({ message: 'Test content is not available', details: errors });
}
