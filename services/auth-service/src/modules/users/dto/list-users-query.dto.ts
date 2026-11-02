import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RoleCode } from '@toeic/common';
import { UserStatus } from '../../../generated/prisma';
class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) size = 20;
}
export class ListUsersQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(255) keyword?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsEnum(RoleCode) role?: RoleCode;
}
export class AuditQueryDto extends PaginationDto {
  @IsOptional() @IsUUID() actorUserId?: string;
  @IsOptional() @IsUUID() targetUserId?: string;
  @IsOptional() @IsString() @MaxLength(255) action?: string;
  @IsOptional() @IsDateString() @Matches(/Z$/) from?: string;
  @IsOptional() @IsDateString() @Matches(/Z$/) to?: string;
}
