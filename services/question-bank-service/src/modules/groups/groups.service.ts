import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { writeOutbox } from '@toeic/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { QuestionsService } from '../questions/questions.service';
import { contentTransaction } from '../questions/content-transaction';
import { groupErrors, GroupRecord } from '../questions/question-rules';
import { PresignMediaDto } from '../questions/dto/presign-media.dto';
import { CreateGroupDto, ListGroupsDto, UpdateGroupDto, GroupAssetDto } from './group.dto';

const include = {
  assets: { orderBy: { orderNo: 'asc' as const } },
  questions: { include: { options: true } },
};
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
    private readonly media: MediaService,
  ) {}
  async record(id: string, tx: Prisma.TransactionClient = this.prisma): Promise<GroupRecord> {
    const group = await tx.questionGroup.findFirst({ where: { id, deletedAt: null }, include });
    if (!group) throw new NotFoundException('Question group not found');
    return group;
  }
  private view(g: GroupRecord, admin: boolean) {
    return {
      groupId: g.id,
      part: g.part,
      type: g.type,
      instruction: g.instruction,
      audioKey: g.audioKey,
      audioUrl: this.media.url(g.audioKey),
      transcript: admin ? g.transcript : undefined,
      passageText: g.passageText,
      orderNo: g.orderNo,
      assets: g.assets.map((a) => ({
        assetId: a.id,
        kind: a.kind,
        content: a.content,
        storageKey: a.storageKey,
        orderNo: a.orderNo,
        publicUrl: this.media.url(a.storageKey),
      })),
      questionIds: g.questions
        .filter((q) => !q.deletedAt)
        .sort((a, b) => (a.positionInGroup ?? 0) - (b.positionInGroup ?? 0))
        .map((q) => q.id),
      isComplete: groupErrors(g).length === 0,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }
  async findById(id: string, admin = false) {
    return this.view(await this.record(id), admin);
  }
  async list(query: ListGroupsDto, admin = false) {
    const page = query.page ?? 1,
      size = Math.min(query.size ?? 20, 50);
    const where: Prisma.QuestionGroupWhereInput = {
      deletedAt: null,
      part: query.part,
      ...(query.keyword
        ? {
            OR: ['instruction', 'passageText', 'transcript'].map((field) => ({
              [field]: { contains: query.keyword, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const [groups, total] = await this.prisma.$transaction([
      this.prisma.questionGroup.findMany({
        where,
        include,
        orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.questionGroup.count({ where }),
    ]);
    return {
      items: groups.map((g) => this.view(g, admin)),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    };
  }
  async create(dto: CreateGroupDto, userId?: string) {
    const id = randomUUID();
    await contentTransaction(this.prisma, async (tx) => {
      const { questions, assets = [], ...fields } = dto;
      if (!questions?.length)
        throw new BadRequestException('Group must contain at least one question');
      await this.verifyMedia(id, { ...fields, assets });
      await tx.questionGroup.create({ data: { id, ...fields, assets: { create: assets } } });
      for (const [index, question] of questions.entries()) {
        if (question.part !== dto.part || (question.groupId && question.groupId !== id))
          throw new BadRequestException('Nested question must match group part');
        await this.questions.createInTransaction(
          tx,
          randomUUID(),
          { ...question, groupId: id, positionInGroup: question.positionInGroup ?? index + 1 },
          userId,
        );
      }
      const group = await this.record(id, tx);
      this.validateContent(group);
      await this.event(tx, group, 'QuestionGroupCreatedEvent');
    });
    return this.findById(id, true);
  }
  async update(id: string, dto: UpdateGroupDto) {
    await contentTransaction(this.prisma, async (tx) => {
      const old = await this.record(id, tx);
      if (dto.part !== undefined && dto.part !== old.part)
        throw new BadRequestException('Group part cannot change while it has questions');
      const { assets, questionOrder, ...fields } = dto;
      await this.verifyMedia(id, { ...old, ...fields, assets: assets ?? old.assets });
      if (questionOrder) {
        if (
          questionOrder.length !== old.questions.length ||
          new Set(questionOrder).size !== questionOrder.length ||
          !old.questions.every((q) => questionOrder.includes(q.id))
        )
          throw new BadRequestException(
            'questionOrder must contain every group question exactly once',
          );
        // Temporary negative positions make swapping unique positions safe in one transaction.
        for (const [index, questionId] of questionOrder.entries())
          await tx.question.update({
            where: { id: questionId },
            data: { positionInGroup: -(index + 1) },
          });
        for (const [index, questionId] of questionOrder.entries())
          await tx.question.update({
            where: { id: questionId },
            data: { positionInGroup: index + 1 },
          });
      }
      if (assets) await tx.questionGroupAsset.deleteMany({ where: { groupId: id } });
      const group = await tx.questionGroup.update({
        where: { id },
        data: { ...fields, updatedAt: new Date(), assets: assets ? { create: assets } : undefined },
        include,
      });
      this.validateContent(group);
      await this.event(tx, group, 'QuestionGroupUpdatedEvent');
    });
    return this.findById(id, true);
  }
  async remove(id: string) {
    await contentTransaction(this.prisma, async (tx) => {
      const group = await this.record(id, tx),
        deletedAt = new Date();
      await tx.questionGroup.update({ where: { id }, data: { deletedAt } });
      await tx.question.updateMany({
        where: { groupId: id, deletedAt: null },
        data: { deletedAt, updatedAt: deletedAt },
      });
      await this.event(tx, group, 'QuestionGroupDeletedEvent');
    });
    return { success: true };
  }
  async presign(id: string, dto: PresignMediaDto, idempotencyKey?: string) {
    const group = await this.record(id);
    return this.media.presign('groups', group.part, id, dto, idempotencyKey);
  }
  private validateContent(group: GroupRecord) {
    if (!group.type?.trim()) throw new BadRequestException('Group type is required');
    const errors = groupErrors(group).filter(
      (e) =>
        e !== 'group audio and transcript required' &&
        e !== 'group contains archived or invalid questions',
    );
    if ([3, 4].includes(group.part) && !group.transcript?.trim())
      errors.push('group transcript required');
    if (errors.length) throw new BadRequestException({ message: 'Invalid group', details: errors });
  }
  private async verifyMedia(
    id: string,
    g: { part: number; audioKey?: string | null; assets: GroupAssetDto[] },
  ) {
    if (!Array.isArray(g.assets)) throw new BadRequestException('assets must be an array');
    const prefix = this.media.prefix('groups', g.part, id);
    await this.media.verify(g.audioKey, prefix, 'AUDIO');
    if (new Set(g.assets.map((a) => a.orderNo)).size !== g.assets.length)
      throw new BadRequestException('Asset orderNo must be unique');
    for (const asset of g.assets) {
      if (asset.kind === 'TEXT') {
        if (!asset.content?.trim() || asset.storageKey)
          throw new BadRequestException('TEXT asset requires content and no storageKey');
      } else {
        if (!asset.storageKey || asset.content)
          throw new BadRequestException('Media asset requires storageKey and no content');
        await this.media.verify(asset.storageKey, prefix, asset.kind);
      }
    }
  }
  private async event(tx: Prisma.TransactionClient, group: GroupRecord, eventType: string) {
    await writeOutbox(tx as never, {
      aggregateType: 'QuestionGroup',
      aggregateId: group.id,
      eventType,
      payload: {
        groupId: group.id,
        part: group.part,
        type: group.type,
        orderNo: group.orderNo,
        questionIds: group.questions.map((q) => q.id),
      },
    });
  }
}
