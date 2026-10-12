import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum TimeRange {
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_90_DAYS = 'LAST_90_DAYS',
  ALL_TIME = 'ALL_TIME',
}

export class ProgressQueryDto {
  @ApiPropertyOptional({ enum: TimeRange, default: TimeRange.LAST_30_DAYS })
  @IsOptional()
  @IsEnum(TimeRange)
  time_range: TimeRange = TimeRange.LAST_30_DAYS;
}
