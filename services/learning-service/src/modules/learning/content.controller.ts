import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CurrentUser, RoleCode, Roles } from '@toeic/common';
import { Request } from 'express';
import { ContractPipe } from '../../http';
import { ContentService } from './content.service';
import {
  ContentInput,
  SearchQuery,
  VocabularyQuery,
  LessonQuery,
  AdminLessonQuery,
} from './queries';
function cid(req: Request) {
  return String(req.res?.getHeader('X-Correlation-ID') || 'local');
}
@Roles(RoleCode.CONTENT_ADMIN)
@Controller('learning/admin')
export class ContentAdminController {
  constructor(private readonly content: ContentService) {}
  @Get('vocabulary-topics') listtopics(@Query() q: SearchQuery) {
    return this.content.list('topics', q, true);
  }
  @Get('vocabulary-topics/:id') async gettopics(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.present('topics', await this.content.get('topics', id, true));
  }
  @Post('vocabulary-topics') createtopics(
    @CurrentUser('sub') actor: string,
    @Headers('idempotency-key') key: string,
    @Body(new ContractPipe('TopicCreate')) body: ContentInput,
    @Req() req: Request,
  ) {
    return this.content.create('topics', body, actor, key, cid(req));
  }
  @Patch('vocabulary-topics/:id') patchtopics(
    @CurrentUser('sub') actor: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ContractPipe('TopicCreate')) body: ContentInput,
    @Req() req: Request,
  ) {
    return this.content.patch('topics', id, body, actor, cid(req));
  }
  @Delete('vocabulary-topics/:id') deletetopics(
    @CurrentUser('sub') actor: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    return this.content.remove('topics', id, actor, cid(req));
  }
  @Get('vocabularies') listvocabularies(@Query() q: VocabularyQuery) {
    return this.content.list('vocabularies', q, true);
  }
  @Get('vocabularies/:id') async getvocabularies(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.present('vocabularies', await this.content.get('vocabularies', id, true));
  }
  @Post('vocabularies') createvocabularies(
    @CurrentUser('sub') actor: string,
    @Headers('idempotency-key') key: string,
    @Body(new ContractPipe('VocabularyCreate')) body: ContentInput,
    @Req() req: Request,
  ) {
    return this.content.create('vocabularies', body, actor, key, cid(req));
  }
  @Patch('vocabularies/:id') patchvocabularies(
    @CurrentUser('sub') actor: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ContractPipe('VocabularyPatch')) body: ContentInput,
    @Req() req: Request,
  ) {
    return this.content.patch('vocabularies', id, body, actor, cid(req));
  }
  @Delete('vocabularies/:id') deletevocabularies(
    @CurrentUser('sub') actor: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    return this.content.remove('vocabularies', id, actor, cid(req));
  }
  @Get('lessons') listlessons(@Query() q: AdminLessonQuery) {
    return this.content.list('lessons', q, true);
  }
  @Get('lessons/:id') async getlessons(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.present('lessons', await this.content.get('lessons', id, true));
  }
  @Post('lessons') createlessons(
    @CurrentUser('sub') actor: string,
    @Headers('idempotency-key') key: string,
    @Body(new ContractPipe('LessonCreate')) body: ContentInput,
    @Req() req: Request,
  ) {
    return this.content.create('lessons', body, actor, key, cid(req));
  }
  @Patch('lessons/:id') patchlessons(
    @CurrentUser('sub') actor: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ContractPipe('LessonPatch')) body: ContentInput,
    @Req() req: Request,
  ) {
    return this.content.patch('lessons', id, body, actor, cid(req));
  }
  @Delete('lessons/:id') deletelessons(
    @CurrentUser('sub') actor: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    return this.content.remove('lessons', id, actor, cid(req));
  }
}
@Controller('learning')
export class ContentReadController {
  constructor(private readonly content: ContentService) {}
  @Get('vocabulary-topics') listtopics(@Query() query: SearchQuery) {
    return this.content.list('topics', query);
  }
  @Get('vocabulary-topics/:id') async gettopics(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.present('topics', await this.content.get('topics', id));
  }
  @Get('vocabularies') listvocabularies(@Query() query: VocabularyQuery) {
    return this.content.list('vocabularies', query);
  }
  @Get('vocabularies/:id') async getvocabularies(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.present('vocabularies', await this.content.get('vocabularies', id));
  }
  @Get('lessons') listlessons(@Query() query: LessonQuery) {
    return this.content.list('lessons', query);
  }
  @Get('lessons/:id') async getlessons(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.present('lessons', await this.content.get('lessons', id));
  }
}
