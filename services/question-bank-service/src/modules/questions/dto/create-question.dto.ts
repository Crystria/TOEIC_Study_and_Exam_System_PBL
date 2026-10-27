import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuestionOptionDto {
  @IsIn(['A', 'B', 'C', 'D']) optionCode!: string;
  @IsString() @IsNotEmpty() optionText!: string;
}

export class CreateQuestionDto {
  @IsInt() @Min(1) @Max(7) part!: number;
  @IsString() @IsNotEmpty() type!: string;
  @IsOptional() @IsString() questionText?: string | null;
  @IsOptional() @IsString() explanation?: string | null;
  @IsIn(['EASY', 'MEDIUM', 'HARD']) difficulty!: string;
  @IsIn(['A', 'B', 'C', 'D']) correctOption!: string;
  @IsOptional() @IsUUID() groupId?: string | null;
  @IsOptional() @IsInt() @Min(1) positionInGroup?: number | null;
  @IsOptional() @IsString() transcript?: string | null;
  @IsOptional() @IsString() audioKey?: string | null;
  @IsOptional() @IsString() imageKey?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  tags?: string[];
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options!: QuestionOptionDto[];
}
