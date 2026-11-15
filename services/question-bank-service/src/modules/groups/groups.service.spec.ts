import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { GroupRecord } from '../questions/question-rules';
import { QuestionsService } from '../questions/questions.service';
import { GroupsService } from './groups.service';

describe('group ordering with archived questions', () => {
  function setup(part = 6, archivedTemporarySlot = false) {
    const now = new Date('2026-11-14T00:00:00Z');
    const question = (id: string, positionInGroup: number, archived = false) => ({
      id,
      part,
      groupId: 'group-id',
      positionInGroup,
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      correctOption: 'A',
      deletedAt: archived ? now : null,
      options: ['A', 'B', 'C', 'D'].map((optionCode) => ({
        questionId: id,
        optionCode,
        optionText: `Option ${optionCode}`,
      })),
    });
    const group = {
      id: 'group-id',
      part,
      type: 'PASSAGE',
      instruction: null,
      passageText: 'Passage [[1]] [[2]] [[3]]',
      audioKey: null,
      transcript: null,
      orderNo: 1,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      assets: [],
      questions: [question('first', 1), question('archived', 2, true), question('third', 3)],
    } as unknown as GroupRecord;
    if (archivedTemporarySlot)
      group.questions.push(
        question('old-negative-slot', -1, true) as GroupRecord['questions'][number],
      );

    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      questionGroup: {
        findFirst: jest.fn().mockImplementation(async () => group),
        update: jest.fn().mockImplementation(async ({ data }) => {
          Object.assign(
            group,
            Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
          );
          return group;
        }),
      },
      question: {
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const row = group.questions.find((q) => q.id === where.id)!;
          if (
            group.questions.some(
              (q) => q.id !== row.id && q.positionInGroup === data.positionInGroup,
            )
          )
            throw new Error('Unique group position violated');
          row.positionInGroup = data.positionInGroup;
          return row;
        }),
      },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(async (work) => work(tx)),
      questionGroup: tx.questionGroup,
    };
    const media = {
      prefix: jest.fn().mockReturnValue('groups/part-6/group-id/'),
      verify: jest.fn(),
      url: () => null,
    };
    const service = new GroupsService(
      prisma as unknown as PrismaService,
      {} as QuestionsService,
      media as unknown as MediaService,
    );
    return { service, group, tx, prisma };
  }

  it('reorders active members into their existing slots without moving an archived Part 6 question', async () => {
    const { service, group, tx, prisma } = setup();
    const result = await service.update(group.id, { questionOrder: ['third', 'first'] });

    expect(result.questionIds).toEqual(['third', 'first']);
    expect(group.questions.map((q) => [q.id, q.positionInGroup])).toEqual([
      ['first', 3],
      ['archived', 2],
      ['third', 1],
    ]);
    expect(group.passageText).toBe('Passage [[1]] [[2]] [[3]]');
    expect(result.isComplete).toBe(false);
    expect(tx.question.update).toHaveBeenCalledTimes(4);
    expect(tx.question.update.mock.calls.every(([args]) => args.where.id !== 'archived')).toBe(
      true,
    );
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 30_000 });
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('avoids temporary positions already occupied by archived members', async () => {
    const { service, tx } = setup(7, true);
    await expect(
      service.update('group-id', { questionOrder: ['third', 'first'] }),
    ).resolves.toMatchObject({
      questionIds: ['third', 'first'],
    });
    expect(
      tx.question.update.mock.calls.slice(0, 2).map(([args]) => args.data.positionInGroup),
    ).toEqual([-2, -3]);
  });

  it.each([
    { label: 'archived', order: ['first', 'archived', 'third'] },
    { label: 'foreign', order: ['first', 'another-group-question'] },
    { label: 'missing', order: ['first'] },
    { label: 'duplicate', order: ['first', 'first'] },
  ])('rejects $label IDs before any ordering mutation', async ({ order }) => {
    const { service, tx } = setup();
    await expect(service.update('group-id', { questionOrder: order })).rejects.toThrow(
      'questionOrder must contain every active group question exactly once',
    );
    expect(tx.question.update).not.toHaveBeenCalled();
    expect(tx.questionGroup.update).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
