// ignore_for_file: prefer_initializing_formals
import '../../../core/network/api_client.dart';
import '../../../core/network/endpoints.dart';
import '../models/learning_dtos.dart';
import '../requests/learning_request_dtos.dart';

import 'package:dio/dio.dart';

import '../models/vocabulary_session_dtos.dart';
import '../requests/learning_session_requests.dart';

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

  Future<LearningTopicDto> getTopic(String topicId) async {
    final response = await _client.get<Object?>(
      Endpoints.learning.vocabularyTopic(topicId),
    );
    return LearningTopicDto.fromObject(response.data);
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
    final response = await _client.get<Object?>(Endpoints.learning.progress);
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

  Future<VocabularySessionDto> createVocabularySession({
    required CreateVocabularySessionRequestDto request,
    required String idempotencyKey,
  }) async {
    final key = idempotencyKey.trim();

    if (key.isEmpty) {
      throw ArgumentError.value(
        idempotencyKey,
        'idempotencyKey',
        'Idempotency key must not be empty.',
      );
    }

    final response = await _client.post<Object?>(
      Endpoints.learning.createVocabularySession,
      data: request.toJson(),
      options: Options(headers: <String, Object>{'Idempotency-Key': key}),
    );

    final session = VocabularySessionDto.fromObject(response.data);

    if (session.topicId != request.topicId || session.mode != request.mode) {
      throw const FormatException(
        'Created session does not match the requested topic and mode.',
      );
    }

    return session;
  }

  Future<VocabularySessionDto> getVocabularySession(String sessionId) async {
    final response = await _client.get<Object?>(
      Endpoints.learning.vocabularySession(sessionId),
    );

    final session = VocabularySessionDto.fromObject(response.data);

    if (session.sessionId != sessionId) {
      throw const FormatException(
        'Session response ID does not match the requested ID.',
      );
    }

    return session;
  }

  Future<void> saveVocabularySessionReviews({
    required String sessionId,
    required SaveVocabularySessionReviewsRequestDto request,
  }) async {
    final response = await _client.post<Object?>(
      Endpoints.learning.reviewVocabularySession(sessionId),
      data: request.toJson(),
    );

    LearningSessionActionReceiptDto.fromObject(response.data);
  }

  Future<VocabularySessionResultDto> submitVocabularySession({
    required String sessionId,
    required SubmitVocabularySessionRequestDto request,
  }) async {
    final response = await _client.post<Object?>(
      Endpoints.learning.submitVocabularySession(sessionId),
      data: request.toJson(),
    );

    return VocabularySessionResultDto.fromObject(
      response.data,
      expectedSessionId: sessionId,
    );
  }

  Future<void> cancelVocabularySession(String sessionId) async {
    final response = await _client.post<Object?>(
      Endpoints.learning.cancelVocabularySession(sessionId),
    );

    LearningSessionActionReceiptDto.fromObject(response.data);
  }
}
