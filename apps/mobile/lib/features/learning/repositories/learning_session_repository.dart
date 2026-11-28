import '../models/vocabulary_session_dtos.dart';
import '../requests/learning_session_requests.dart';

abstract interface class LearningSessionRepository {
  bool get isAvailable;

  Future<VocabularySessionDto> createVocabularySession({
    required String topicId,
    required VocabularySessionMode mode,
  });

  /// Restores the user's active Session, or retries a pending create request
  /// with its original Idempotency-Key.
  Future<VocabularySessionDto?> resumeActiveVocabularySession();

  Future<VocabularySessionDto> getVocabularySession(String sessionId);

  /// Returns the exact request to retry if a previous submit is still pending.
  Future<SubmitVocabularySessionRequestDto?> getPendingSubmitRequest(
    String sessionId,
  );

  Future<void> saveVocabularySessionReviews({
    required String sessionId,
    required SaveVocabularySessionReviewsRequestDto request,
  });

  Future<VocabularySessionResultDto> submitVocabularySession({
    required String sessionId,
    required List<VocabularySessionReviewRequestDto> reviews,
    required List<VocabularySessionAnswerRequestDto> answers,
  });

  Future<void> cancelVocabularySession(String sessionId);

  /// Clears the local pointer after the result has been consumed by the UI.
  Future<void> acknowledgeCompletedSession(String sessionId);

  void resetForUserScopeChange();
}
