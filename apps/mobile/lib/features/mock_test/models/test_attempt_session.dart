import 'dart:math' as math;
import 'test_attempt.dart';
import 'test_attempt_group.dart';
import 'test_attempt_question.dart';

class TestAttemptSession {
  TestAttemptSession({
    required this.attemptId,
    required this.testId,
    required this.testTitle,
    required this.mode,
    required this.parts,
    required this.durationSeconds,
    required this.startedAt,
    required this.deadlineAt,
    required this.questions,
    required this.groups,
    required this.answers,
    this.remainingSecondsAtSnapshot,
    this.serverTime,
  }) : _elapsedSinceSnapshot = Stopwatch()..start();

  final String attemptId;
  final String testId;
  final String testTitle;
  final TestAttemptMode mode;
  final List<int> parts;
  final int durationSeconds;
  final DateTime startedAt;
  final DateTime deadlineAt;
  final List<TestAttemptQuestion> questions;
  final List<TestAttemptGroup> groups;
  final Map<String, String> answers;
  final int? remainingSecondsAtSnapshot;
  final DateTime? serverTime;
  final Stopwatch _elapsedSinceSnapshot;

  int get remainingSeconds {
    final snapshot = remainingSecondsAtSnapshot;
    if (snapshot != null) {
      final elapsedSeconds = _elapsedSinceSnapshot.elapsedMilliseconds ~/ 1000;
      return math.max(0, snapshot - elapsedSeconds).toInt();
    }

    // Mock/local attempts retain the established client-side timer behavior.
    final milliseconds = deadlineAt.difference(DateTime.now()).inMilliseconds;
    if (milliseconds <= 0) return 0;
    return (milliseconds + 999) ~/ 1000;
  }
}
