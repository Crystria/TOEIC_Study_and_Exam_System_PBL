import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@toeic/common';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { AttemptsService } from './attempts.service';

@ApiTags('attempts')
@ApiBearerAuth()
@Controller()
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post('tests/:testId/attempts')
  @ApiOperation({ summary: 'Bắt đầu một lượt làm bài (tạo Attempt)' })
  start(@Param('testId') testId: string, @CurrentUser('sub') userId: string) {
    return this.attemptsService.start(testId, userId);
  }

  @Put('attempts/:attemptId/answers/:questionId')
  @ApiOperation({ summary: 'Lưu/cập nhật đáp án đang làm (không lộ đáp án đúng)' })
  saveAnswer(
    @Param('attemptId') attemptId: string,
    @Param('questionId') questionId: string,
    @Body() dto: SaveAnswerDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.attemptsService.saveAnswer(attemptId, questionId, dto, userId);
  }

  @Post('attempts/:attemptId/submit')
  @ApiOperation({ summary: 'Nộp bài và chấm điểm' })
  submit(@Param('attemptId') attemptId: string, @CurrentUser('sub') userId: string) {
    return this.attemptsService.submit(attemptId, userId);
  }

  @Get('attempts/:attemptId')
  @ApiOperation({ summary: 'Lấy kết quả lượt làm bài' })
  result(@Param('attemptId') attemptId: string, @CurrentUser('sub') userId: string) {
    return this.attemptsService.getResult(attemptId, userId);
  }
}
