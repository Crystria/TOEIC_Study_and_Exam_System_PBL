import { Transform } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength, ValidateIf, IsOptional } from 'class-validator';
import { SearchQuery, VocabularyQuery, LessonQuery } from './queries';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PersonalTopicCreate {
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  topicName!: string;
}

export class PersonalTopicPatch {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  topicName?: string;
}

export class PersonalVocabularyCreate {
  @IsUUID()
  topicId!: string;

  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  word!: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  phonetic?: string | null;

  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  definition!: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  example?: string | null;
}

export class PersonalVocabularyPatch {
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  topicId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  word?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  phonetic?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  definition?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  example?: string | null;
}

export class PersonalLessonCreate {
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  lessonTitle!: string;

  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  category!: string;

  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  contentMarkdown!: string;
}

export class PersonalLessonPatch {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  lessonTitle?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  category?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  contentMarkdown?: string;
}

export {
  SearchQuery as PersonalTopicQuery,
  VocabularyQuery as PersonalVocabularyQuery,
  LessonQuery as PersonalLessonQuery,
};
