import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@toeic/common';
import { ContractPipe } from '../../http';
import {
  FlashcardSessionCreate,
  FlashcardSessionService,
  FlashcardSessionSubmit,
} from './flashcard-session.service';
import { SessionReview } from './session.service';

@Controller('learning/flashcard-sessions')
export class FlashcardSessionController {
  constructor(private readonly sessions: FlashcardSessionService) {}

  @Post() create(
    @CurrentUser('sub') userId: string,
    @Headers('idempotency-key') key: string,
    @Body(new ContractPipe('FlashcardSessionCreate')) body: FlashcardSessionCreate,
  ) {
    return this.sessions.create(userId, body, key);
  }

  @Get(':id') get(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sessions.get(userId, id);
  }

  @Post(':id/reviews') @HttpCode(200) review(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ContractPipe('FlashcardSessionDraft')) body: { reviews: SessionReview[] },
  ) {
    return this.sessions.review(userId, id, body.reviews);
  }

  @Post(':id/submit') @HttpCode(200) submit(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ContractPipe('FlashcardSessionSubmit')) body: FlashcardSessionSubmit,
  ) {
    return this.sessions.submit(userId, id, body);
  }

  @Post(':id/cancel') @HttpCode(200) cancel(
    @CurrentUser('sub') userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sessions.cancel(userId, id);
  }
}
