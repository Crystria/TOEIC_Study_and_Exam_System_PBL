enum TestAttemptMode { full, part }

enum TestAttemptStatus { inProgress, submitted, expired }

class TestAttempt {
  const TestAttempt({
    required this.attemptId,
    required this.testId,
    required this.mode,
    required this.parts,
    required this.durationSeconds,
    required this.status,
    required this.startedAt,
    this.completedAt,
    this.deadlineAtOverride,
    this.readOnlySnapshot = false,
  });

  final String attemptId;
  final String testId;
  final TestAttemptMode mode;
  final List<int> parts;
  final int durationSeconds;
  final TestAttemptStatus status;
  final DateTime startedAt;
  final DateTime? completedAt;
  final DateTime? deadlineAtOverride;
  final bool readOnlySnapshot;

  DateTime get deadlineAt =>
      deadlineAtOverride ?? startedAt.add(Duration(seconds: durationSeconds));

  TestAttempt copyWith({TestAttemptStatus? status, DateTime? completedAt}) {
    return TestAttempt(
      attemptId: attemptId,
      testId: testId,
      mode: mode,
      parts: parts,
      durationSeconds: durationSeconds,
      status: status ?? this.status,
      startedAt: startedAt,
      completedAt: completedAt ?? this.completedAt,
      deadlineAtOverride: deadlineAtOverride,
      readOnlySnapshot: readOnlySnapshot,
    );
  }
}
