import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class TestQuestionDto {
  @ApiProperty()
  @IsString()
  questionId!: string;

  @ApiProperty({ description: 'Thứ tự câu trong đề (1-based)' })
  @IsInt()
  @Min(1)
  orderNo!: number;

  @ApiProperty({ minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  part!: number;
}

export class CreateTestDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ example: 7200, description: 'Thời lượng làm bài (giây)' })
  @IsInt()
  @Min(1)
  durationSeconds!: number;

  @ApiPropertyOptional({ type: [TestQuestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestQuestionDto)
  questions?: TestQuestionDto[];
}
