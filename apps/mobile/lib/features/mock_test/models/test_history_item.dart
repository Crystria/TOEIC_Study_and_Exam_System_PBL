import 'test_attempt.dart';

/// Read-only row model for an Attempt in the history list.
/// Scores and result aggregates are nullable while the Attempt is in progress.
class TestHistoryItem {
  const TestHistoryItem({
    required this.attemptId,
    required this.testId,
    required this.testTitle,
    required this.mode,
    required this.status,
    required this.parts,
    required this.durationSeconds,
    required this.startedAt,
    this.completedAt,
    this.deadlineAt,
    this.score,
    this.scoreListening,
    this.scoreReading,
    this.accuracy,
    this.correctCount,
    this.totalQuestions,
  });

  final String attemptId;
  final String testId;
  final String testTitle;
  final TestAttemptMode mode;
  final TestAttemptStatus status;
  final List<int> parts;
  final int durationSeconds;
  final DateTime startedAt;
  final DateTime? completedAt;
  final DateTime? deadlineAt;
  final int? score;
  final int? scoreListening;
  final int? scoreReading;
  final double? accuracy;
  final int? correctCount;
  final int? totalQuestions;

  bool get isFullTest => mode == TestAttemptMode.full;
  bool get isFinal => status != TestAttemptStatus.inProgress;
}

/// Page container mirrors the Exam Service pagination contract.
class TestHistoryPage {
  const TestHistoryPage({
    required this.items,
    required this.total,
    required this.page,
    required this.size,
    required this.totalPages,
  });

  final List<TestHistoryItem> items;
  final int total;
  final int page;
  final int size;
  final int totalPages;

  bool get hasNext => page < totalPages;
}
