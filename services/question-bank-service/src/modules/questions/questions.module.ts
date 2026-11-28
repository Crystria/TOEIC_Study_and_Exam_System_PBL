import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [SearchModule, MediaModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
