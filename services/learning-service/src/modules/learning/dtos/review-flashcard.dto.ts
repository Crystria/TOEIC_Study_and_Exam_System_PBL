import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class ReviewFlashcardDto {
  @ApiProperty({ minimum: 0, maximum: 5, example: 4, description: 'Chất lượng trả lời SM-2' })
  @IsInt()
  @Min(0)
  @Max(5)
  quality!: number;
}
