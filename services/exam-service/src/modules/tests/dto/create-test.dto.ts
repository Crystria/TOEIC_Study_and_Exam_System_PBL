import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

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

  @ApiProperty({ enum: ['FULL', 'MINI'] })
  @IsIn(['FULL', 'MINI'])
  type!: 'FULL' | 'MINI';

  @ApiProperty({ example: 7200, description: 'Thời lượng làm bài (giây)' })
  @IsInt()
  @Min(1)
  durationSeconds!: number;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiPropertyOptional({ type: [TestQuestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestQuestionDto)
  questions?: TestQuestionDto[];
}
