// ignore_for_file: prefer_initializing_formals
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';

import '../models/mock_test_submission.dart';
import '../models/test_attempt.dart';
import '../models/test_attempt_group.dart';
import '../models/test_attempt_question.dart';
import '../models/test_attempt_session.dart';
import '../repositories/mock_test_attempt_repository.dart';

enum TakingStatus { idle, loading, loaded, submitting, submitted, error }

class MockTestTakingProvider extends ChangeNotifier {
  MockTestTakingProvider({required MockTestAttemptRepository repository})
    : _repository = repository;

  final MockTestAttemptRepository _repository;
  Timer? _countdownTimer;
  TestAttemptSession? session;
  TakingStatus status = TakingStatus.idle;
  List<TestAttemptQuestion> questions = const [];
  List<TestAttemptGroup> groups = const [];
  final Map<String, String> answers = {};
  int currentIndex = 0;
  int remainingSeconds = 0;
  String? errorMessage;
  MockTestSubmission? submission;
  bool _autoSubmitStarted = false;
  int _loadRequestId = 0;
  bool _disposed = false;

  bool get usesBackend => _repository.usesBackend;

  int get totalQuestions => questions.length;
  int get answeredCount => answers.length;
  int get unansweredCount => totalQuestions - answeredCount;
  double get progress =>
      totalQuestions == 0 ? 0 : (currentIndex + 1) / totalQuestions;
  bool get isLoading =>
      status == TakingStatus.loading || status == TakingStatus.idle;
  bool get isSubmitting => status == TakingStatus.submitting;
  bool get isSubmitted => status == TakingStatus.submitted;
  bool get isFullTest => session?.mode == TestAttemptMode.full;

  TestAttemptQuestion? get currentQuestion =>
      questions.isEmpty ? null : questions[currentIndex];

  TestAttemptGroup? get currentGroup {
    final groupId = currentQuestion?.groupId;
    if (groupId == null) return null;
    for (final group in groups) {
      if (group.groupId == groupId) return group;
    }
    return null;
  }

  String? get selectedOptionCode {
    final questionId = currentQuestion?.questionId;
    return questionId == null ? null : answers[questionId];
  }

  List<int> get availableParts => session?.parts ?? const [];

  Future<void> loadAttempt(
    String attemptId, {
    bool preserveCurrentIndex = false,
  }) async {
    final requestId = ++_loadRequestId;
    final previousIndex = currentIndex;
    _countdownTimer?.cancel();
    status = TakingStatus.loading;
    errorMessage = null;
    session = null;
    questions = const [];
    groups = const [];
    answers.clear();
    currentIndex = 0;
    remainingSeconds = 0;
    submission = null;
    _autoSubmitStarted = false;
    notifyListeners();

    try {
      final loadedSession = await _repository.getAttemptSession(attemptId);
      if (requestId != _loadRequestId) return;
      session = loadedSession;
      questions = loadedSession.questions;
      groups = loadedSession.groups;
      answers.addAll(loadedSession.answers);
      currentIndex = preserveCurrentIndex && questions.isNotEmpty
          ? previousIndex.clamp(0, questions.length - 1).toInt()
          : 0;
      status = TakingStatus.loaded;
      _refreshRemainingTime(notify: false);
      notifyListeners();
      _startCountdown();
    } catch (error) {
      if (requestId != _loadRequestId) return;
      // The deadline can pass between History's pre-check and this session
      // load. If the repository has finalized the Attempt in that interval,
      // surface its immutable result instead of leaving the user on a load error.
      try {
        final latestAttempt = await _repository.getAttempt(attemptId);
        if (requestId != _loadRequestId) return;
        if (latestAttempt.status != TestAttemptStatus.inProgress) {
          final finalSubmission = await _repository.getSubmission(attemptId);
          if (requestId != _loadRequestId) return;
          if (finalSubmission != null) {
            submission = finalSubmission;
            status = TakingStatus.submitted;
            notifyListeners();
            return;
          }
        }
      } catch (_) {
        // Keep the original session-loading error below.
      }

      status = TakingStatus.error;
      errorMessage = error is AppException
          ? error.message
          : 'Không thể tải bài thi. Vui lòng thử lại.';
      notifyListeners();
    }
  }

  Future<void> selectOption(String optionCode) async {
    final question = currentQuestion;
    final attemptId = session?.attemptId;
    if (status != TakingStatus.loaded ||
        question == null ||
        attemptId == null) {
      return;
    }
    if (!question.options.any((option) => option.optionCode == optionCode)) {
      return;
    }

    answers[question.questionId] = optionCode;
    errorMessage = null;
    notifyListeners();

    final requestId = _loadRequestId;
    try {
      await _repository.saveAnswer(
        attemptId: attemptId,
        questionId: question.questionId,
        selectedOption: optionCode,
      );
      if (_disposed || requestId != _loadRequestId) return;
    } catch (error) {
      if (_disposed || requestId != _loadRequestId) return;
      errorMessage = error is AppException
          ? error.message
          : 'Không thể lưu đáp án. Đáp án vẫn được giữ tạm trên thiết bị.';
      notifyListeners();
    }
  }

