import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@toeic/common';
import { AnalyticsService } from './analytics.service';
import { ProgressQueryDto } from './dto/progress-query.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('progress')
  @ApiOperation({ summary: 'Tiến độ/thống kê học tập theo khoảng thời gian' })
  getProgress(@CurrentUser('sub') userId: string, @Query() query: ProgressQueryDto) {
    return this.analyticsService.getProgress(userId, query);
  }

  @Get('scores')
  @ApiOperation({ summary: 'Lịch sử điểm và thống kê tổng hợp' })
  getScores(@CurrentUser('sub') userId: string) {
    return this.analyticsService.getScores(userId);
  }

  @Get('streak')
  @ApiOperation({ summary: 'Chuỗi ngày học liên tục (streak)' })
  getStreak(@CurrentUser('sub') userId: string) {
    return this.analyticsService.getStreak(userId);
  }

  @Get('weak-areas')
  @ApiOperation({ summary: 'Các kỹ năng/part còn yếu' })
  getWeakAreas(@CurrentUser('sub') userId: string) {
    return this.analyticsService.getWeakAreas(userId);
  }

  @Get('prediction')
  @ApiOperation({ summary: 'Dự đoán điểm (kích hoạt khi >= 3 lần nộp trong 30 ngày)' })
  getPrediction(@CurrentUser('sub') userId: string) {
    return this.analyticsService.getPrediction(userId);
  }
}
