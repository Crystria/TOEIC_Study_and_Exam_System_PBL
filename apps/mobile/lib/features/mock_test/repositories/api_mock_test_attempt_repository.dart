import '../data_sources/remote/mock_test_remote_data_source.dart';
import '../data_sources/local/exam_attempt_local_data_source.dart';
import '../data_sources/local/exam_attempt_start_journal.dart';
import '../models/mock_test_submission.dart';
import '../models/test_attempt.dart';
import '../models/test_attempt_session.dart';
import '../models/test_history_item.dart';
import 'mock_test_attempt_repository.dart';
import 'mock_test_attempt_repository_engine.dart';
import 'mock_test_repository.dart';

/// API implementation of the Attempt repository contract.
/// The remote transport is mandatory; this implementation cannot silently
/// switch to Test Data when a request fails.
class ApiMockTestAttemptRepository implements MockTestAttemptRepository {
  ApiMockTestAttemptRepository({
    required MockTestRepository testRepository,
    required MockTestRemoteDataSource remoteDataSource,
    required String? Function() currentUserId,
    required ExamAttemptLocalDataSource localDataSource,
    required ExamAttemptStartJournal startJournal,
  }) : _engine = MockTestAttemptRepositoryEngine(
         testRepository: testRepository,
         remoteDataSource: remoteDataSource,
         currentUserId: currentUserId,
         localDataSource: localDataSource,
         startJournal: startJournal,
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
