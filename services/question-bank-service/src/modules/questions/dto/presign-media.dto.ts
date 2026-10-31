import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class PresignMediaDto {
  @IsIn(['AUDIO', 'IMAGE']) mediaType!: 'AUDIO' | 'IMAGE';
  @IsIn(['audio/mpeg', 'image/png', 'image/jpeg', 'image/webp']) contentType!: string;
  @IsString() @MaxLength(200) @Matches(/^[^/\\]+\.(mp3|png|jpe?g|webp)$/i) fileName!: string;
}
