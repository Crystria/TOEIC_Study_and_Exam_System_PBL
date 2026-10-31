import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { QuestionsModule } from '../questions/questions.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
@Module({
  imports: [MediaModule, QuestionsModule],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
