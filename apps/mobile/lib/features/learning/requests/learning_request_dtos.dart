class LearningPageQueryDto {
  const LearningPageQueryDto({
    this.page = 1,
    this.size = 50,
    this.keyword,
    this.topicId,
    this.category,
  });

  final int page;
  final int size;
  final String? keyword;
  final String? topicId;
  final String? category;

  Map<String, dynamic> toQueryParameters() {
    if (page < 1) {
      throw ArgumentError.value(page, 'page', 'Page must be at least 1.');
    }
    if (size < 1 || size > 50) {
      throw ArgumentError.value(size, 'size', 'Page size must be 1–50.');
    }

    return {
      'page': page,
      'size': size,
      if (keyword != null && keyword!.trim().isNotEmpty)
        'keyword': keyword!.trim(),
      if (topicId != null && topicId!.trim().isNotEmpty)
        'topicId': topicId!.trim(),
      if (category != null && category!.trim().isNotEmpty)
        'category': category!.trim(),
    };
  }
}

class ReviewFlashcardRequestDto {
  const ReviewFlashcardRequestDto({
    required this.operationId,
    required this.quality,
    required this.baseEntityRevision,
  });

  final String operationId;
  final int quality;
  final String baseEntityRevision;

  Map<String, dynamic> toJson() => {
    'operationId': operationId,
    'quality': quality,
    'baseEntityRevision': baseEntityRevision,
  };
}

class CompleteGrammarLessonRequestDto {
  const CompleteGrammarLessonRequestDto({
    required this.operationId,
    required this.baseEntityRevision,
  });

  final String operationId;
  final String baseEntityRevision;

  Map<String, dynamic> toJson() => {
    'operationId': operationId,
    'baseEntityRevision': baseEntityRevision,
  };
}
