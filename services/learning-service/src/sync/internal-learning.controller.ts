import { Controller, Get, Headers, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public, serviceAuthSecret, verifyLearningServiceToken } from '@toeic/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { LearningSyncService } from './learning-sync.service';
import { fail } from '../core';
export class ProgressPageQuery {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(512) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 50;
}
@Public()
@Controller('internal/v1/learning/users/:userId')
export class InternalLearningController {
  private readonly secret: string;
  constructor(
    private readonly sync: LearningSyncService,
    private readonly config: ConfigService,
  ) {
    this.secret = serviceAuthSecret(config);
  }
  @Get('progress') async page(
    @Headers('authorization') header: string | undefined,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: ProgressPageQuery,
  ) {
    await verifyLearningServiceToken(this.secret, header, 'learning:progress:read');
    if (this.config.get('SYNC_ENABLED') !== 'true') fail(503, 'SYNC_DISABLED');
    return this.sync.page(userId, query.cursor, query.limit);
  }
  @Get('operations/:operationId') async ledger(
    @Headers('authorization') header: string | undefined,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('operationId', new ParseUUIDPipe()) operationId: string,
  ) {
    await verifyLearningServiceToken(this.secret, header, 'learning:operations:read');
    if (this.config.get('SYNC_ENABLED') !== 'true') fail(503, 'SYNC_DISABLED');
    return this.sync.ledger(userId, operationId);
  }
}
