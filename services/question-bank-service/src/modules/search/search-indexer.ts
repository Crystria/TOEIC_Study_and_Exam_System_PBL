import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '@toeic/common';
import { SearchService } from './search.service';

/**
 * Consumer outbox/Kafka cập nhật index Elasticsearch theo QuestionCreated/Updated.
 * Bản skeleton dùng Kafka trực tiếp; production có thể chuyển sang Debezium CDC.
 */
@Injectable()
export class SearchIndexer implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexer.name);

  constructor(
    private readonly kafka: KafkaService,
    private readonly search: SearchService,
  ) {}

  async onModuleInit(): Promise<void> {
    const handler = async (payload: { message: { value: Buffer | null } }) => {
      if (!payload.message.value) {
        return;
      }
      const event = JSON.parse(payload.message.value.toString()) as {
        eventType: string;
        payload: { questionId: string; part: number; difficulty: string };
      };
      try {
        if (event.eventType === 'QuestionUpdatedEvent' || event.eventType === 'QuestionCreatedEvent') {
          await this.search.indexQuestion({
            id: event.payload.questionId,
            part: event.payload.part,
            type: '',
            stem: '',
            difficulty: event.payload.difficulty,
            tags: [],
            status: 'PUBLISHED',
          });
        }
      } catch (error) {
        this.logger.error(`Index update failed: ${(error as Error).message}`);
      }
    };

    await this.kafka.subscribe('question.created', 'question-bank-search', handler);
    await this.kafka.subscribe('question.updated', 'question-bank-search', handler);
  }
}
