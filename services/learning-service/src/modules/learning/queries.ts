import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { GrammarLessonStatus } from '../../generated/prisma';
export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) size = 20;
}
export class SearchQuery extends PageQuery {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) keyword?: string;
}
export class VocabularyQuery extends SearchQuery {
  @IsOptional() @IsUUID() topicId?: string;
}
export class LessonQuery extends SearchQuery {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) category?: string;
}
export class AdminLessonQuery extends LessonQuery {
  @IsOptional() @IsEnum(GrammarLessonStatus) status?: GrammarLessonStatus;
}
export class ReviewQuery extends PageQuery {
  @IsOptional() @IsUUID() topicId?: string;
}
export interface ContentInput {
  topicName?: string;
  topicId?: string;
  word?: string;
  phonetic?: string | null;
  definition?: string;
  example?: string | null;
  lessonTitle?: string;
  category?: string;
  contentMarkdown?: string;
  status?: 'DRAFT' | 'PUBLISHED';
}
export type ContentKind = 'topics' | 'vocabularies' | 'lessons';
