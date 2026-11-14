import '../models/mock_test_submission.dart';
import '../models/test_attempt.dart';
import '../models/test_attempt_session.dart';
import '../models/test_history_item.dart';

/// Contract shared by API and Test Data Attempt repositories.
/// Providers consume this interface and never inspect the selected source.
abstract interface class MockTestAttemptRepository {
  void resetForUserScopeChange();
  Future<TestAttempt> startFullAttempt(String testId);
  Future<TestAttempt> startPartAttempt({
    required String testId,
    required List<int> parts,
    required int durationSeconds,
  });
  Future<TestAttempt> getAttempt(String attemptId);
  Future<MockTestSubmission?> getSubmission(String attemptId);
  Future<TestHistoryPage> getAttemptHistory({
    int page = 1,
    int size = 20,
    String? testId,
    TestAttemptMode? mode,
  });
  Future<TestAttemptSession> getAttemptSession(String attemptId);
  Future<void> saveAnswer({
    required String attemptId,
    required String questionId,
    required String? selectedOption,
  });
  Future<void> saveDraft({
    required String attemptId,
    required Map<String, String> answers,
  });
  Future<MockTestSubmission> submitAttempt(
    String attemptId, {
    bool expired = false,
    Map<String, String>? answers,
  });
}
