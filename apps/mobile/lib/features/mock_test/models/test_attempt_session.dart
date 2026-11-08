import 'test_attempt.dart';
import 'test_attempt_group.dart';
import 'test_attempt_question.dart';

class TestAttemptSession {
  const TestAttemptSession({
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
  });

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

  int get remainingSeconds {
    final milliseconds = deadlineAt.difference(DateTime.now()).inMilliseconds;
    if (milliseconds <= 0) return 0;
    return (milliseconds + 999) ~/ 1000;
  }
}
