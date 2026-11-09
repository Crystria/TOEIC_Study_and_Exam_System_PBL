// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';

import '../models/mock_test.dart';
import '../models/mock_test_submission.dart';
import '../models/test_attempt.dart';
import '../repositories/mock_test_attempt_repository.dart';
import '../repositories/mock_test_repository.dart';

enum TestHistoryDetailStatus { idle, loading, loaded, error }

/// Loads a single Attempt by its stable attemptId.
/// Viewing a history record is read-only; only an IN_PROGRESS Attempt may be
/// reopened through the explicit resume action in its detail screen.
class TestHistoryDetailProvider extends ChangeNotifier {
  TestHistoryDetailProvider({
    required MockTestAttemptRepository attemptRepository,
    required MockTestRepository testRepository,
  }) : _attemptRepository = attemptRepository,
       _testRepository = testRepository;

  final MockTestAttemptRepository _attemptRepository;
  final MockTestRepository _testRepository;

  TestHistoryDetailStatus status = TestHistoryDetailStatus.idle;
  TestAttempt? attempt;
  MockTest? test;
  MockTestSubmission? submission;
  String? errorMessage;
  int _requestId = 0;

  bool get isFinal =>
      attempt != null && attempt!.status != TestAttemptStatus.inProgress;

  Future<void> loadDetail(String attemptId) async {
    final requestId = ++_requestId;
    status = TestHistoryDetailStatus.loading;
    attempt = null;
    test = null;
    submission = null;
    errorMessage = null;
    notifyListeners();

    try {
      final loadedAttempt = await _attemptRepository.getAttempt(attemptId);
      if (requestId != _requestId) return;
      final loadedTest = await _testRepository.getTest(loadedAttempt.testId);
      if (requestId != _requestId) return;
      final loadedSubmission = loadedAttempt.readOnlySnapshot
          ? null
          : await _attemptRepository.getSubmission(attemptId);
      if (requestId != _requestId) return;

      if (!loadedAttempt.readOnlySnapshot &&
          loadedAttempt.status != TestAttemptStatus.inProgress &&
          loadedSubmission == null) {
        throw StateError(
          'Attempt đã kết thúc nhưng không tìm thấy snapshot kết quả.',
        );
      }

      attempt = loadedAttempt;
      test = loadedTest;
      submission = loadedSubmission;
      status = TestHistoryDetailStatus.loaded;
    } catch (error) {
      if (requestId != _requestId) return;
      errorMessage = error is AppException
          ? error.message
          : 'Không thể tải chi tiết bài thi. Vui lòng thử lại.';
      status = TestHistoryDetailStatus.error;
    }
    if (requestId == _requestId) notifyListeners();
  }

  @override
  void dispose() {
    // Invalidate asynchronous work before ChangeNotifier releases its listeners.
    _requestId++;
    super.dispose();
  }
}
