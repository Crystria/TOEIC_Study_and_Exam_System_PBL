import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class TestQuestionDto {
  @ApiProperty()
  @IsUUID()
  questionId!: string;

  @ApiProperty({ description: 'Thứ tự câu trong đề (1-based)' })
  @IsInt()
  @Min(1)
  orderNo!: number;

  @ApiProperty({ minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  @Max(7)
  part!: number;
}

export class CreateTestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 7200, description: 'Thời lượng làm bài (giây)' })
  @IsInt()
  @Min(1)
  @Max(7200)
  durationSeconds!: number;

  @ApiProperty({ type: [TestQuestionDto] })
  @IsArray()
  @ArrayMinSize(200)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TestQuestionDto)
  questions!: TestQuestionDto[];
}
