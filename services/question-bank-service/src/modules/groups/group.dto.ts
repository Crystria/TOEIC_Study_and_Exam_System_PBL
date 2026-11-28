import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateQuestionDto } from '../questions/dto/create-question.dto';
import { ListQuestionsQueryDto } from '../questions/dto/list-questions-query.dto';

export class GroupAssetDto {
  @IsIn(['AUDIO', 'IMAGE', 'TEXT']) kind!: 'AUDIO' | 'IMAGE' | 'TEXT';
  @IsOptional() @IsString() storageKey?: string | null;
  @IsOptional() @IsString() content?: string | null;
  @IsInt() @Min(1) orderNo!: number;
}
export class CreateGroupDto {
  @IsIn([3, 4, 6, 7]) part!: number;
  @IsString() @IsNotEmpty() type!: string;
  @IsOptional() @IsString() instruction?: string | null;
  @IsOptional() @IsString() audioKey?: string | null;
  @IsOptional() @IsString() transcript?: string | null;
  @IsOptional() @IsString() passageText?: string | null;
  @IsOptional() @IsInt() @Min(1) orderNo?: number | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupAssetDto)
  assets?: GroupAssetDto[];
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions!: CreateQuestionDto[];
}
export class UpdateGroupDto extends PartialType(OmitType(CreateGroupDto, ['questions'] as const)) {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  questionOrder?: string[];
}
export class ListGroupsDto extends OmitType(ListQuestionsQueryDto, [
  'difficulty',
  'tag',
  'groupId',
] as const) {}
