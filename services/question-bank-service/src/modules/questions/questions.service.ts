import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaService, writeOutbox } from '@toeic/common';
import { Client as MinioClient } from 'minio';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);
  private readonly minio: MinioClient;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
    private readonly kafka: KafkaService,
    private readonly config: ConfigService,
  ) {
    this.bucket = config.get<string>('MINIO_BUCKET') ?? 'toeic-media';
    this.minio = new MinioClient({
      endPoint: config.get<string>('MINIO_ENDPOINT')?.split(':')[0] ?? 'localhost',
      port: Number(config.get<string>('MINIO_ENDPOINT')?.split(':')[1] ?? 19000),
      useSSL: false,
      accessKey: config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey: config.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin',
    });
  }

  async list(query: ListQuestionsQueryDto) {
    return this.search.search({
      keyword: query.keyword,
      part: query.part,
      difficulty: query.difficulty,
      tag: query.tag,
      page: query.page,
      size: query.size,
    });
  }

  async findById(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { options: true, tags: { include: { tag: true } } },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  async findByIds(ids: string[]) {
    return this.prisma.question.findMany({
      where: { id: { in: ids } },
      include: { options: true },
    });
  }

  async getAnswerKey(ids: string[]) {
    const options = await this.prisma.questionOption.findMany({
      where: { questionId: { in: ids }, isCorrect: true },
      select: { questionId: true, optionKey: true },
    });
    return options.map((o) => ({ questionId: o.questionId, correctOption: o.optionKey }));
  }

  async create(dto: CreateQuestionDto, createdBy?: string) {
    const questionId = randomUUID();
    const question = await this.prisma.$transaction(async (tx) => {
      const created = await tx.question.create({
        data: {
          id: questionId,
          part: dto.part,
          type: dto.type,
          stem: dto.stem,
          explanation: dto.explanation,
          difficulty: dto.difficulty,
          mediaUrl: dto.mediaUrl,
          status: dto.status ?? 'DRAFT',
          createdBy,
          options: {
            create: dto.options.map((o) => ({
              optionKey: o.optionKey,
              content: o.content,
              mediaUrl: o.mediaUrl,
              isCorrect: o.isCorrect,
            })),
          },
          tags: {
            create: (dto.tags ?? []).map((name) => ({
              tag: { connectOrCreate: { where: { name }, create: { name } } },
            })),
          },
        },
        include: { options: true, tags: { include: { tag: true } } },
      });

      await writeOutbox(tx as never, {
        aggregateId: created.id,
        eventType: 'QuestionCreatedEvent',
        payload: { questionId: created.id, part: created.part, difficulty: created.difficulty },
      });
      return created;
    });

    await this.kafka.emit('question.created', question.id, {
      eventId: randomUUID(),
      eventType: 'QuestionCreatedEvent',
      occurredAt: Date.now(),
      payload: { questionId: question.id, part: question.part, difficulty: question.difficulty },
    });
    await this.reindex(question.id);
    return question;
  }

  async update(id: string, dto: UpdateQuestionDto) {
    await this.findById(id);
    const question = await this.prisma.$transaction(async (tx) => {
      if (dto.options) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
      }
      const updated = await tx.question.update({
        where: { id },
        data: {
          part: dto.part,
          type: dto.type,
          stem: dto.stem,
          explanation: dto.explanation,
          difficulty: dto.difficulty,
          mediaUrl: dto.mediaUrl,
          status: dto.status,
          options: dto.options
            ? {
                create: dto.options.map((o) => ({
                  optionKey: o.optionKey,
                  content: o.content,
                  mediaUrl: o.mediaUrl,
                  isCorrect: o.isCorrect,
                })),
              }
            : undefined,
        },
        include: { options: true, tags: { include: { tag: true } } },
      });

      await writeOutbox(tx as never, {
        aggregateId: id,
        eventType: 'QuestionUpdatedEvent',
        payload: { questionId: id, part: updated.part, difficulty: updated.difficulty },
      });
      return updated;
    });

    await this.kafka.emit('question.updated', id, {
      eventId: randomUUID(),
      eventType: 'QuestionUpdatedEvent',
      occurredAt: Date.now(),
      payload: { questionId: id, part: question.part, difficulty: question.difficulty },
    });
    await this.reindex(id);
    return question;
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.question.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await this.search.removeQuestion(id);
    return { success: true };
  }

  async presign(fileName: string, contentType: string) {
    const objectName = `${Date.now()}-${fileName}`;
    const url = await this.minio.presignedPutObject(this.bucket, objectName, 15 * 60);
    return { uploadUrl: url, objectName, bucket: this.bucket, contentType };
  }

  private async reindex(id: string): Promise<void> {
    try {
      const question = await this.findById(id);
      await this.search.indexQuestion({
        id: question.id,
        part: question.part,
        type: question.type,
        stem: question.stem,
        explanation: question.explanation ?? undefined,
        difficulty: question.difficulty,
        tags: question.tags.map((t) => t.tag.name),
        status: question.status,
      });
    } catch (error) {
      this.logger.warn(`Reindex failed for ${id}: ${(error as Error).message}`);
    }
  }
}