  Future<void> clearCurrentAnswer() async {
    final question = currentQuestion;
    final attemptId = session?.attemptId;
    if (status != TakingStatus.loaded ||
        question == null ||
        attemptId == null) {
      return;
    }
    answers.remove(question.questionId);
    notifyListeners();
    final requestId = _loadRequestId;
    try {
      await _repository.saveAnswer(
        attemptId: attemptId,
        questionId: question.questionId,
        selectedOption: null,
      );
      if (_disposed || requestId != _loadRequestId) return;
    } catch (error) {
      if (_disposed || requestId != _loadRequestId) return;
      errorMessage = error is AppException
          ? error.message
          : 'Không thể xóa đáp án. Thay đổi vẫn được giữ tạm trên thiết bị.';
      notifyListeners();
    }
  }

  void previous() {
    if (status != TakingStatus.loaded || currentIndex <= 0) return;
    currentIndex--;
    notifyListeners();
  }

  void next() {
    if (status != TakingStatus.loaded || currentIndex >= questions.length - 1) {
      return;
    }
    currentIndex++;
    notifyListeners();
  }

  void jumpToIndex(int index) {
    if (status != TakingStatus.loaded ||
        index < 0 ||
        index >= questions.length) {
      return;
    }
    if (currentIndex == index) return;
    currentIndex = index;
    notifyListeners();
  }

  void jumpToPart(int part) {
    if (status != TakingStatus.loaded) return;
    final index = questions.indexWhere((question) => question.part == part);
    if (index >= 0) jumpToIndex(index);
  }

  int questionCountForPart(int part) =>
      questions.where((question) => question.part == part).length;

  int answeredCountForPart(int part) => questions
      .where(
        (question) =>
            question.part == part && answers.containsKey(question.questionId),
      )
      .length;

  int indexOfQuestion(String questionId) =>
      questions.indexWhere((question) => question.questionId == questionId);

  bool isAnswered(String questionId) => answers.containsKey(questionId);

  Future<MockTestSubmission?> submitAttempt({bool expired = false}) async {
    final attemptId = session?.attemptId;
    if (attemptId == null || status == TakingStatus.submitting) return null;
    if (status == TakingStatus.submitted) return submission;
    if (status != TakingStatus.loaded) return null;

    final requestId = _loadRequestId;
    _countdownTimer?.cancel();
    status = TakingStatus.submitting;
    errorMessage = null;
    notifyListeners();

    try {
      submission = await _repository.submitAttempt(
        attemptId,
        expired: expired,
        answers: Map<String, String>.unmodifiable(answers),
      );
      if (_disposed || requestId != _loadRequestId) return null;
      status = TakingStatus.submitted;
      notifyListeners();
      return submission;
    } catch (error) {
      if (_disposed || requestId != _loadRequestId) return null;
      status = TakingStatus.loaded;
      errorMessage = error is AppException
          ? error.message
          : 'Không thể nộp bài. Vui lòng thử lại.';
      notifyListeners();
      _startCountdown();
      return null;
    }
  }

  /// Re-syncs the authoritative server deadline when an API-backed attempt
  /// returns to the foreground. Mock mode keeps its original local countdown.
  void onAppResumed() {
    if (status != TakingStatus.loaded) return;
    final attemptId = session?.attemptId;
    if (usesBackend && attemptId != null) {
      unawaited(loadAttempt(attemptId, preserveCurrentIndex: true));
    } else {
      _refreshRemainingTime();
    }
  }

  /// Flushes the current draft while the application is leaving the foreground.
  /// Every individual answer is already sent through PUT /answers/:questionId;
  /// this batch PUT gives the Backend another consistent snapshot for resume.
  void saveDraftNow() {
    final currentSession = session;
    if (!usesBackend || status != TakingStatus.loaded || currentSession == null) {
      return;
    }
    unawaited(
      _repository.saveDraft(
        attemptId: currentSession.attemptId,
        answers: Map<String, String>.unmodifiable(answers),
      ).catchError((error) {
        if (!_disposed && status == TakingStatus.loaded) {
          errorMessage = error is AppException
              ? error.message
              : 'Không thể đồng bộ bản nháp. Đáp án vẫn được giữ tạm trên thiết bị.';
          notifyListeners();
        }
      }),
    );
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => _refreshRemainingTime(),
    );
  }

  void _refreshRemainingTime({bool notify = true}) {
    final currentSession = session;
    if (currentSession == null) return;
    final nextValue = currentSession.remainingSeconds;
    final changed = nextValue != remainingSeconds;
    remainingSeconds = nextValue;
    if (changed && notify) notifyListeners();

    if (remainingSeconds == 0 &&
        status == TakingStatus.loaded &&
        !_autoSubmitStarted) {
      _autoSubmitStarted = true;
      unawaited(submitAttempt(expired: true));
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _loadRequestId++;
    _countdownTimer?.cancel();
    super.dispose();
  }
}
