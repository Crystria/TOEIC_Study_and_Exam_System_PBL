import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { writeOutbox } from '@toeic/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { SearchService } from '../search/search.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';
import { PresignMediaDto } from './dto/presign-media.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { assertQuestion, publicQuestion, questionInclude, QuestionRecord } from './question-rules';
import { contentTransaction } from './content-transaction';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
    private readonly media: MediaService,
  ) {}

  async list(query: ListQuestionsQueryDto, admin = false) {
    const result = await this.search.search(query);
    return {
      ...result,
      items: result.items.map((q) => publicQuestion(q, admin, (key) => this.media.url(key))),
    };
  }
  async record(id: string, tx: Prisma.TransactionClient = this.prisma): Promise<QuestionRecord> {
    const question = await tx.question.findFirst({
      where: { id, deletedAt: null },
      include: questionInclude,
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }
  async findById(id: string, admin = false) {
    return publicQuestion(await this.record(id), admin, (key) => this.media.url(key));
  }
  async findByIds(ids: string[]) {
    return this.prisma.question.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        OR: [{ groupId: null }, { group: { deletedAt: null } }],
      },
      include: questionInclude,
    });
  }
  async getAnswerKey(ids: string[]) {
    const questions = await this.findByIds(ids);
    return questions.map((q) => ({
      questionId: q.id,
      correctOption: q.correctOption,
      revision: q.updatedAt.toISOString(),
    }));
  }
  async create(dto: CreateQuestionDto, createdBy?: string) {
    const id = randomUUID();
    await contentTransaction(this.prisma, async (tx) =>
      this.createInTransaction(tx, id, dto, createdBy),
    );
    return this.findById(id, true);
  }
  async createInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    dto: CreateQuestionDto,
    createdBy?: string,
  ) {
    assertQuestion(dto);
    await this.validateGroup(tx, dto, id);
    await this.verifyMedia(id, dto);
    const { options, tags, ...fields } = dto;
    const q = await tx.question.create({
      data: {
        ...fields,
        id,
        createdBy,
        options: { create: options },
        tags: { create: this.tagCreates(tags ?? []) },
      },
    });
    await this.event(tx, q.id, 'QuestionCreatedEvent', q.part, q.difficulty, q.groupId);
    return q;
  }
  async update(id: string, dto: UpdateQuestionDto) {
    await contentTransaction(this.prisma, async (tx) => {
      const previous = await this.record(id, tx);
      const merged = { ...previous, ...dto };
      assertQuestion(merged);
      if (previous.part !== merged.part && (previous.audioKey || previous.imageKey))
        throw new BadRequestException('Clear media keys before changing part');
      await this.validateGroup(tx, merged, id);
      if (previous.groupId && previous.groupId !== merged.groupId)
        await this.assertNotLastMember(tx, previous.groupId);
      await this.verifyMedia(id, merged);
      const { options, tags, ...fields } = dto;
      if (options) await tx.questionOption.deleteMany({ where: { questionId: id } });
      if (tags) await tx.questionTag.deleteMany({ where: { questionId: id } });
      const q = await tx.question.update({
        where: { id },
        data: {
          ...fields,
          options: options ? { create: options } : undefined,
          tags: tags ? { create: this.tagCreates(tags) } : undefined,
        },
      });
      await this.event(tx, id, 'QuestionUpdatedEvent', q.part, q.difficulty, q.groupId);
      if (previous.groupId && previous.groupId !== q.groupId)
        await this.groupChanged(tx, previous.groupId);
    });
    return this.findById(id, true);
  }
  async remove(id: string) {
    await contentTransaction(this.prisma, async (tx) => {
      const q = await this.record(id, tx);
      if (q.groupId) await this.assertNotLastMember(tx, q.groupId);
      await tx.question.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.event(tx, id, 'QuestionDeletedEvent', q.part, q.difficulty, q.groupId);
    });
    return { success: true };
  }
  async presign(id: string, dto: PresignMediaDto, idempotencyKey?: string) {
    const q = await this.record(id);
    return this.media.presign('questions', q.part, id, dto, idempotencyKey);
  }
  private tagCreates(tags: string[]) {
    return [...new Set(tags.map((name) => name.trim()).filter(Boolean))].map((name) => ({
      tag: { connectOrCreate: { where: { name }, create: { name } } },
    }));
  }
  private async verifyMedia(
    id: string,
    q: { part: number; audioKey?: string | null; imageKey?: string | null },
  ) {
    const prefix = this.media.prefix('questions', q.part, id);
    await this.media.verify(q.audioKey, prefix, 'AUDIO');
    await this.media.verify(q.imageKey, prefix, 'IMAGE');
  }
  private async validateGroup(
    tx: Prisma.TransactionClient,
    q: Pick<CreateQuestionDto, 'part' | 'groupId' | 'positionInGroup'>,
    id: string,
  ) {
    if (!q.groupId) return;
    const group = await tx.questionGroup.findFirst({ where: { id: q.groupId, deletedAt: null } });
    if (!group || group.part !== q.part)
      throw new BadRequestException('Group must be active and match question part');
    const duplicate = await tx.question.findFirst({
      where: { groupId: q.groupId, positionInGroup: q.positionInGroup, NOT: { id } },
    });
    if (duplicate) throw new BadRequestException('positionInGroup already used');
    if (q.part === 6 && !group.passageText?.includes(`[[${q.positionInGroup}]]`))
      throw new BadRequestException('Part 6 position must match a passage placeholder');
  }
  private async assertNotLastMember(tx: Prisma.TransactionClient, groupId: string) {
    if ((await tx.question.count({ where: { groupId, deletedAt: null } })) <= 1)
      throw new BadRequestException(
        'Archive the group instead of removing its last active question',
      );
  }
  private async event(
    tx: Prisma.TransactionClient,
    id: string,
    eventType: string,
    part: number,
    difficulty: string,
    groupId: string | null,
  ) {
    await writeOutbox(tx as never, {
      aggregateType: 'Question',
      aggregateId: id,
      eventType,
      payload: { questionId: id, part, difficulty },
    });
    if (groupId) await this.groupChanged(tx, groupId);
  }
  private async groupChanged(tx: Prisma.TransactionClient, groupId: string) {
    const group = await tx.questionGroup.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
      include: { questions: { select: { id: true } } },
    });
    await writeOutbox(tx as never, {
      aggregateType: 'QuestionGroup',
      aggregateId: groupId,
      eventType: 'QuestionGroupUpdatedEvent',
      payload: {
        groupId,
        part: group.part,
        type: group.type,
        questionIds: group.questions.map((q) => q.id),
      },
    });
  }
}
