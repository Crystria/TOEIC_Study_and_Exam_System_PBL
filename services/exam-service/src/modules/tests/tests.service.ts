import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { QuestionBankClient } from '../../grpc/question-bank.client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTestDto } from './dto/create-test.dto';
import { ListTestsQueryDto } from './dto/list-tests-query.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { assertBundle, fullStructureErrors } from './test-rules';

@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bank: QuestionBankClient,
  ) {}
  async list(query: ListTestsQueryDto, admin = false) {
    if (query.includeDeleted && !admin)
      throw new ForbiddenException('includeDeleted requires an admin role');
    const where: Prisma.TestWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.keyword ? { title: { contains: query.keyword, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.test.findMany({
        where,
        include: { _count: { select: { questions: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.size,
        take: query.size,
      }),
      this.prisma.test.count({ where }),
    ]);
    return {
      items: items.map((t) => ({
        testId: t.id,
        title: t.title,
        durationSeconds: t.durationSeconds,
        createdAt: t.createdAt,
        deletedAt: t.deletedAt,
        totalQuestions: t._count.questions,
      })),
      total,
      page: query.page,
      size: query.size,
      totalPages: Math.ceil(total / query.size),
    };
  }
  async record(id: string, tx: Prisma.TransactionClient = this.prisma, includeDeleted = false) {
    const test = await tx.test.findFirst({
      where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
      include: { questions: { orderBy: { orderNo: 'asc' } } },
    });
    if (!test) throw new NotFoundException('Test not found');
    return test;
  }
  async findById(id: string, admin = false) {
    const t = await this.record(id, this.prisma, admin);
    return {
      testId: t.id,
      title: t.title,
      durationSeconds: t.durationSeconds,
      deletedAt: t.deletedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      questions: t.questions.map(({ questionId, orderNo, part }) => ({
        questionId,
        orderNo,
        part,
      })),
    };
  }
  private async validate(dto: CreateTestDto) {
    const errors = fullStructureErrors(dto.questions ?? [], dto.durationSeconds);
    if (!dto.title?.trim()) errors.push('Title is required');
    if (errors.length)
      throw new BadRequestException({ message: 'Invalid Full test', details: errors });
    assertBundle(
      dto.questions,
      await this.bank.getQuestionBundle(dto.questions.map((q) => q.questionId)),
    );
  }
  async create(dto: CreateTestDto, createdBy?: string) {
    await this.validate(dto);
    const t = await this.prisma.test.create({
      data: {
        title: dto.title.trim(),
        durationSeconds: dto.durationSeconds,
        createdBy,
        questions: { create: dto.questions },
      },
    });
    return this.findById(t.id, true);
  }
  async update(id: string, dto: UpdateTestDto) {
    if (dto.title === null || dto.durationSeconds === null || dto.questions === null)
      throw new BadRequestException('Required test fields cannot be null');
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT test_id FROM tests WHERE test_id = ${id} FOR UPDATE`;
        const t = await this.record(id, tx);
        await this.validate({
          title: dto.title ?? t.title,
          durationSeconds: dto.durationSeconds ?? t.durationSeconds,
          questions: dto.questions ?? t.questions,
        });
        if (dto.questions) await tx.testQuestion.deleteMany({ where: { testId: id } });
        await tx.test.update({
          where: { id },
          data: {
            title: dto.title,
            durationSeconds: dto.durationSeconds,
            questions: dto.questions ? { create: dto.questions } : undefined,
          },
        });
      },
      { timeout: 20_000 },
    );
    return this.findById(id, true);
  }
  async remove(id: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT test_id FROM tests WHERE test_id = ${id} FOR UPDATE`;
      await this.record(id, tx);
      await tx.test.update({ where: { id }, data: { deletedAt: new Date() } });
    });
    return { success: true };
  }
}
