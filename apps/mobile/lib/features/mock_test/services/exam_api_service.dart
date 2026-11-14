// ignore_for_file: prefer_initializing_formals
import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/endpoints.dart';
import '../requests/exam_request_dtos.dart';

/// Thin Exam Service transport adapter. It only sends requests and returns
/// decoded JSON; DTO mapping and repository policy stay outside this class.
class ExamApiService {
  ExamApiService({required ApiClient client}) : _client = client;

  final ApiClient _client;

  Future<Object?> listTests({
    required int page,
    required int size,
    String? keyword,
  }) async {
    final response = await _client.get<Object?>(
      Endpoints.mockTest.listTests,
      queryParameters: {
        'page': page,
        'size': size,
        if (keyword != null && keyword.trim().isNotEmpty)
          'keyword': keyword.trim(),
      },
    );
    return response.data;
  }

  Future<Object?> getTest(String testId) async {
    final response = await _client.get<Object?>(
      Endpoints.mockTest.test(testId),
    );
    return response.data;
  }

  Future<Object?> getTestParts(String testId) async {
    final response = await _client.get<Object?>(
      Endpoints.mockTest.testParts(testId),
    );
    return response.data;
  }

  Future<Object?> startFullAttempt({
    required String testId,
    required String idempotencyKey,
  }) async {
    final response = await _client.post<Object?>(
      Endpoints.mockTest.createAttempt(testId),
      options: Options(headers: {'Idempotency-Key': idempotencyKey}),
    );
    return response.data;
  }

  Future<Object?> startPartAttempt({
    required String testId,
    required List<int> parts,
    required int durationSeconds,
    required String idempotencyKey,
  }) async {
    final response = await _client.post<Object?>(
      Endpoints.mockTest.createPartAttempt(testId),
      data: StartPartAttemptRequest(
        parts: parts,
        durationSeconds: durationSeconds,
      ).toJson(),
      options: Options(headers: {'Idempotency-Key': idempotencyKey}),
    );
    return response.data;
  }

  Future<Object?> getAttempt(String attemptId) async {
    final response = await _client.get<Object?>(
      Endpoints.mockTest.attempt(attemptId),
    );
    return response.data;
  }

  Future<void> saveAnswer({
    required String attemptId,
    required String questionId,
    required String? selectedOption,
  }) async {
    await _client.put<Object?>(
      Endpoints.mockTest.saveAnswer(attemptId, questionId),
      data: SaveAnswerRequest(selectedOption: selectedOption).toJson(),
    );
  }

  Future<void> saveDraft({
    required String attemptId,
    required Map<String, String?> answers,
  }) async {
    await _client.put<Object?>(
      Endpoints.mockTest.saveDraft(attemptId),
      data: SaveDraftRequest(answers: answers).toJson(),
    );
  }

  Future<Object?> submitAttempt({
    required String attemptId,
    required Map<String, String?> answers,
  }) async {
    final response = await _client.post<Object?>(
      Endpoints.mockTest.submitAttempt(attemptId),
      data: SubmitAttemptRequest(answers: answers).toJson(),
    );
    return response.data;
  }

  Future<Object?> getAttemptHistory({
    required int page,
    required int size,
    String? testId,
    String? mode,
  }) async {
    final queryParameters = ExamHistoryQuery(
      page: page,
      size: size,
      testId: testId,
      mode: mode,
    ).toQueryParameters();

    final response = await _client.get<Object?>(
      Endpoints.mockTest.listAttempts,
      queryParameters: queryParameters,
    );
    return response.data;
  }
}
