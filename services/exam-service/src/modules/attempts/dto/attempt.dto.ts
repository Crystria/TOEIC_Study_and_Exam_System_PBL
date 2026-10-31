import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
export class PartAttemptDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  parts!: number[];
  @IsInt() @Min(300) @Max(10800) durationSeconds!: number;
}
export class AnswerDto {
  @IsUUID() questionId!: string;
  @ValidateIf((_object, value) => value !== null)
  @IsIn(['A', 'B', 'C', 'D'])
  selectedOption!: string | null;
}
export class AnswersDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}
export class SubmitDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers?: AnswerDto[];
}
export class HistoryQueryDto {
  @IsOptional() @IsUUID() testId?: string;
  @IsOptional() @IsIn(['FULL', 'PART']) mode?: 'FULL' | 'PART';
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) size = 20;
}
