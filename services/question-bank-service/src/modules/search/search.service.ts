import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, estypes } from '@elastic/elasticsearch';

export interface QuestionSearchDoc {
  id: string;
  part: number;
  type: string;
  stem: string;
  explanation?: string;
  difficulty: string;
  tags: string[];
  status: string;
}

export interface SearchQuery {
  keyword?: string;
  part?: number;
  difficulty?: string;
  tag?: string;
  page?: number;
  size?: number;
}

/**
 * Search module (read-model) của Question Bank Service.
 * Sở hữu index Elasticsearch; cập nhật qua event QuestionCreated/Updated (xem SearchIndexer).
 */
@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: Client;
  private readonly index = 'questions';

  constructor(private readonly config: ConfigService) {
    this.client = new Client({
      node: config.get<string>('ELASTICSEARCH_NODE') ?? 'http://localhost:19200',
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: this.index });
      if (!exists) {
        await this.client.indices.create({
          index: this.index,
          mappings: {
            properties: {
              part: { type: 'integer' },
              type: { type: 'keyword' },
              stem: { type: 'text' },
              explanation: { type: 'text' },
              difficulty: { type: 'keyword' },
              tags: { type: 'keyword' },
              status: { type: 'keyword' },
            },
          },
        });
        this.logger.log(`Created index '${this.index}'`);
      }
    } catch (error) {
      this.logger.warn(`Elasticsearch not ready: ${(error as Error).message}`);
    }
  }

  async indexQuestion(doc: QuestionSearchDoc): Promise<void> {
    await this.client.index({ index: this.index, id: doc.id, document: doc, refresh: true });
  }

  async removeQuestion(id: string): Promise<void> {
    await this.client.delete({ index: this.index, id, refresh: true }).catch(() => undefined);
  }

  async search(query: SearchQuery) {
    const page = query.page ?? 1;
    const size = Math.min(query.size ?? 20, 50);
    const must: estypes.QueryDslQueryContainer[] = [];
    const filter: estypes.QueryDslQueryContainer[] = [];

    if (query.keyword) {
      must.push({ multi_match: { query: query.keyword, fields: ['stem', 'explanation'] } });
    }
    if (query.part !== undefined) {
      filter.push({ term: { part: query.part } });
    }
    if (query.difficulty) {
      filter.push({ term: { difficulty: query.difficulty } });
    }
    if (query.tag) {
      filter.push({ term: { tags: query.tag } });
    }

    const result = await this.client.search({
      index: this.index,
      from: (page - 1) * size,
      size,
      query: { bool: { must, filter } },
    });

    return {
      items: result.hits.hits.map((hit) => ({ id: hit._id, ...(hit._source as object) })),
      total: typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value ?? 0,
      page,
      size,
    };
  }
}
