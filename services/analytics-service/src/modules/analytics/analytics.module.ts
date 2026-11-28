import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { EventsConsumer } from './events.consumer';
import { AnalyticsClock } from './calculations';
import { AnalyticsQueries } from './analytics.queries';
import { ProjectionService } from './projection.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    EventsConsumer,
    AnalyticsClock,
    AnalyticsQueries,
    ProjectionService,
  ],
  exports: [AnalyticsService, ProjectionService],
})
export class AnalyticsModule {}
