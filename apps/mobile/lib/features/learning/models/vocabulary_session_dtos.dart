import 'learning_dtos.dart';

enum VocabularySessionMode {
  newWords('NEW'),
  review('REVIEW');

  const VocabularySessionMode(this.apiValue);

  final String apiValue;

  static VocabularySessionMode fromApiValue(String value) {
    return switch (value) {
      'NEW' => VocabularySessionMode.newWords,
      'REVIEW' => VocabularySessionMode.review,
      _ => throw FormatException('Unsupported session mode: $value.'),
    };
  }
}

enum VocabularySessionStatus {
  inProgress('IN_PROGRESS'),
  completed('COMPLETED'),
  canceled('CANCELED'),
  expired('EXPIRED');

  const VocabularySessionStatus(this.apiValue);

  final String apiValue;

  static VocabularySessionStatus fromApiValue(String value) {
    return switch (value) {
      'IN_PROGRESS' => VocabularySessionStatus.inProgress,
      'COMPLETED' => VocabularySessionStatus.completed,
      'CANCELED' => VocabularySessionStatus.canceled,
      'EXPIRED' => VocabularySessionStatus.expired,
      _ => throw FormatException('Unsupported session status: $value.'),
    };
  }
}

enum VocabularyQuizDirection {
  wordToMeaning('WORD_TO_MEANING'),
  meaningToWord('MEANING_TO_WORD');

  const VocabularyQuizDirection(this.apiValue);

  final String apiValue;

  static VocabularyQuizDirection fromApiValue(String value) {
    return switch (value) {
      'WORD_TO_MEANING' => VocabularyQuizDirection.wordToMeaning,
      'MEANING_TO_WORD' => VocabularyQuizDirection.meaningToWord,
      _ => throw FormatException('Unsupported quiz direction: $value.'),
    };
  }
}

String _requiredApiEnum(Map<String, dynamic> json, String key) {
  return learningRequiredString(json, key);
}

DateTime _requiredSessionTimestamp(Object? value, String fieldName) {
  if (value is! String || !value.endsWith('Z')) {
    throw FormatException(
      '$fieldName must be an RFC3339 UTC timestamp ending with Z.',
    );
  }

  final parsed = DateTime.tryParse(value);
  if (parsed == null || !parsed.isUtc) {
    throw FormatException('$fieldName is not a valid UTC timestamp.');
  }

  return parsed.toLocal();
}

List<Object?> _requiredFixedList(
  Map<String, dynamic> json,
  String key, {
  required int length,
}) {
  final value = json[key];

  if (value is! List || value.length != length) {
    throw FormatException('$key must contain exactly $length items.');
  }

  return List<Object?>.from(value);
}

List<Object?> _optionalList(Map<String, dynamic> json, String key) {
  final value = json[key];

  if (value == null) return const [];

  if (value is! List) {
    throw FormatException('$key must be a list.');
  }

  return List<Object?>.from(value);
}

void _validateQuality(int quality) {
  if (quality < 0 || quality > 5) {
    throw ArgumentError.value(
      quality,
      'quality',
      'Quality must be between 0 and 5.',
    );
  }
}

bool _allUnique<T>(Iterable<T> values) {
  final list = values.toList(growable: false);
  return list.toSet().length == list.length;
}

String _optionCode(Map<String, dynamic> json) {
  final code = learningRequiredString(json, 'code');

  if (!const ['A', 'B', 'C', 'D'].contains(code)) {
    throw FormatException('Invalid quiz option code: $code.');
  }

  return code;
}

class VocabularySessionOptionDto {
  const VocabularySessionOptionDto({required this.code, required this.text});

  final String code;
  final String text;

  factory VocabularySessionOptionDto.fromObject(Object? value) {
    final json = learningJsonMap(value, context: 'Session quiz option');

    return VocabularySessionOptionDto(
      code: _optionCode(json),
      text: learningRequiredString(json, 'text'),
    );
  }
}

class VocabularySessionQuestionDto {
  const VocabularySessionQuestionDto({
    required this.questionId,
    required this.vocabularyId,
    required this.prompt,
    required this.direction,
    required this.options,
  });

  final String questionId;
  final String vocabularyId;
  final String prompt;
  final VocabularyQuizDirection direction;
  final List<VocabularySessionOptionDto> options;

