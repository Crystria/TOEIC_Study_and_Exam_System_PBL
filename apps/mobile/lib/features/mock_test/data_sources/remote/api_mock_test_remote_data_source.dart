import '../../services/exam_api_service.dart';
import 'mock_test_remote_data_source.dart';

/// API Data Source adapter around the existing Exam Service transport.
class ApiMockTestRemoteDataSource implements MockTestRemoteDataSource {
  ApiMockTestRemoteDataSource({required ExamApiService service})
    : _service = service;

  final ExamApiService _service;

  @override
  Future<Object?> listTests({required int page, required int size}) =>
      _service.listTests(page: page, size: size);

  @override
  Future<Object?> getTest(String testId) => _service.getTest(testId);

  @override
  Future<Object?> getTestParts(String testId) => _service.getTestParts(testId);

  @override
  Future<Object?> startFullAttempt({
    required String testId,
    required String idempotencyKey,
  }) =>
      _service.startFullAttempt(testId: testId, idempotencyKey: idempotencyKey);

  @override
  Future<Object?> startPartAttempt({
    required String testId,
    required List<int> parts,
    required int durationSeconds,
    required String idempotencyKey,
  }) => _service.startPartAttempt(
    testId: testId,
    parts: parts,
    durationSeconds: durationSeconds,
    idempotencyKey: idempotencyKey,
  );

  @override
  Future<Object?> getAttempt(String attemptId) =>
      _service.getAttempt(attemptId);

  @override
  Future<void> saveAnswer({
    required String attemptId,
    required String questionId,
    required String? selectedOption,
  }) => _service.saveAnswer(
    attemptId: attemptId,
    questionId: questionId,
    selectedOption: selectedOption,
  );

  @override
  Future<void> saveDraft({
    required String attemptId,
    required Map<String, String?> answers,
  }) => _service.saveDraft(attemptId: attemptId, answers: answers);

  @override
  Future<Object?> submitAttempt({
    required String attemptId,
    required Map<String, String?> answers,
  }) => _service.submitAttempt(attemptId: attemptId, answers: answers);

  @override
  Future<Object?> getAttemptHistory({
    required int page,
    required int size,
    String? testId,
    String? mode,
  }) => _service.getAttemptHistory(
    page: page,
    size: size,
    testId: testId,
    mode: mode,
  );
}
