class LearningTopic {
  const LearningTopic({
    required this.id,
    required this.name,
    required this.vocabularyCount,
  });

  final String id;
  final String name;
  final int vocabularyCount;
}

class LearningVocabulary {
  const LearningVocabulary({
    required this.id,
    required this.topicId,
    required this.topicName,
    required this.word,
    required this.phonetic,
    required this.definition,
    required this.example,
    required this.audioUrl,
    required this.imageUrl,
  });

  final String id;
  final String topicId;
  final String topicName;
  final String word;
  final String phonetic;
  final String definition;
  final String example;
  final String audioUrl;
  final String imageUrl;
}

class LearningReviewProgress {
  const LearningReviewProgress({
    required this.entityId,
    required this.revision,
    required this.quality,
    required this.nextReviewDate,
  });

  final String entityId;
  final String revision;
  final int? quality;
  final DateTime? nextReviewDate;
}

class DueLearningVocabulary {
  const DueLearningVocabulary({
    required this.vocabulary,
    required this.revision,
    required this.quality,
    required this.nextReviewDate,
  });

  final LearningVocabulary vocabulary;
  final String revision;
  final int? quality;
  final DateTime? nextReviewDate;
}

class LearningProgressSummary {
  const LearningProgressSummary({
    required this.reviewedVocabularies,
    required this.vocabulariesLearned,
    required this.dueVocabularies,
    required this.grammarLessonsCompleted,
    required this.sessionsCompleted,
    this.updatedAt,
  });

  final int reviewedVocabularies;
  final int vocabulariesLearned;
  final int dueVocabularies;
  final int grammarLessonsCompleted;
  final int sessionsCompleted;
  final DateTime? updatedAt;
}

class LearningMutationReceipt {
  const LearningMutationReceipt({
    required this.operationId,
    required this.entityId,
    required this.revision,
  });

  final String operationId;
  final String entityId;
  final String revision;
}