  factory VocabularySessionQuestionDto.fromObject(Object? value) {
    final json = learningJsonMap(value, context: 'Session quiz question');

    final rawOptions = _requiredFixedList(json, 'options', length: 4);

    final options = rawOptions
        .map(VocabularySessionOptionDto.fromObject)
        .toList(growable: false);

    if (!_allUnique(options.map((item) => item.code)) ||
        !options.map((item) => item.code).toSet().containsAll(const [
          'A',
          'B',
          'C',
          'D',
        ])) {
      throw const FormatException(
        'Quiz options must contain unique codes A, B, C and D.',
      );
    }

    return VocabularySessionQuestionDto(
      questionId: learningRequiredString(json, 'questionId'),
      vocabularyId: learningRequiredString(json, 'vocabularyId'),
      prompt: learningRequiredString(json, 'prompt'),
      direction: VocabularyQuizDirection.fromApiValue(
        _requiredApiEnum(json, 'direction'),
      ),
      options: List.unmodifiable(options),
    );
  }
}

class VocabularySessionReviewDto {
  const VocabularySessionReviewDto({
    required this.vocabularyId,
    required this.quality,
  });

  final String vocabularyId;
  final int quality;

  factory VocabularySessionReviewDto.fromObject(Object? value) {
    final json = learningJsonMap(value, context: 'Session review');
    final quality = learningRequiredInt(json['quality'], 'quality');

    _validateQuality(quality);

    return VocabularySessionReviewDto(
      vocabularyId: learningRequiredString(json, 'vocabularyId'),
      quality: quality,
    );
  }
}

class VocabularySessionAnswerResultDto {
  const VocabularySessionAnswerResultDto({
    required this.questionId,
    required this.selectedOption,
    required this.correctOption,
    required this.isCorrect,
  });

  final String questionId;
  final String selectedOption;
  final String correctOption;
  final bool isCorrect;

  factory VocabularySessionAnswerResultDto.fromObject(Object? value) {
    final json = learningJsonMap(value, context: 'Session answer result');

    String readOption(String key) {
      final result = learningRequiredString(json, key);
      if (!const ['A', 'B', 'C', 'D'].contains(result)) {
        throw FormatException('Invalid $key: $result.');
      }
      return result;
    }

    final isCorrect = json['isCorrect'];
    if (isCorrect is! bool) {
      throw const FormatException('isCorrect must be a boolean.');
    }

    return VocabularySessionAnswerResultDto(
      questionId: learningRequiredString(json, 'questionId'),
      selectedOption: readOption('selectedOption'),
      correctOption: readOption('correctOption'),
      isCorrect: isCorrect,
    );
  }
}

class VocabularySessionProgressSnapshotDto {
  const VocabularySessionProgressSnapshotDto({
    required this.entityId,
    required this.revision,
    required this.state,
  });

  final String entityId;
  final String revision;
  final Map<String, dynamic> state;

  factory VocabularySessionProgressSnapshotDto.fromObject(Object? value) {
    final json = learningJsonMap(value, context: 'Session progress snapshot');

    final entityType = learningRequiredString(json, 'entityType');
    if (entityType != 'VOCABULARY') {
      throw const FormatException(
        'Session result must contain vocabulary progress snapshots.',
      );
    }

    final revision = learningRequiredString(json, 'revision');
    final parsedRevision = BigInt.tryParse(revision);

    if (parsedRevision == null || parsedRevision.isNegative) {
      throw const FormatException('Invalid progress revision.');
    }

    final state = learningJsonMap(
      json['state'],
      context: 'Session vocabulary progress state',
    );

    return VocabularySessionProgressSnapshotDto(
      entityId: learningRequiredString(json, 'entityId'),
      revision: revision,
      state: Map<String, dynamic>.unmodifiable(state),
    );
  }
}

class VocabularySessionResultDto {
  const VocabularySessionResultDto({
    required this.sessionId,
    required this.operationId,
    required this.quizScore,
    required this.quizTotal,
    required this.completedAt,
    required this.answers,
    required this.progress,
  });

  final String sessionId;
  final String operationId;
  final int quizScore;
  final int quizTotal;
  final DateTime completedAt;
  final List<VocabularySessionAnswerResultDto> answers;
  final List<VocabularySessionProgressSnapshotDto> progress;

