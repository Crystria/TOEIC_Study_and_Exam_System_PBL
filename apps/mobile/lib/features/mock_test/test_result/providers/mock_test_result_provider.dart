import 'package:flutter/foundation.dart';

enum ResultStatus { idle, loading, loaded }

class MockTestResultProvider extends ChangeNotifier {
  ResultStatus status = ResultStatus.idle;
  int totalScore = 0, listeningScore = 0, readingScore = 0, predictedScore = 0;

  Future<void> loadResult(String attemptId) async {
    status = ResultStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 500));
    // TODO: repository.getAttemptResult(attemptId)
    totalScore = 735;
    listeningScore = 385;
    readingScore = 350;
    predictedScore = 705;
    status = ResultStatus.loaded;
    notifyListeners();
  }
}
