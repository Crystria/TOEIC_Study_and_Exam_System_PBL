import 'test_attempt_group.dart';
import 'test_attempt_question.dart';

/// Internal fixture/API snapshot item containing the answer key used only by
/// the repository's scoring path. The live taking model remains answer-key-free.
class MockTestQuestionSeed {
  const MockTestQuestionSeed({
    required this.question,
    required this.correctOption,
    this.explanation,
  });

  final TestAttemptQuestion question;
  final String correctOption;
  final String? explanation;
}

class MockTestQuestionBank {
  const MockTestQuestionBank({required this.questions, required this.groups});

  final List<MockTestQuestionSeed> questions;
  final List<TestAttemptGroup> groups;

  Map<String, String> get correctOptions => {
    for (final seed in questions) seed.question.questionId: seed.correctOption,
  };
}
