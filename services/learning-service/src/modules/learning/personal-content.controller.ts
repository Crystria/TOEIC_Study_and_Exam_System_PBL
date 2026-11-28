import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@toeic/common';
import { PersonalContentService } from './personal-content.service';
import {
  PersonalLessonCreate,
  PersonalLessonPatch,
  PersonalLessonQuery,
  PersonalTopicCreate,
  PersonalTopicPatch,
  PersonalTopicQuery,
  PersonalVocabularyCreate,
  PersonalVocabularyPatch,
  PersonalVocabularyQuery,
} from './personal-content.dto';

// JWT authentication is provided by the application's global guard. Ownership is
// always the authenticated subject, never a request-body or query parameter.
@Controller('learning/personal')
export class PersonalContentController {
  constructor(private readonly content: PersonalContentService) {}

  @Get('vocabulary-topics')
  topics(@CurrentUser('sub') user: string, @Query() query: PersonalTopicQuery) {
    return this.content.listTopics(user, query);
  }

  @Get('vocabulary-topics/:id')
  topic(@CurrentUser('sub') user: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.readTopic(user, id);
  }

  @Post('vocabulary-topics')
  createTopic(
    @CurrentUser('sub') user: string,
    @Headers('idempotency-key') key: string,
    @Body() body: PersonalTopicCreate,
  ) {
    return this.content.createTopic(user, body, key);
  }

  @Patch('vocabulary-topics/:id')
  patchTopic(
    @CurrentUser('sub') user: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PersonalTopicPatch,
  ) {
    return this.content.patchTopic(user, id, body);
  }

  @Delete('vocabulary-topics/:id')
  deleteTopic(@CurrentUser('sub') user: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.removeTopic(user, id);
  }

  @Get('vocabularies')
  vocabularies(@CurrentUser('sub') user: string, @Query() query: PersonalVocabularyQuery) {
    return this.content.listVocabulary(user, query);
  }

  @Get('vocabularies/:id')
  vocabulary(@CurrentUser('sub') user: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.readVocabulary(user, id);
  }

  @Post('vocabularies')
  createVocabulary(
    @CurrentUser('sub') user: string,
    @Headers('idempotency-key') key: string,
    @Body() body: PersonalVocabularyCreate,
  ) {
    return this.content.createVocabulary(user, body, key);
  }

  @Patch('vocabularies/:id')
  patchVocabulary(
    @CurrentUser('sub') user: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PersonalVocabularyPatch,
  ) {
    return this.content.patchVocabulary(user, id, body);
  }

  @Delete('vocabularies/:id')
  deleteVocabulary(@CurrentUser('sub') user: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.removeVocabulary(user, id);
  }

  @Get('lessons')
  lessons(@CurrentUser('sub') user: string, @Query() query: PersonalLessonQuery) {
    return this.content.listLessons(user, query);
  }

  @Get('lessons/:id')
  lesson(@CurrentUser('sub') user: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.readLesson(user, id);
  }

  @Post('lessons')
  createLesson(
    @CurrentUser('sub') user: string,
    @Headers('idempotency-key') key: string,
    @Body() body: PersonalLessonCreate,
  ) {
    return this.content.createLesson(user, body, key);
  }

  @Patch('lessons/:id')
  patchLesson(
    @CurrentUser('sub') user: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: PersonalLessonPatch,
  ) {
    return this.content.patchLesson(user, id, body);
  }

  @Delete('lessons/:id')
  deleteLesson(@CurrentUser('sub') user: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.content.removeLesson(user, id);
  }
}
