import { ApiProperty } from '@nestjs/swagger';
import { IsIn, ValidateIf } from 'class-validator';

export class SaveAnswerDto {
  @ApiProperty({ example: 'A', description: 'Option key người dùng chọn' })
  @ValidateIf((_object, value) => value !== null)
  @IsIn(['A', 'B', 'C', 'D'])
  selectedOption!: string | null;
}
