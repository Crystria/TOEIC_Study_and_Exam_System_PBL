import '../models/learning_dtos.dart';
import '../requests/learning_request_dtos.dart';

/// Shared content-data contract consumed by Learning repositories.
///
/// Both the API adapter and the Development fixture adapter implement this
/// contract. It deliberately exposes transport DTOs rather than domain models;
/// repositories use the same mapper and return the same domain types regardless
/// of which implementation is selected by the composition root.
abstract interface class LearningContentDataSource {
  Future<LearningPageDto<LearningTopicDto>> listTopics({
    required LearningPageQueryDto query,
  });

  Future<LearningTopicDto> getTopic(String topicId);

  Future<LearningPageDto<LearningVocabularyDto>> listVocabularies({
    required LearningPageQueryDto query,
  });

  Future<LearningVocabularyDto> getVocabulary(String vocabularyId);

  Future<LearningPageDto<LearningGrammarLessonDto>> listGrammarLessons({
    required LearningPageQueryDto query,
  });

  Future<LearningGrammarLessonDto> getGrammarLesson(String lessonId);

  Future<LearningPageDto<LearningReviewProgressDto>> listDueReviews({
    required LearningPageQueryDto query,
  });

  Future<LearningProgressSummaryDto> getProgressSummary();

  Future<LearningMutationReceiptDto> reviewFlashcard({
    required String vocabularyId,
    required ReviewFlashcardRequestDto request,
  });

  Future<LearningMutationReceiptDto> completeGrammarLesson({
    required String lessonId,
    required CompleteGrammarLessonRequestDto request,
  });
}
