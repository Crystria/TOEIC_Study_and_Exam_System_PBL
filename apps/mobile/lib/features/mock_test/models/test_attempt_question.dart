class TestAttemptOption {
  const TestAttemptOption({required this.optionCode, required this.optionText});

  final String optionCode;
  final String optionText;
}

/// Safe question snapshot for the active test-taking UI.
/// The correct option and explanation are intentionally not part of this model.
class TestAttemptQuestion {
  const TestAttemptQuestion({
    required this.questionId,
    required this.part,
    required this.orderNo,
    required this.type,
    required this.questionText,
    required this.options,
    this.groupId,
    this.positionInGroup,
    this.audioUrl,
    this.imageUrl,
    this.imageDescription,
  });

  final String questionId;
  final int part;
  final int orderNo;
  final String type;
  final String questionText;
  final List<TestAttemptOption> options;
  final String? groupId;
  final int? positionInGroup;
  final String? audioUrl;
  final String? imageUrl;
  final String? imageDescription;

  bool get isListening => part <= 4;
  bool get usesWrittenOptions => part >= 3;
}
