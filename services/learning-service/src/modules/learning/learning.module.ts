import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { ContentAdminController, ContentReadController } from './content.controller';
import { ContentService } from './content.service';
import { ProgressService } from './progress.service';
import { SessionService } from './session.service';
import { LearningMediaService } from './media.service';
import { PersonalContentController } from './personal-content.controller';
import { PersonalContentService } from './personal-content.service';
@Module({
  controllers: [
    LearningController,
    ContentAdminController,
    ContentReadController,
    PersonalContentController,
  ],
  providers: [
    ContentService,
    ProgressService,
    SessionService,
    LearningMediaService,
    PersonalContentService,
  ],
  exports: [ProgressService, SessionService],
})
export class LearningModule {}
