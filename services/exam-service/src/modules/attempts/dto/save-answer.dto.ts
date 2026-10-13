import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SaveAnswerDto {
  @ApiProperty({ example: 'A', description: 'Option key người dùng chọn' })
  @IsString()
  selectedOption!: string;
}
