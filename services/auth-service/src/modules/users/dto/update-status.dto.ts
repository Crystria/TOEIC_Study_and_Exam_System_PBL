import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum UserStatusDto {
  ACTIVE = 'ACTIVE',
  LOCKED = 'LOCKED',
  DISABLED = 'DISABLED',
  PENDING = 'PENDING',
}

export class UpdateStatusDto {
  @ApiProperty({ enum: UserStatusDto })
  @IsEnum(UserStatusDto)
  status!: UserStatusDto;
}
