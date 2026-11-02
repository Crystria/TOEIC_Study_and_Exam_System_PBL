import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsumedMessage, MessagingService } from '@toeic/common';
import { SearchService } from './search.service';

@Injectable()
export class SearchIndexer implements OnModuleInit {
  constructor(
    private readonly messaging: MessagingService,
    private readonly search: SearchService,
    private readonly config: ConfigService,
  ) {}
  async handle(message: ConsumedMessage): Promise<void> {
    const event = JSON.parse(message.content.toString()) as {
      eventType: string;
      payload: { questionId?: string; groupId?: string };
    };
    if (event.eventType.startsWith('QuestionGroup') && event.payload.groupId)
      await this.search.syncGroup(event.payload.groupId);
    else if (event.eventType.startsWith('Question') && event.payload.questionId)
      await this.search.syncQuestion(event.payload.questionId);
    else throw new Error('Invalid question search event');
  }
  async onModuleInit(): Promise<void> {
    await this.messaging.subscribe(
      this.config.get<string>('QUESTION_SEARCH_QUEUE') ?? 'question-bank-search',
      [
        'question.created',
        'question.updated',
        'question.deleted',
        'question-group.created',
        'question-group.updated',
        'question-group.deleted',
      ],
      (message) => this.handle(message),
    );
  }
}
