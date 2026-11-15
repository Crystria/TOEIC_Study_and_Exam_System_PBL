import '../models/vocabulary_session_dtos.dart';

final RegExp _uuidV4Pattern = RegExp(
  r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
);

void _requireUuidV4(String value, String field) {
  if (!_uuidV4Pattern.hasMatch(value.trim())) {
    throw ArgumentError.value(value, field, 'A valid UUID v4 is required.');
  }
}

void _requireQuality(int quality) {
  if (quality < 0 || quality > 5) {
    throw ArgumentError.value(
      quality,
      'quality',
      'Quality must be between 0 and 5.',
    );
  }
}

class CreateVocabularySessionRequestDto {
  CreateVocabularySessionRequestDto({
    required this.topicId,
    required this.mode,
  }) {
    _requireUuidV4(topicId, 'topicId');
  }

  final String topicId;
  final VocabularySessionMode mode;

  Map<String, dynamic> toJson() => {'topicId': topicId, 'mode': mode.apiValue};
}

class VocabularySessionReviewRequestDto {
  VocabularySessionReviewRequestDto({
    required this.vocabularyId,
    required this.quality,
  }) {
    _requireUuidV4(vocabularyId, 'vocabularyId');
    _requireQuality(quality);
  }

  final String vocabularyId;
  final int quality;

  Map<String, dynamic> toJson() => {
    'vocabularyId': vocabularyId,
    'quality': quality,
  };
}

class VocabularySessionAnswerRequestDto {
  VocabularySessionAnswerRequestDto({
    required this.questionId,
    required this.selectedOption,
  }) {
    _requireUuidV4(questionId, 'questionId');

    if (!const ['A', 'B', 'C', 'D'].contains(selectedOption)) {
      throw ArgumentError.value(
        selectedOption,
        'selectedOption',
        'Selected option must be A, B, C or D.',
      );
    }
  }

  final String questionId;
  final String selectedOption;

  Map<String, dynamic> toJson() => {
    'questionId': questionId,
    'selectedOption': selectedOption,
  };
}

class SaveVocabularySessionReviewsRequestDto {
  SaveVocabularySessionReviewsRequestDto({
    required List<VocabularySessionReviewRequestDto> reviews,
  }) : reviews = List.unmodifiable(reviews) {
    if (this.reviews.isEmpty || this.reviews.length > 5) {
      throw ArgumentError.value(
        this.reviews.length,
        'reviews',
        'A draft must contain between 1 and 5 reviews.',
      );
    }

    final ids = this.reviews.map((item) => item.vocabularyId);
    if (ids.toSet().length != this.reviews.length) {
      throw ArgumentError(
        'Draft reviews cannot contain duplicate vocabulary IDs.',
      );
    }
  }

  final List<VocabularySessionReviewRequestDto> reviews;

  Map<String, dynamic> toJson() => {
    'reviews': reviews.map((item) => item.toJson()).toList(),
  };
}

class SubmitVocabularySessionRequestDto {
  SubmitVocabularySessionRequestDto({
    required this.operationId,
    required List<VocabularySessionReviewRequestDto> reviews,
    required List<VocabularySessionAnswerRequestDto> answers,
  }) : reviews = List.unmodifiable(reviews),
       answers = List.unmodifiable(answers) {
    _requireUuidV4(operationId, 'operationId');

    if (this.reviews.length != 5 || this.answers.length != 5) {
      throw ArgumentError(
        'Session submit requires exactly 5 reviews and 5 answers.',
      );
    }

    final reviewIds = this.reviews.map((item) => item.vocabularyId);
    final questionIds = this.answers.map((item) => item.questionId);

    if (reviewIds.toSet().length != 5) {
      throw ArgumentError(
        'Session submit cannot contain duplicate vocabulary IDs.',
      );
    }

    if (questionIds.toSet().length != 5) {
      throw ArgumentError(
        'Session submit cannot contain duplicate question IDs.',
      );
    }
  }

  final String operationId;
  final List<VocabularySessionReviewRequestDto> reviews;
  final List<VocabularySessionAnswerRequestDto> answers;

  Map<String, dynamic> toJson() => {
    'operationId': operationId,
    'reviews': reviews.map((item) => item.toJson()).toList(),
    'answers': answers.map((item) => item.toJson()).toList(),
  };
}
