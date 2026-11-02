import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { ContentAdminController, ContentReadController } from './content.controller';
import { ContentService } from './content.service';
import { ProgressService } from './progress.service';
import { SessionService } from './session.service';
import { LearningMediaService } from './media.service';
@Module({
  controllers: [LearningController, ContentAdminController, ContentReadController],
  providers: [ContentService, ProgressService, SessionService, LearningMediaService],
  exports: [ProgressService, SessionService],
})
export class LearningModule {}
