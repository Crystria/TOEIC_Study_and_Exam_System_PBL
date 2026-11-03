import 'package:flutter/foundation.dart';

enum TakingStatus { idle, loading, loaded, submitting, submitted }

class TakingQuestion {
  const TakingQuestion({required this.id, required this.number, required this.stem, required this.options});
  final String id;
  final int number;
  final String stem;
  final List<String> options;
}

class MockTestTakingProvider extends ChangeNotifier {
  TakingStatus status = TakingStatus.idle;
  List<TakingQuestion> questions = [];
  Map<String, int> answers = {}; // questionId -> optionIndex
  int currentIndex = 0;
  Duration remaining = const Duration(minutes: 30);
  String? submittedAttemptId;

  Future<void> loadAttempt(String attemptId) async {
    status = TakingStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 500));
    // TODO: repository.getAttemptQuestions(attemptId)
    questions = const [
      TakingQuestion(id: 'q12', number: 12, stem: 'The manager asked all employees to submit their reports _____ Friday afternoon.', options: ['in', 'by', 'since', 'during']),
    ];
    currentIndex = 0;
    status = TakingStatus.loaded;
    notifyListeners();
  }

  void selectOption(int optionIndex) {
    final q = questions[currentIndex];
    answers[q.id] = optionIndex;
    notifyListeners();
    _syncAnswer(q.id, optionIndex); // fire-and-forget, không chặn UI
  }

  Future<void> _syncAnswer(String questionId, int optionIndex) async {
    await Future.delayed(const Duration(milliseconds: 200));
    // TODO: repository.saveAnswer(attemptId, questionId, optionIndex)
    // TODO: nếu lỗi mạng -> repository tự lưu pending, retry sau (offline-first)
  }

  void prev() {
    if (currentIndex > 0) currentIndex--;
    notifyListeners();
  }

  void next() {
    if (currentIndex + 1 < questions.length) currentIndex++;
    notifyListeners();
  }

  void jumpTo(int number) {
    final i = questions.indexWhere((q) => q.number == number);
    if (i != -1) currentIndex = i;
    notifyListeners();
  }

  Future<void> submit(String attemptId) async {
    status = TakingStatus.submitting;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 600));
    // TODO: repository.submitAttempt(attemptId, answers)
    submittedAttemptId = attemptId;
    status = TakingStatus.submitted; // screen điều hướng sang MockTestResultScreen(attemptId: ...)
    notifyListeners();
  }
}
