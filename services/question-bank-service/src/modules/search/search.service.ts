import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, estypes } from '@elastic/elasticsearch';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { questionInclude, QuestionRecord } from '../questions/question-rules';
import { ListQuestionsQueryDto } from '../questions/dto/list-questions-query.dto';

@Injectable()
export class SearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: Client;
  private readonly index: string;
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.index = config.get<string>('QUESTION_SEARCH_INDEX') ?? 'questions-v2';
    this.client = new Client({
      node: config.get<string>('ELASTICSEARCH_NODE') ?? 'http://localhost:19200',
      requestTimeout: 2000,
      maxRetries: 0,
    });
  }
  async onModuleInit(): Promise<void> {
    try {
      if (!(await this.client.indices.exists({ index: this.index })))
        await this.client.indices.create({
          index: this.index,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              part: { type: 'integer' },
              type: { type: 'keyword' },
              questionText: { type: 'text' },
              transcript: { type: 'text' },
              explanation: { type: 'text' },
              groupText: { type: 'text' },
              difficulty: { type: 'keyword' },
              tags: { type: 'keyword' },
              groupId: { type: 'keyword' },
              deletedAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        });
    } catch (error) {
      this.logger.warn(`Elasticsearch degraded: ${(error as Error).message}`);
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
  async syncQuestion(id: string): Promise<void> {
    const q = await this.prisma.question.findUnique({ where: { id }, include: questionInclude });
    if (!q) return;
    const version = Math.max(
      q.updatedAt.getTime(),
      q.group?.updatedAt.getTime() ?? 0,
      q.deletedAt?.getTime() ?? 0,
    );
    // Keep a versioned tombstone to prevent old deliveries resurrecting an archived document.
    const deletedAt = q.deletedAt ?? q.group?.deletedAt;
    const document = deletedAt
      ? { id, deletedAt, updatedAt: q.updatedAt }
      : {
          id,
          part: q.part,
          type: q.type,
          questionText: q.questionText,
          transcript: q.transcript,
          explanation: q.explanation,
          difficulty: q.difficulty,
          tags: q.tags.map((t) => t.tag.name),
          groupId: q.groupId,
          groupText: [
            q.group?.passageText,
            q.group?.transcript,
            ...(q.group?.assets.map((a) => a.content) ?? []),
          ]
            .filter(Boolean)
            .join(' '),
          updatedAt: q.updatedAt,
          deletedAt: null,
        };
    try {
      await this.client.index({
        index: this.index,
        id,
        document,
        version,
        version_type: 'external_gte',
      });
    } catch (error) {
      if ((error as { meta?: { statusCode: number } }).meta?.statusCode !== 409) throw error;
    }
  }
  async syncGroup(id: string): Promise<void> {
    const questions = await this.prisma.question.findMany({
      where: { groupId: id },
      select: { id: true },
    });
    for (const q of questions) await this.syncQuestion(q.id);
  }
  async reindex() {
    let cursor: string | undefined,
      indexed = 0;
    while (true) {
      const batch = await this.prisma.question.findMany({
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true },
      });
      if (!batch.length) break;
      for (const q of batch) {
        await this.syncQuestion(q.id);
        indexed++;
      }
      cursor = batch[batch.length - 1].id;
    }
    return { indexed };
  }
  private where(query: ListQuestionsQueryDto): Prisma.QuestionWhereInput {
    const where: Prisma.QuestionWhereInput = {
      deletedAt: null,
      part: query.part,
      difficulty: query.difficulty,
      groupId: query.groupId,
      AND: [{ OR: [{ groupId: null }, { group: { deletedAt: null } }] }],
      ...(query.tag ? { tags: { some: { tag: { name: query.tag } } } } : {}),
    };
    if (query.keyword)
      where.OR = [
        { questionText: { contains: query.keyword, mode: 'insensitive' } },
        { transcript: { contains: query.keyword, mode: 'insensitive' } },
        { explanation: { contains: query.keyword, mode: 'insensitive' } },
        {
          group: {
            OR: [
              { passageText: { contains: query.keyword, mode: 'insensitive' } },
              { transcript: { contains: query.keyword, mode: 'insensitive' } },
              { assets: { some: { content: { contains: query.keyword, mode: 'insensitive' } } } },
            ],
          },
        },
      ];
    return where;
  }
  async search(query: ListQuestionsQueryDto): Promise<{
    items: QuestionRecord[];
    total: number;
    page: number;
    size: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1,
      size = Math.min(query.size ?? 20, 50);
    try {
      const filter: estypes.QueryDslQueryContainer[] = [];
      if (query.part !== undefined) filter.push({ term: { part: query.part } });
      if (query.difficulty) filter.push({ term: { difficulty: query.difficulty } });
      if (query.tag) filter.push({ term: { tags: query.tag } });
      if (query.groupId) filter.push({ term: { groupId: query.groupId } });
      const result = await this.client.search({
        index: this.index,
        from: (page - 1) * size,
        size,
        track_total_hits: true,
        query: {
          bool: {
            filter,
            must_not: [{ exists: { field: 'deletedAt' } }],
            must: query.keyword
              ? [
                  {
                    multi_match: {
                      query: query.keyword,
                      fields: ['questionText', 'transcript', 'explanation', 'groupText'],
                    },
                  },
                ]
              : [],
          },
        },
        sort: ['_score', { id: 'asc' }],
      });
      const ids = result.hits.hits.map((hit) => hit._id!).filter(Boolean);
      // Hydrate the current DB state; answer keys never enter the search response or index.
      const items = await this.prisma.question.findMany({
        where: { ...this.where({ ...query, keyword: undefined }), id: { in: ids } },
        include: questionInclude,
      });
      const positions = new Map(ids.map((id, i) => [id, i]));
      items.sort((a, b) => positions.get(a.id)! - positions.get(b.id)!);
      const total =
        typeof result.hits.total === 'number' ? result.hits.total : (result.hits.total?.value ?? 0);
      return { items, total, page, size, totalPages: Math.ceil(total / size) };
    } catch (error) {
      this.logger.warn(`Search falling back to PostgreSQL: ${(error as Error).message}`);
      const where = this.where(query);
      const [items, total] = await this.prisma.$transaction([
        this.prisma.question.findMany({
          where,
          include: questionInclude,
          skip: (page - 1) * size,
          take: size,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
        this.prisma.question.count({ where }),
      ]);
      return { items, total, page, size, totalPages: Math.ceil(total / size) };
    }
  }
}
