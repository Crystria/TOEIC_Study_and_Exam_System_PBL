import '../models/grammar_lesson.dart';
import '../models/learning_dtos.dart';
import '../models/learning_models.dart';

/// Converts transport DTOs into feature domain models.
class LearningDtoMapper {
  const LearningDtoMapper._();

  static LearningTopic topic(LearningTopicDto dto) => dto.toDomain();

  static LearningVocabulary vocabulary(
    LearningVocabularyDto dto, {
    required String topicName,
  }) => dto.toDomain(topicName: topicName);

  static GrammarLesson grammarLesson(LearningGrammarLessonDto dto) =>
      dto.toDomain();

  static LearningReviewProgress reviewProgress(LearningReviewProgressDto dto) =>
      dto.toDomain();

  static LearningProgressSummary progressSummary(
    LearningProgressSummaryDto dto,
  ) => dto.toDomain();

  static LearningMutationReceipt mutationReceipt(
    LearningMutationReceiptDto dto,
  ) => dto.toDomain();
}
