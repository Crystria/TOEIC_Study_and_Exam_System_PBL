import 'test_attempt.dart';
import 'test_attempt_group.dart';
import 'test_attempt_question.dart';

class MockTestPartSubmission {
  const MockTestPartSubmission({
    required this.part,
    required this.answeredCount,
    required this.correctCount,
    required this.totalQuestions,
  });

  final int part;
  final int answeredCount;
  final int correctCount;
  final int totalQuestions;

  double get accuracy =>
      totalQuestions == 0 ? 0 : correctCount / totalQuestions;

  int get unansweredCount => totalQuestions - answeredCount;
  bool get isListening => part <= 4;
}

/// A read-only answer key item created only after submission.
/// The live test-taking question model deliberately has no correct answer.
class MockTestQuestionReview {
  const MockTestQuestionReview({
    required this.question,
    required this.correctOption,
    required this.selectedOption,
    this.explanation,
  });

  final TestAttemptQuestion question;
  final String correctOption;
  final String? selectedOption;
  final String? explanation;

  bool get isAnswered => selectedOption != null;
  bool get isCorrect => selectedOption == correctOption;
  bool get isIncorrect => isAnswered && !isCorrect;
}

/// Immutable result snapshot used by the result and answer-review screens.
/// For PART practice, scaled TOEIC scores are null by design.
class MockTestSubmission {
  const MockTestSubmission({
    required this.attemptId,
    required this.testId,
    required this.testTitle,
    required this.mode,
    required this.parts,
    required this.answeredCount,
    required this.correctCount,
    required this.totalQuestions,
    required this.submittedAt,
    required this.expired,
    required this.partStats,
    required this.questionReviews,
    required this.groups,
    this.listeningCorrectCount,
    this.readingCorrectCount,
    this.listeningScore,
    this.readingScore,
    this.scoreDisclaimer,
    this.scoreTableVersion,
    this.scoreOfficial,
  });

  final String attemptId;
  final String testId;
  final String testTitle;
  final TestAttemptMode mode;
  final List<int> parts;
  final int answeredCount;
  final int correctCount;
  final int totalQuestions;
  final DateTime submittedAt;
  final bool expired;
  final List<MockTestPartSubmission> partStats;
  final List<MockTestQuestionReview> questionReviews;
  final List<TestAttemptGroup> groups;
  final int? listeningCorrectCount;
  final int? readingCorrectCount;
  final int? listeningScore;
  final int? readingScore;
  final String? scoreDisclaimer;
  final String? scoreTableVersion;
  final bool? scoreOfficial;

  int get unansweredCount => totalQuestions - answeredCount;
  double get accuracy =>
      totalQuestions == 0 ? 0 : correctCount / totalQuestions;
  bool get isFullTest => mode == TestAttemptMode.full;
  int? get totalScore => listeningScore == null || readingScore == null
      ? null
      : listeningScore! + readingScore!;

  int get incorrectCount => answeredCount - correctCount;

  int? get firstIncorrectQuestionIndex {
    final index = questionReviews.indexWhere((item) => item.isIncorrect);
    return index < 0 ? null : index;
  }

  TestAttemptGroup? groupFor(String? groupId) {
    if (groupId == null) return null;
    for (final group in groups) {
      if (group.groupId == groupId) return group;
    }
    return null;
  }
}
