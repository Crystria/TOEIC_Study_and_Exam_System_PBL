import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '@toeic/common';
import { AnalyticsService } from './analytics.service';
import { PageQueryDto, ProgressQueryDto } from './dto/progress-query.dto';
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}
  @Get('progress') progress(@CurrentUser('sub') userId: string, @Query() query: ProgressQueryDto) {
    return this.analytics.getProgress(userId, query);
  }
  @Get('scores') scores(@CurrentUser('sub') userId: string, @Query() query: PageQueryDto) {
    return this.analytics.getScores(userId, query);
  }
  @Get('practices') practices(@CurrentUser('sub') userId: string, @Query() query: PageQueryDto) {
    return this.analytics.getPractices(userId, query);
  }
  @Get('streak') streak(@CurrentUser('sub') userId: string) {
    return this.analytics.getStreak(userId);
  }
  @Get('prediction') prediction(@CurrentUser('sub') userId: string) {
    return this.analytics.getPrediction(userId);
  }
  @Get('weak-areas') weak(@CurrentUser('sub') userId: string) {
    return this.analytics.getWeakAreas(userId);
  }
}
