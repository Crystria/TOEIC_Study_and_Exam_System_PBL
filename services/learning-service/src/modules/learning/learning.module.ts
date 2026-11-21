import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { ContentAdminController, ContentReadController } from './content.controller';
import { ContentService } from './content.service';
import { ProgressService } from './progress.service';
import { SessionService } from './session.service';
import { LearningMediaService } from './media.service';
import { PersonalContentController } from './personal-content.controller';
import { PersonalContentService } from './personal-content.service';
import { FlashcardSessionController } from './flashcard-session.controller';
import { FlashcardSessionService } from './flashcard-session.service';
@Module({
  controllers: [
    LearningController,
    ContentAdminController,
    ContentReadController,
    PersonalContentController,
    FlashcardSessionController,
  ],
  providers: [
    ContentService,
    ProgressService,
    SessionService,
    LearningMediaService,
    PersonalContentService,
    FlashcardSessionService,
  ],
  exports: [ProgressService, SessionService],
})
export class LearningModule {}
