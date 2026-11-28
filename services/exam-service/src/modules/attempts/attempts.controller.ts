import { Body, Controller, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@toeic/common';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { AttemptsService } from './attempts.service';
import { AnswersDto, HistoryQueryDto, PartAttemptDto, SubmitDto } from './dto/attempt.dto';

@ApiTags('attempts')
@ApiBearerAuth()
@Controller()
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post('tests/:testId/attempts')
  @ApiOperation({ summary: 'Bắt đầu một lượt làm bài (tạo Attempt)' })
  start(
    @Param('testId') testId: string,
    @CurrentUser('sub') userId: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.attemptsService.start(testId, userId, key);
  }
  @Get('tests/:testId/parts')
  parts(@Param('testId') testId: string) {
    return this.attemptsService.parts(testId);
  }
  @Post('tests/:testId/part-attempts')
  startPart(
    @Param('testId') testId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: PartAttemptDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.attemptsService.startPart(testId, userId, dto, key);
  }
  @Put('attempts/:attemptId/draft')
  draft(
    @Param('attemptId') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: AnswersDto,
  ) {
    return this.attemptsService.saveDraft(id, userId, dto.answers);
  }
  @Get('attempts')
  history(@CurrentUser('sub') userId: string, @Query() query: HistoryQueryDto) {
    return this.attemptsService.history(userId, query);
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
  submit(
    @Param('attemptId') attemptId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitDto,
  ) {
    return this.attemptsService.submit(attemptId, userId, dto);
  }

  @Get('attempts/:attemptId')
  @ApiOperation({ summary: 'Lấy kết quả lượt làm bài' })
  result(@Param('attemptId') attemptId: string, @CurrentUser('sub') userId: string) {
    return this.attemptsService.getResult(attemptId, userId);
  }
}
