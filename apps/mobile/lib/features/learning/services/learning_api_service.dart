// ignore_for_file: prefer_initializing_formals
import '../../../core/network/api_client.dart';
import '../../../core/network/endpoints.dart';
import '../models/learning_dtos.dart';
import '../requests/learning_request_dtos.dart';

/// Thin transport adapter for the existing Learning API.
/// It performs HTTP + JSON-to-DTO mapping only; persistence and retry policy
/// belong to LearningRepository.
class LearningApiService {
  LearningApiService({required ApiClient client}) : _client = client;

  final ApiClient _client;

  Future<LearningPageDto<LearningTopicDto>> listTopics({
    required LearningPageQueryDto query,
  }) async {
    final response = await _client.get<Object?>(
      Endpoints.learning.listVocabularyTopics,
      queryParameters: query.toQueryParameters(),
    );
    return LearningPageDto<LearningTopicDto>.fromObject(
      response.data,
      parseItem: LearningTopicDto.fromObject,
    );
  }

  Future<LearningPageDto<LearningVocabularyDto>> listVocabularies({
    required LearningPageQueryDto query,
  }) async {
    final response = await _client.get<Object?>(
      Endpoints.learning.listVocabularies,
      queryParameters: query.toQueryParameters(),
    );
    return LearningPageDto<LearningVocabularyDto>.fromObject(
      response.data,
      parseItem: LearningVocabularyDto.fromObject,
    );
  }

  Future<LearningVocabularyDto> getVocabulary(String vocabularyId) async {
    final response = await _client.get<Object?>(
      Endpoints.learning.vocabulary(vocabularyId),
    );
    return LearningVocabularyDto.fromObject(response.data);
  }

  Future<LearningPageDto<LearningGrammarLessonDto>> listGrammarLessons({
    required LearningPageQueryDto query,
  }) async {
    final response = await _client.get<Object?>(
      Endpoints.learning.listLessons,
      queryParameters: query.toQueryParameters(),
    );
    return LearningPageDto<LearningGrammarLessonDto>.fromObject(
      response.data,
      parseItem: LearningGrammarLessonDto.fromObject,
    );
  }

  Future<LearningGrammarLessonDto> getGrammarLesson(String lessonId) async {
    final response = await _client.get<Object?>(
      Endpoints.learning.lesson(lessonId),
    );
    return LearningGrammarLessonDto.fromObject(response.data);
  }

  Future<LearningPageDto<LearningReviewProgressDto>> listDueReviews({
    required LearningPageQueryDto query,
  }) async {
    final response = await _client.get<Object?>(
      Endpoints.learning.reviewToday,
      queryParameters: query.toQueryParameters(),
    );
    return LearningPageDto<LearningReviewProgressDto>.fromObject(
      response.data,
      parseItem: LearningReviewProgressDto.fromObject,
    );
  }

  Future<LearningProgressSummaryDto> getProgressSummary() async {
    final response = await _client.get<Object?>(
      Endpoints.learning.progress,
    );
    return LearningProgressSummaryDto.fromObject(response.data);
  }

  Future<LearningMutationReceiptDto> reviewFlashcard({
    required String vocabularyId,
    required ReviewFlashcardRequestDto request,
  }) async {
    final response = await _client.post<Object?>(
      Endpoints.learning.reviewFlashcard(vocabularyId),
      data: request.toJson(),
    );
    return LearningMutationReceiptDto.fromObject(
      response.data,
      expectedEntityId: vocabularyId,
      expectedOperationId: request.operationId,
      expectedEntityType: 'VOCABULARY',
    );
  }

  Future<LearningMutationReceiptDto> completeGrammarLesson({
    required String lessonId,
    required CompleteGrammarLessonRequestDto request,
  }) async {
    final response = await _client.post<Object?>(
      Endpoints.learning.completeLesson(lessonId),
      data: request.toJson(),
    );
    return LearningMutationReceiptDto.fromObject(
      response.data,
      expectedEntityId: lessonId,
      expectedOperationId: request.operationId,
      expectedEntityType: 'LESSON',
    );
  }
}
