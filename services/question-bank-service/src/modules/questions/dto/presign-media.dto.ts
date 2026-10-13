import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class PresignMediaDto {
  @ApiProperty({ example: 'audio/part1-q10.mp3' })
  @IsString()
  @Matches(/\.(mp3|wav|png|jpg|jpeg)$/i, { message: 'Unsupported media extension' })
  fileName!: string;
}
