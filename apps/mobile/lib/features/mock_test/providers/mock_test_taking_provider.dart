import 'dart:async';

import 'package:flutter/foundation.dart';

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

  Future<void> loadAttempt(String attemptId) async {
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
      session = loadedSession;
      questions = loadedSession.questions;
      groups = loadedSession.groups;
      answers.addAll(loadedSession.answers);
      status = TakingStatus.loaded;
      _refreshRemainingTime(notify: false);
      notifyListeners();
      _startCountdown();
    } catch (error) {
      // The deadline can pass between History's pre-check and this session
      // load. If the repository has finalized the Attempt in that interval,
      // surface its immutable result instead of leaving the user on a load error.
      try {
        final latestAttempt = await _repository.getAttempt(attemptId);
        if (latestAttempt.status != TestAttemptStatus.inProgress) {
          final finalSubmission = await _repository.getSubmission(attemptId);
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
      errorMessage = 'Không thể tải bài thi: $error';
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

    try {
      await _repository.saveAnswer(
        attemptId: attemptId,
        questionId: question.questionId,
        selectedOption: optionCode,
      );
    } catch (error) {
      errorMessage = 'Không thể lưu đáp án: $error';
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
    try {
      await _repository.saveAnswer(
        attemptId: attemptId,
        questionId: question.questionId,
        selectedOption: null,
      );
    } catch (error) {
      errorMessage = 'Không thể xóa đáp án: $error';
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

    _countdownTimer?.cancel();
    status = TakingStatus.submitting;
    errorMessage = null;
    notifyListeners();

    try {
      submission = await _repository.submitAttempt(attemptId, expired: expired);
      status = TakingStatus.submitted;
      notifyListeners();
      return submission;
    } catch (error) {
      status = TakingStatus.loaded;
      errorMessage = 'Không thể nộp bài: $error';
      notifyListeners();
      _startCountdown();
      return null;
    }
  }

  /// Recalculates against the absolute deadline after the app resumes.
  void onAppResumed() {
    if (status == TakingStatus.loaded) _refreshRemainingTime();
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
    _countdownTimer?.cancel();
    super.dispose();
  }
}
