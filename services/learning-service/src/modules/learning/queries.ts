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
export interface VocabularyCreateItem {
  word: string;
  phonetic?: string | null;
  partOfSpeech?: string | null;
  definition: string;
  englishDefinition?: string | null;
  example?: string | null;
}
export interface VocabularyBulkInput {
  topicId: string;
  items: VocabularyCreateItem[];
}
export interface VocabularyImportInput {
  source: string;
  lists: { name: string; words: VocabularyCreateItem[] }[];
}
export interface ContentInput extends Partial<VocabularyCreateItem> {
  topicName?: string;
  topicId?: string;
  lessonTitle?: string;
  category?: string;
  contentMarkdown?: string;
  status?: 'DRAFT' | 'PUBLISHED';
}
export type ContentKind = 'topics' | 'vocabularies' | 'lessons';
