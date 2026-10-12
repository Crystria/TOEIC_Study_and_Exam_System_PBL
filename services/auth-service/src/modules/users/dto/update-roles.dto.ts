import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';
import { RoleCode } from '@toeic/common';

export class UpdateRolesDto {
  @ApiProperty({ enum: RoleCode, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(RoleCode, { each: true })
  roles!: RoleCode[];
}