  factory VocabularySessionResultDto.fromObject(
    Object? value, {
    String? expectedSessionId,
  }) {
    final json = learningJsonMap(value, context: 'Vocabulary session result');

    if (learningRequiredString(json, 'status') != 'COMPLETED') {
      throw const FormatException('Session result must have COMPLETED status.');
    }

    final sessionId = learningRequiredString(json, 'sessionId');
    if (expectedSessionId != null && sessionId != expectedSessionId) {
      throw const FormatException(
        'Session result ID does not match the requested session.',
      );
    }

    final quizScore = learningRequiredInt(json['quizScore'], 'quizScore');
    final quizTotal = learningRequiredInt(json['quizTotal'], 'quizTotal');

    if (quizTotal != 5 || quizScore < 0 || quizScore > quizTotal) {
      throw const FormatException('Invalid session quiz score.');
    }

    final rawAnswers = _requiredFixedList(json, 'answers', length: 5);
    final answers = rawAnswers
        .map(VocabularySessionAnswerResultDto.fromObject)
        .toList(growable: false);

    if (!_allUnique(answers.map((item) => item.questionId))) {
      throw const FormatException(
        'Session result contains duplicate question IDs.',
      );
    }

    final actualScore = answers.where((item) => item.isCorrect).length;
    if (actualScore != quizScore) {
      throw const FormatException(
        'quizScore does not match the answer results.',
      );
    }

    final rawProgress = _requiredFixedList(json, 'progress', length: 5);
    final progress = rawProgress
        .map(VocabularySessionProgressSnapshotDto.fromObject)
        .toList(growable: false);

    if (!_allUnique(progress.map((item) => item.entityId))) {
      throw const FormatException(
        'Session result contains duplicate progress IDs.',
      );
    }

    return VocabularySessionResultDto(
      sessionId: sessionId,
      operationId: learningRequiredString(json, 'operationId'),
      quizScore: quizScore,
      quizTotal: quizTotal,
      completedAt: _requiredSessionTimestamp(
        json['completedAt'],
        'completedAt',
      ),
      answers: List.unmodifiable(answers),
      progress: List.unmodifiable(progress),
    );
  }
}

class VocabularySessionDto {
  const VocabularySessionDto({
    required this.sessionId,
    required this.topicId,
    required this.mode,
    required this.status,
    required this.startedAt,
    required this.expiresAt,
    required this.vocabularies,
    required this.quiz,
    required this.reviews,
    this.result,
  });

  final String sessionId;
  final String topicId;
  final VocabularySessionMode mode;
  final VocabularySessionStatus status;
  final DateTime startedAt;
  final DateTime expiresAt;
  final List<LearningVocabularyDto> vocabularies;
  final List<VocabularySessionQuestionDto> quiz;
  final List<VocabularySessionReviewDto> reviews;
  final VocabularySessionResultDto? result;

  factory VocabularySessionDto.fromObject(Object? value) {
    final json = learningJsonMap(value, context: 'Vocabulary session');

    final rawVocabularies = _requiredFixedList(json, 'vocabularies', length: 5);
    final vocabularies = rawVocabularies
        .map(LearningVocabularyDto.fromObject)
        .toList(growable: false);

    final vocabularyIds = vocabularies.map((item) => item.vocabularyId).toSet();

    if (vocabularyIds.length != 5) {
      throw const FormatException('Session contains duplicate vocabulary IDs.');
    }

    final rawQuiz = _requiredFixedList(json, 'quiz', length: 5);
    final quiz = rawQuiz
        .map(VocabularySessionQuestionDto.fromObject)
        .toList(growable: false);

    if (!_allUnique(quiz.map((item) => item.questionId)) ||
        !_allUnique(quiz.map((item) => item.vocabularyId)) ||
        !quiz.every((item) => vocabularyIds.contains(item.vocabularyId))) {
      throw const FormatException(
        'Session quiz does not match its vocabulary snapshots.',
      );
    }

    final reviews = _optionalList(
      json,
      'reviews',
    ).map(VocabularySessionReviewDto.fromObject).toList(growable: false);

    if (!_allUnique(reviews.map((item) => item.vocabularyId)) ||
        !reviews.every((item) => vocabularyIds.contains(item.vocabularyId))) {
      throw const FormatException(
        'Session reviews contain invalid or duplicate vocabulary IDs.',
      );
    }

    final sessionId = learningRequiredString(json, 'sessionId');
    final rawResult = json['result'];
    final result = rawResult == null
        ? null
        : VocabularySessionResultDto.fromObject(
            rawResult,
            expectedSessionId: sessionId,
          );

    return VocabularySessionDto(
      sessionId: sessionId,
      topicId: learningRequiredString(json, 'topicId'),
      mode: VocabularySessionMode.fromApiValue(_requiredApiEnum(json, 'mode')),
      status: VocabularySessionStatus.fromApiValue(
        _requiredApiEnum(json, 'status'),
      ),
      startedAt: _requiredSessionTimestamp(json['startedAt'], 'startedAt'),
      expiresAt: _requiredSessionTimestamp(json['expiresAt'], 'expiresAt'),
      vocabularies: List.unmodifiable(vocabularies),
      quiz: List.unmodifiable(quiz),
      reviews: List.unmodifiable(reviews),
      result: result,
    );
  }
}

class LearningSessionActionReceiptDto {
  const LearningSessionActionReceiptDto({required this.success});

  final bool success;

  factory LearningSessionActionReceiptDto.fromObject(Object? value) {
    final json = learningJsonMap(
      value,
      context: 'Learning session action receipt',
    );
    final success = json['success'];

    if (success is! bool || !success) {
      throw const FormatException(
        'Learning session action was not confirmed successful.',
      );
    }

    return LearningSessionActionReceiptDto(success: success);
  }
}
