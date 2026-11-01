import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CurrentUser, RoleCode, Roles } from '@toeic/common';
import { Request } from 'express';
import { ContractPipe } from '../../http';
import { ProgressService } from './progress.service';
import { SessionService, SessionReview, QuizAnswer } from './session.service';
import { LearningMediaService } from './media.service';
import { ReviewQuery } from './queries';
@Controller('learning')
export class LearningController {
  constructor(
    private readonly progress: ProgressService,
    private readonly sessions: SessionService,
    private readonly media: LearningMediaService,
  ) {}
  @Get('review-today') due(@CurrentUser('sub') user: string, @Query() query: ReviewQuery) {
    return this.progress.due(user, query);
  }
  @Get('progress') summary(@CurrentUser('sub') user: string) {
    return this.progress.summary(user);
  }
  @Post('flashcards/:id/review') @HttpCode(200) review(
    @CurrentUser('sub') user: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ContractPipe('ReviewRequest'))
    body: { operationId: string; quality: number; baseEntityRevision: string },
  ) {
    return this.progress.review(user, id, body);
  }
  @Post('lessons/:id/complete') @HttpCode(200) complete(
    @CurrentUser('sub') user: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ContractPipe('CompleteLessonRequest'))
    body: { operationId: string; baseEntityRevision: string },
  ) {
    return this.progress.complete(user, id, body);
  }
  @Post('vocabulary-sessions') create(
    @CurrentUser('sub') user: string,
    @Headers('idempotency-key') key: string,
    @Body(new ContractPipe('SessionCreate')) body: { topicId: string; mode: 'NEW' | 'REVIEW' },
  ) {
    return this.sessions.create(user, body, key);
  }
  @Get('vocabulary-sessions/:id') session(
    @CurrentUser('sub') user: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sessions.get(user, id);
  }
  @Post('vocabulary-sessions/:id/reviews') @HttpCode(200) draft(
    @CurrentUser('sub') user: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ContractPipe('SessionDraft')) body: { reviews: SessionReview[] },
  ) {
    return this.sessions.draft(user, id, body.reviews);
  }
  @Post('vocabulary-sessions/:id/submit') @HttpCode(200) submit(
    @CurrentUser('sub') user: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ContractPipe('SessionSubmit'))
    body: { operationId: string; reviews: SessionReview[]; answers: QuizAnswer[] },
  ) {
    return this.sessions.submit(user, id, body);
  }
  @Post('vocabulary-sessions/:id/cancel') @HttpCode(200) cancel(
    @CurrentUser('sub') user: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.sessions.cancel(user, id);
  }
  @Roles(RoleCode.CONTENT_ADMIN) @Post('vocabularies/:id/media/presign') @HttpCode(200) presign(
    @CurrentUser('sub') user: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') key: string,
    @Body(new ContractPipe('VocabularyMediaPresignRequest'))
    body: { kind: 'AUDIO' | 'IMAGE'; contentType: string; sizeBytes: number },
  ) {
    return this.media.presign(user, id, key, body);
  }
  @Roles(RoleCode.CONTENT_ADMIN) @Post('vocabularies/:id/media/confirm') @HttpCode(200) confirm(
    @CurrentUser('sub') user: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') key: string,
    @Body(new ContractPipe('ConfirmUploadRequest')) body: { uploadId: string },
    @Req() req: Request,
  ) {
    return this.media.confirm(
      user,
      id,
      key,
      body.uploadId,
      String(req.res?.getHeader('X-Correlation-ID') || 'local'),
    );
  }
}
