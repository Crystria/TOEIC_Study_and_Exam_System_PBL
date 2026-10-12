import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListLessonsQueryDto {
  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}
