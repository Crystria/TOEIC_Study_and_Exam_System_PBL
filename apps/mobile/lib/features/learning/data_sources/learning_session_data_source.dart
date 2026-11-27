import '../models/vocabulary_session_dtos.dart';
import '../requests/learning_session_requests.dart';

/// Backend Session capability.
///
/// Kept separate from LearningContentDataSource so fixture-based content
/// adapters are not forced to implement production Session endpoints.
abstract interface class LearningSessionDataSource {
  Future<VocabularySessionDto> createVocabularySession({
    required CreateVocabularySessionRequestDto request,
    required String idempotencyKey,
  });

  Future<VocabularySessionDto> getVocabularySession(String sessionId);

  Future<void> saveVocabularySessionReviews({
    required String sessionId,
    required SaveVocabularySessionReviewsRequestDto request,
  });

  Future<VocabularySessionResultDto> submitVocabularySession({
    required String sessionId,
    required SubmitVocabularySessionRequestDto request,
  });

  Future<void> cancelVocabularySession(String sessionId);
}
