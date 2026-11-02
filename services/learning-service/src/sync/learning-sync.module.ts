import { Module } from '@nestjs/common';
import { LearningModule } from '../modules/learning/learning.module';
import { LearningSyncService } from './learning-sync.service';
import { InternalLearningController } from './internal-learning.controller';
@Module({
  imports: [LearningModule],
  providers: [LearningSyncService],
  controllers: [InternalLearningController],
})
export class LearningSyncModule {}
