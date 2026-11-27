import 'package:flutter/foundation.dart';

import '../models/mock_test_submission.dart';

enum ResultStatus { loaded }

/// Holds the immutable submission snapshot for the result screen.
class MockTestResultProvider extends ChangeNotifier {
  MockTestResultProvider({required this.submission});

  final MockTestSubmission submission;

  ResultStatus get status => ResultStatus.loaded;
  bool get isFullTest => submission.isFullTest;
  int get answeredCount => submission.answeredCount;
  int get unansweredCount => submission.unansweredCount;
  int get correctCount => submission.correctCount;
  int get totalQuestions => submission.totalQuestions;
  double get accuracy => submission.accuracy;
  List<MockTestPartSubmission> get partStats => submission.partStats;
  int get firstReviewIndex => submission.firstIncorrectQuestionIndex ?? 0;
}
