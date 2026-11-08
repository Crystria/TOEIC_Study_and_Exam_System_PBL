/// Typed learning context attached to an AI Chat conversation.
///
/// This model is deliberately independent from Learning and Mock Test models
/// so the AI Chat feature does not need to import other feature packages.
sealed class AiChatContext {
  const AiChatContext();

  String get sourceType;
  String get displayLabel;
  String? get conversationQuestionId => null;

  /// Proposed extended context object for the AI Chat backend contract.
  ///
  /// The currently supplied backend only accepts `question_id`, `vocabulary`
  /// and `grammar`. Do not send this extended map until the backend schema is
  /// updated to accept the additional fields documented in STEP5_5_CONTEXT_CONTRACT.md.
  Map<String, Object?> toApiPayload();

  /// Subset accepted by the currently documented backend context schema.
  /// This is a compatibility mapping, not a complete representation.
  Map<String, Object?> toLegacyBackendContext();
}

final class AiChatContextOption {
  const AiChatContextOption({required this.code, required this.text});

  final String code;
  final String text;

  Map<String, Object?> toApiPayload() => {'code': code, 'text': text};
}

final class AiGrammarLessonContext extends AiChatContext {
  const AiGrammarLessonContext({
    required this.lessonId,
    required this.title,
    required this.category,
    required this.summary,
    required this.content,
    required this.keyTakeaway,
  });

  final String lessonId;
  final String title;
  final String category;
  final String summary;
  final String content;
  final String keyTakeaway;

  @override
  String get sourceType => 'grammar_lesson';

  @override
  String get displayLabel => 'Đang hỏi về bài học: $title';

  @override
  Map<String, Object?> toApiPayload() => {
    'source_type': sourceType,
    'lesson': {
      'id': lessonId,
      'title': title,
      'category': category,
      'summary': summary,
      'content': content,
      'key_takeaway': keyTakeaway,
    },
  };

  @override
  Map<String, Object?> toLegacyBackendContext() => {'grammar': _legacyText};

  String get _legacyText => [
    title,
    'Chủ đề: $category',
    summary,
    content,
    'Ghi nhớ: $keyTakeaway',
  ].where((value) => value.trim().isNotEmpty).join('\n\n');
}

final class AiMockTestSummaryContext extends AiChatContext {
  AiMockTestSummaryContext({
    required this.testId,
    required this.testTitle,
    required this.mode,
    required List<int> parts,
    required this.totalQuestions,
    required this.answeredCount,
    required this.correctCount,
    required this.incorrectCount,
    required this.unansweredCount,
    required this.accuracy,
  }) : parts = List<int>.unmodifiable(parts);

  final String testId;
  final String testTitle;
  final String mode;
  final List<int> parts;
  final int totalQuestions;
  final int answeredCount;
  final int correctCount;
  final int incorrectCount;
  final int unansweredCount;
  final double accuracy;

  @override
  String get sourceType => 'mock_test_summary';

  @override
  String get displayLabel => 'Đang hỏi về kết quả: $testTitle';

  @override
  Map<String, Object?> toApiPayload() => {
    'source_type': sourceType,
    'test': {'id': testId, 'title': testTitle, 'mode': mode, 'parts': parts},
    'result': {
      'total_questions': totalQuestions,
      'answered_count': answeredCount,
      'correct_count': correctCount,
      'incorrect_count': incorrectCount,
      'unanswered_count': unansweredCount,
      'accuracy': accuracy,
    },
  };

  @override
  Map<String, Object?> toLegacyBackendContext() => const {};
}

final class AiMockTestQuestionContext extends AiChatContext {
  AiMockTestQuestionContext({
    required this.testId,
    required this.testTitle,
    required this.questionId,
    required this.part,
    required this.questionNumber,
    required this.questionType,
    required this.questionText,
    required List<AiChatContextOption> options,
    required this.selectedOption,
    required this.correctOption,
    this.explanation,
    this.groupInstruction,
    this.groupTranscript,
    this.groupPassageText,
    this.groupAssetContent,
    this.imageDescription,
  }) : options = List<AiChatContextOption>.unmodifiable(options);

  final String testId;
  final String testTitle;
  final String questionId;
  final int part;
  final int questionNumber;
  final String questionType;
  final String questionText;
  final List<AiChatContextOption> options;
  final String? selectedOption;
  final String correctOption;
  final String? explanation;
  final String? groupInstruction;
  final String? groupTranscript;
  final String? groupPassageText;
  final String? groupAssetContent;
  final String? imageDescription;

  @override
  String get sourceType => 'mock_test_question';

  @override
  String? get conversationQuestionId => questionId;

  @override
  String get displayLabel =>
      'Đang hỏi về: $testTitle · Câu $questionNumber · Part $part';

  @override
  Map<String, Object?> toApiPayload() => {
    'source_type': sourceType,
    'test': {'id': testId, 'title': testTitle},
    'question': {
      'id': questionId,
      'part': part,
      'number': questionNumber,
      'type': questionType,
      'text': questionText,
      'options': options.map((option) => option.toApiPayload()).toList(),
      'selected_option': selectedOption,
      'correct_option': correctOption,
      'explanation': explanation,
      'shared_material': {
        'instruction': groupInstruction,
        'transcript': groupTranscript,
        'passage_text': groupPassageText,
        'asset_content': groupAssetContent,
      },
      'image_description': imageDescription,
    },
  };

  @override
  Map<String, Object?> toLegacyBackendContext() => {'question_id': questionId};
}
