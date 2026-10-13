import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '@toeic/common';
import { ListLessonsQueryDto } from './dtos/list-lessons-query.dto';
import { ListVocabulariesQueryDto } from './dtos/list-vocabularies-query.dto';
import { ReviewFlashcardDto } from './dtos/review-flashcard.dto';
import { LearningService } from './learning.service';

@ApiTags('learning')
@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Public()
  @Get('vocabulary-topics')
  @ApiOperation({ summary: 'Danh sách chủ đề từ vựng' })
  listVocabularyTopics() {
    return this.learningService.listVocabularyTopics();
  }

  @Public()
  @Get('vocabularies')
  @ApiOperation({ summary: 'Tìm kiếm/lọc từ vựng theo chủ đề hoặc từ khóa' })
  listVocabularies(@Query() query: ListVocabulariesQueryDto) {
    return this.learningService.listVocabularies(query);
  }

  @ApiBearerAuth()
  @Get('review-today')
  @ApiOperation({ summary: 'Danh sách từ vựng cần ôn tập hôm nay' })
  getReviewToday(@CurrentUser('sub') userId: string) {
    return this.learningService.getReviewToday(userId);
  }

  @ApiBearerAuth()
  @Post('flashcards/:vocabularyId/review')
  @ApiOperation({ summary: 'Đánh giá flashcard và cập nhật lịch ôn tập (SM-2)' })
  reviewFlashcard(
    @Param('vocabularyId') vocabularyId: string,
    @Body() dto: ReviewFlashcardDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.learningService.reviewFlashcard(vocabularyId, dto.quality, userId);
  }

  @Public()
  @Get('lessons')
  @ApiOperation({ summary: 'Danh sách bài học ngữ pháp' })
  listLessons(@Query() query: ListLessonsQueryDto) {
    return this.learningService.listLessons(query);
  }

  @Public()
  @Get('lessons/:id')
  @ApiOperation({ summary: 'Chi tiết bài học ngữ pháp' })
  findLesson(@Param('id') id: string) {
    return this.learningService.findLesson(id);
  }

  @ApiBearerAuth()
  @Post('lessons/:id/complete')
  @ApiOperation({ summary: 'Đánh dấu hoàn thành bài học' })
  completeLesson(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.learningService.completeLesson(id, userId);
  }

  @ApiBearerAuth()
  @Get('progress')
  @ApiOperation({ summary: 'Tiến độ học tập tổng quan của người học' })
  getProgress(@CurrentUser('sub') userId: string) {
    return this.learningService.getProgress(userId);
  }
}
