import '../../models/learning_dtos.dart';
import '../../requests/learning_request_dtos.dart';
import '../../services/learning_api_service.dart';
import 'learning_remote_data_source.dart';
import '../../models/vocabulary_session_dtos.dart';
import '../../requests/learning_session_requests.dart';

/// Production transport adapter. It contains no mock fallback behavior.
class ApiLearningDataSource implements LearningRemoteDataSource {
  ApiLearningDataSource({required LearningApiService service})
    : _service = service;

  final LearningApiService _service;

  @override
  Future<LearningPageDto<LearningTopicDto>> listTopics({
    required LearningPageQueryDto query,
  }) => _service.listTopics(query: query);

  @override
  Future<LearningTopicDto> getTopic(String topicId) =>
      _service.getTopic(topicId);

  @override
  Future<LearningPageDto<LearningVocabularyDto>> listVocabularies({
    required LearningPageQueryDto query,
  }) => _service.listVocabularies(query: query);

  @override
  Future<LearningVocabularyDto> getVocabulary(String vocabularyId) =>
      _service.getVocabulary(vocabularyId);

  @override
  Future<LearningPageDto<LearningGrammarLessonDto>> listGrammarLessons({
    required LearningPageQueryDto query,
  }) => _service.listGrammarLessons(query: query);

  @override
  Future<LearningGrammarLessonDto> getGrammarLesson(String lessonId) =>
      _service.getGrammarLesson(lessonId);

  @override
  Future<LearningPageDto<LearningReviewProgressDto>> listDueReviews({
    required LearningPageQueryDto query,
  }) => _service.listDueReviews(query: query);

  @override
  Future<LearningProgressSummaryDto> getProgressSummary() =>
      _service.getProgressSummary();

  @override
  Future<LearningMutationReceiptDto> reviewFlashcard({
    required String vocabularyId,
    required ReviewFlashcardRequestDto request,
  }) => _service.reviewFlashcard(vocabularyId: vocabularyId, request: request);

  @override
  Future<LearningMutationReceiptDto> completeGrammarLesson({
    required String lessonId,
    required CompleteGrammarLessonRequestDto request,
  }) => _service.completeGrammarLesson(lessonId: lessonId, request: request);

  @override
  Future<VocabularySessionDto> createVocabularySession({
    required CreateVocabularySessionRequestDto request,
    required String idempotencyKey,
  }) => _service.createVocabularySession(
    request: request,
    idempotencyKey: idempotencyKey,
  );

  @override
  Future<VocabularySessionDto> getVocabularySession(String sessionId) =>
      _service.getVocabularySession(sessionId);

  @override
  Future<void> saveVocabularySessionReviews({
    required String sessionId,
    required SaveVocabularySessionReviewsRequestDto request,
  }) => _service.saveVocabularySessionReviews(
    sessionId: sessionId,
    request: request,
  );

  @override
  Future<VocabularySessionResultDto> submitVocabularySession({
    required String sessionId,
    required SubmitVocabularySessionRequestDto request,
  }) =>
      _service.submitVocabularySession(sessionId: sessionId, request: request);

  @override
  Future<void> cancelVocabularySession(String sessionId) =>
      _service.cancelVocabularySession(sessionId);
}
