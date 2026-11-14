import '../data_sources/mock_test_question_bank_data_source.dart';
import '../data_sources/local/exam_attempt_local_data_source.dart';
import '../models/mock_test_submission.dart';
import '../models/test_attempt.dart';
import '../models/test_attempt_session.dart';
import '../models/test_history_item.dart';
import 'mock_test_attempt_repository.dart';
import 'mock_test_attempt_repository_engine.dart';
import 'mock_test_repository.dart';

/// Development Test Data implementation of the Attempt repository contract.
/// It has no API dependency and therefore cannot fallback to fixtures on an
/// API error; this implementation is selected only by the composition root.
class TestDataMockTestAttemptRepository implements MockTestAttemptRepository {
  TestDataMockTestAttemptRepository({
    required MockTestRepository testRepository,
    required String? Function() currentUserId,
    required ExamAttemptLocalDataSource localDataSource,
    required MockTestQuestionBankDataSource questionBankDataSource,
  }) : _engine = MockTestAttemptRepositoryEngine(
         testRepository: testRepository,
         currentUserId: currentUserId,
         localDataSource: localDataSource,
         questionBankDataSource: questionBankDataSource,
       );

  final MockTestAttemptRepositoryEngine _engine;

  @override
  void resetForUserScopeChange() => _engine.resetForUserScopeChange();

  @override
  Future<TestAttempt> startFullAttempt(String testId) =>
      _engine.startFullAttempt(testId);

  @override
  Future<TestAttempt> startPartAttempt({
    required String testId,
    required List<int> parts,
    required int durationSeconds,
  }) => _engine.startPartAttempt(
    testId: testId,
    parts: parts,
    durationSeconds: durationSeconds,
  );

  @override
  Future<TestAttempt> getAttempt(String attemptId) =>
      _engine.getAttempt(attemptId);

  @override
  Future<MockTestSubmission?> getSubmission(String attemptId) =>
      _engine.getSubmission(attemptId);

  @override
  Future<TestHistoryPage> getAttemptHistory({
    int page = 1,
    int size = 20,
    String? testId,
    TestAttemptMode? mode,
  }) => _engine.getAttemptHistory(
    page: page,
    size: size,
    testId: testId,
    mode: mode,
  );

  @override
  Future<TestAttemptSession> getAttemptSession(String attemptId) =>
      _engine.getAttemptSession(attemptId);

  @override
  Future<void> saveAnswer({
    required String attemptId,
    required String questionId,
    required String? selectedOption,
  }) => _engine.saveAnswer(
    attemptId: attemptId,
    questionId: questionId,
    selectedOption: selectedOption,
  );

  @override
  Future<void> saveDraft({
    required String attemptId,
    required Map<String, String> answers,
  }) => _engine.saveDraft(attemptId: attemptId, answers: answers);

  @override
  Future<MockTestSubmission> submitAttempt(
    String attemptId, {
    bool expired = false,
    Map<String, String>? answers,
  }) => _engine.submitAttempt(attemptId, expired: expired, answers: answers);
}
