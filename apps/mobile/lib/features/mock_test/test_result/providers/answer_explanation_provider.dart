import 'package:flutter/foundation.dart';

enum ExplanationStatus { idle, loading, loaded }

class AnswerExplanationProvider extends ChangeNotifier {
  ExplanationStatus status = ExplanationStatus.idle;
  String? stem, explanation;
  List<String> wrongReasons = [];
  int currentQuestionNumber = 0;

  Future<void> loadExplanation(String attemptId, int questionNumber) async {
    status = ExplanationStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 400));
    // TODO: repository.getQuestionExplanation(attemptId, questionNumber)
    currentQuestionNumber = questionNumber;
    stem = 'The manager asked all employees to submit their reports _____ Friday afternoon.';
    explanation = 'B. by chỉ thời hạn...';
    status = ExplanationStatus.loaded;
    notifyListeners();
  }

  Future<void> goPrev(String attemptId) => loadExplanation(attemptId, currentQuestionNumber - 1);
  Future<void> goNext(String attemptId) => loadExplanation(attemptId, currentQuestionNumber + 1);
}
