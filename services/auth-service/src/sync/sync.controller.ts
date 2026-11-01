import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser, SyncRequest } from '@toeic/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ContractPipe } from '../http';
import { SyncService } from './sync.service';
class SyncPageQuery {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(512) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 50;
}
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}
  @Post('users') @HttpCode(200) accept(
    @CurrentUser('sub') userId: string,
    @Body(new ContractPipe('SyncRequest')) body: SyncRequest,
  ) {
    return this.sync.accept(userId, body);
  }
  @Get('users/me') state(@CurrentUser('sub') userId: string, @Query() query: SyncPageQuery) {
    return this.sync.state(userId, query.cursor, query.limit);
  }
  @Get('operations/:operationId') operation(
    @CurrentUser('sub') userId: string,
    @Param('operationId', new ParseUUIDPipe()) id: string,
  ) {
    return this.sync.operation(userId, id);
  }
}
