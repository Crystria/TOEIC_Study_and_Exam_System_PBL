import { BadRequestException } from '@nestjs/common';
import { JwtPayload, RoleCode } from '@toeic/common';
import { Prisma } from '../../generated/prisma';

export const questionInclude = {
  options: { orderBy: { optionCode: 'asc' as const } },
  tags: { include: { tag: true } },
  group: {
    include: {
      assets: { orderBy: { orderNo: 'asc' as const } },
      questions: { include: { options: true } },
    },
  },
} satisfies Prisma.QuestionInclude;
export type QuestionRecord = Prisma.QuestionGetPayload<{ include: typeof questionInclude }>;
export type GroupRecord = NonNullable<QuestionRecord['group']>;
export const groupedParts = [3, 4, 6, 7];
export function isContentAdmin(user: JwtPayload): boolean {
  return user.roles.some((r) => r === RoleCode.CONTENT_ADMIN || r === RoleCode.SYSTEM_ADMIN);
}
const text = (value?: string | null) => Boolean(value?.trim());

export interface QuestionShape {
  type: string;
  part: number;
  correctOption: string;
  difficulty: string;
  groupId?: string | null;
  positionInGroup?: number | null;
  questionText?: string | null;
  audioKey?: string | null;
  imageKey?: string | null;
  transcript?: string | null;
  deletedAt?: Date | null;
  options: { optionCode: string; optionText: string }[];
}

export function questionErrors(q: QuestionShape): string[] {
  const errors: string[] = [];
  if (typeof q.type !== 'string' || !q.type.trim()) errors.push('type is required');
  if (!Number.isInteger(q.part) || q.part < 1 || q.part > 7) errors.push('part must be 1-7');
  if (!['EASY', 'MEDIUM', 'HARD'].includes(q.difficulty)) errors.push('invalid difficulty');
  const expected = q.part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
  const codes = q.options?.map((o) => o.optionCode) ?? [];
  if (
    codes.length !== expected.length ||
    !expected.every((code) => codes.filter((c) => c === code).length === 1)
  )
    errors.push('invalid option codes for part');
  if (!q.options?.every((o) => text(o.optionText))) errors.push('option text is required');
  if (!codes.includes(q.correctOption)) errors.push('correctOption must belong to options');
  if (groupedParts.includes(q.part)) {
    if (!q.groupId || !Number.isInteger(q.positionInGroup) || (q.positionInGroup ?? 0) < 1)
      errors.push('groupId and positive positionInGroup required');
  } else if (q.groupId || q.positionInGroup != null) errors.push('part does not allow a group');
  return errors;
}

export function assertQuestion(q: QuestionShape): void {
  const errors = questionErrors(q);
  if (errors.length)
    throw new BadRequestException({ message: 'Invalid question', details: errors });
}

export function groupErrors(group: GroupRecord): string[] {
  const errors: string[] = [];
  if (group.deletedAt) errors.push('group archived');
  if (!groupedParts.includes(group.part)) errors.push('invalid group part');
  if (!group.questions.length) errors.push('group has no questions');
  if (
    group.questions.some(
      (q) =>
        q.deletedAt || q.part !== group.part || q.groupId !== group.id || questionErrors(q).length,
    )
  )
    errors.push('group contains archived or invalid questions');
  const positions = group.questions.map((q) => q.positionInGroup);
  if (new Set(positions).size !== positions.length) errors.push('duplicate group position');
  if ([3, 4].includes(group.part) && (!text(group.audioKey) || !text(group.transcript)))
    errors.push('group audio and transcript required');
  if (group.part === 6) {
    const placeholders = [...(group.passageText ?? '').matchAll(/\[\[(\d+)\]\]/g)].map((match) =>
      Number(match[1]),
    );
    if (
      !text(group.passageText) ||
      placeholders.length !== positions.length ||
      new Set(placeholders).size !== placeholders.length ||
      !positions.every((p) => placeholders.includes(p ?? 0))
    )
      errors.push('Part 6 placeholders must match question positions');
  }
  if (
    group.part === 7 &&
    !text(group.passageText) &&
    !group.assets.some((a) => (a.kind === 'TEXT' ? text(a.content) : text(a.storageKey)))
  )
    errors.push('Part 7 passage or asset required');
  return errors;
}

export function isComplete(q: QuestionRecord): boolean {
  if (q.deletedAt || questionErrors(q).length) return false;
  if (groupedParts.includes(q.part))
    return Boolean(q.group && q.group.part === q.part && !groupErrors(q.group).length);
  if (q.part === 1) return text(q.audioKey) && text(q.imageKey) && text(q.transcript);
  if (q.part === 2) return text(q.audioKey) && text(q.transcript);
  return text(q.questionText);
}

export function publicQuestion(
  q: QuestionRecord,
  admin: boolean,
  url: (key: string | null) => string | null,
) {
  return {
    questionId: q.id,
    part: q.part,
    type: q.type,
    questionText: q.questionText,
    explanation: admin ? q.explanation : undefined,
    transcript: admin ? q.transcript : undefined,
    difficulty: q.difficulty,
    groupId: q.groupId,
    positionInGroup: q.positionInGroup,
    audioKey: q.audioKey,
    imageKey: q.imageKey,
    audioUrl: url(q.audioKey),
    imageUrl: url(q.imageKey),
    ...(admin ? { correctOption: q.correctOption } : {}),
    options: q.options,
    tags: q.tags.map((t) => t.tag.name),
    isComplete: isComplete(q),
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}
