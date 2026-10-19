import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsumedMessage, MessagingService } from '@toeic/common';
import { SearchService } from './search.service';

const CONSUMER_QUEUE = 'question-bank-search';

/**
 * Consumer cập nhật index Elasticsearch theo QuestionCreated/Updated.
 */
@Injectable()
export class SearchIndexer implements OnModuleInit {
  private readonly logger = new Logger(SearchIndexer.name);

  constructor(
    private readonly messaging: MessagingService,
    private readonly search: SearchService,
  ) {}

  async onModuleInit(): Promise<void> {
    const handler = async (message: ConsumedMessage) => {
      const event = JSON.parse(message.content.toString()) as {
        eventType: string;
        payload: { questionId: string; part: number; difficulty: string };
      };

      if (
        event.eventType === 'QuestionUpdatedEvent' ||
        event.eventType === 'QuestionCreatedEvent'
      ) {
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
    };

    await this.messaging.subscribe(
      CONSUMER_QUEUE,
      ['question.created', 'question.updated'],
      handler,
    );
    this.logger.log(`Search indexer listening on queue ${CONSUMER_QUEUE}`);
  }
}
