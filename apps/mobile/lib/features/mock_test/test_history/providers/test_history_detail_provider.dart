import 'package:flutter/foundation.dart';

enum DetailStatus { idle, loading, loaded }

class PartResult {
  const PartResult({required this.label, required this.correct, required this.total});
  final String label;
  final int correct;
  final int total;
}

class TestHistoryDetailProvider extends ChangeNotifier {
  DetailStatus status = DetailStatus.idle;
  int totalScore = 0;
  List<PartResult> parts = [];

  Future<void> loadDetail(String attemptId) async {
    status = DetailStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 500));
    // TODO: repository.getAttemptDetail(attemptId)
    totalScore = 735;
    parts = const [PartResult(label: 'Part 5', correct: 25, total: 30)];
    status = DetailStatus.loaded;
    notifyListeners();
  }
}
