import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { EventsConsumer } from './events.consumer';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, EventsConsumer],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
