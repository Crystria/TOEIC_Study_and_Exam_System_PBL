import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTestDto } from './dto/create-test.dto';
import { ListTestsQueryDto } from './dto/list-tests-query.dto';
import { UpdateTestDto } from './dto/update-test.dto';

@Injectable()
export class TestsService {
  private readonly logger = new Logger(TestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTestsQueryDto) {
    const where: Prisma.TestWhereInput = {
      deletedAt: null,
      ...(query.keyword
        ? { title: { contains: query.keyword, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.test.findMany({
        where,
        include: { _count: { select: { questions: true, attempts: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.size,
        take: query.size,
      }),
      this.prisma.test.count({ where }),
    ]);

    return { items, total, page: query.page, size: query.size };
  }

  async findById(id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: { questions: { orderBy: { orderNo: 'asc' } } },
    });
    if (!test) {
      throw new NotFoundException('Test not found');
    }
    return test;
  }

  async create(dto: CreateTestDto, createdBy?: string) {
    const test = await this.prisma.test.create({
      data: {
        title: dto.title,
        durationSeconds: dto.durationSeconds,
        createdBy,
        questions: dto.questions?.length
          ? {
              create: dto.questions.map((q) => ({
                questionId: q.questionId,
                orderNo: q.orderNo,
                part: q.part,
              })),
            }
          : undefined,
      },
      include: { questions: { orderBy: { orderNo: 'asc' } } },
    });
    this.logger.log(`Created test ${test.id}`);
    return test;
  }

  async update(id: string, dto: UpdateTestDto) {
    await this.findById(id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.questions) {
        await tx.testQuestion.deleteMany({ where: { testId: id } });
      }

      return tx.test.update({
        where: { id },
        data: {
          title: dto.title,
          durationSeconds: dto.durationSeconds,
          questions: dto.questions
            ? {
                create: dto.questions.map((q) => ({
                  questionId: q.questionId,
                  orderNo: q.orderNo,
                  part: q.part,
                })),
              }
            : undefined,
        },
        include: { questions: { orderBy: { orderNo: 'asc' } } },
      });
    });
  }
}
