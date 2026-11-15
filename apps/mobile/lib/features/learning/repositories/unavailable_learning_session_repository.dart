import '../models/vocabulary_session_dtos.dart';
import '../requests/learning_session_requests.dart';
import 'learning_session_repository.dart';

/// Explicit non-API implementation used only in Development Test Data mode.
/// It never invents local quiz sessions or falls back after an API error.
class UnavailableLearningSessionRepository
    implements LearningSessionRepository {
  const UnavailableLearningSessionRepository();

  UnsupportedError _unsupported() => UnsupportedError(
    'Vocabulary Session API is unavailable in Test Data mode.',
  );

  @override
  bool get isAvailable => false;

  @override
  void resetForUserScopeChange() {}

  @override
  Future<VocabularySessionDto> createVocabularySession({
    required String topicId,
    required VocabularySessionMode mode,
  }) async {
    throw _unsupported();
  }

  @override
  Future<VocabularySessionDto?> resumeActiveVocabularySession() async => null;

  @override
  Future<VocabularySessionDto> getVocabularySession(String sessionId) async {
    throw _unsupported();
  }

  @override
  Future<SubmitVocabularySessionRequestDto?> getPendingSubmitRequest(
    String sessionId,
  ) async => null;

  @override
  Future<void> saveVocabularySessionReviews({
    required String sessionId,
    required SaveVocabularySessionReviewsRequestDto request,
  }) async {
    throw _unsupported();
  }

  @override
  Future<VocabularySessionResultDto> submitVocabularySession({
    required String sessionId,
    required List<VocabularySessionReviewRequestDto> reviews,
    required List<VocabularySessionAnswerRequestDto> answers,
  }) async {
    throw _unsupported();
  }

  @override
  Future<void> cancelVocabularySession(String sessionId) async {
    throw _unsupported();
  }

  @override
  Future<void> acknowledgeCompletedSession(String sessionId) async {
    throw _unsupported();
  }
}
