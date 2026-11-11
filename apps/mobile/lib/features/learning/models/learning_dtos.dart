import 'learning_models.dart';
import 'grammar_lesson.dart';

Map<String, dynamic> learningJsonMap(Object? value, {required String context}) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  throw FormatException('$context must be a JSON object.');
}

String learningRequiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('Missing or invalid field: $key.');
  }
  return value.trim();
}

String learningOptionalString(
  Map<String, dynamic> json,
  String key, {
  String fallback = '',
}) {
  final value = json[key];
  if (value == null) return fallback;
  if (value is! String) {
    throw FormatException('$key must be a string.');
  }
  return value.trim();
}

int learningRequiredInt(Object? value, String fieldName) {
  if (value is int) return value;
  if (value is double && value.isFinite && value == value.roundToDouble()) {
    return value.toInt();
  }
  throw FormatException('$fieldName must be an integer.');
}

DateTime? learningDate(Object? value, String fieldName) {
  if (value == null) return null;
  if (value is! String) {
    throw FormatException('$fieldName must be a date-time string.');
  }
  final parsed = DateTime.tryParse(value);
  if (parsed == null) {
    throw FormatException('$fieldName is not a valid date-time.');
  }
  return parsed.toLocal();
}

class LearningPageDto<T> {
  const LearningPageDto({
    required this.items,
    required this.total,
    required this.page,
    required this.size,
    required this.totalPages,
  });

  final List<T> items;
  final int total;
  final int page;
  final int size;
  final int totalPages;

  factory LearningPageDto.fromObject(
    Object? value, {
    required T Function(Object? item) parseItem,
  }) {
    final json = learningJsonMap(value, context: 'Learning page');
    final rawItems = json['items'];
    if (rawItems is! List) {
      throw const FormatException('Learning page items must be a list.');
    }

    final page = learningRequiredInt(json['page'], 'page');
    final size = learningRequiredInt(json['size'], 'size');
    final total = learningRequiredInt(json['total'], 'total');
    final totalPages = learningRequiredInt(json['totalPages'], 'totalPages');

    final expectedTotalPages = total == 0 ? 0 : (total / size).ceil();
    if (page < 1 ||
        size < 1 ||
        size > 50 ||
        rawItems.length > size ||
        total < 0 ||
        totalPages != expectedTotalPages ||
        page > (totalPages == 0 ? 1 : totalPages) ||
        (total == 0 && rawItems.isNotEmpty)) {
      throw const FormatException('Learning pagination metadata is invalid.');
    }

    return LearningPageDto<T>(
      items: rawItems.map(parseItem).toList(growable: false),
      total: total,
      page: page,
      size: size,
      totalPages: totalPages,
    );
  }
}

class LearningTopicDto {
  const LearningTopicDto({
    required this.topicId,
    required this.topicName,
    required this.vocabularyCount,
  });

  final String topicId;
  final String topicName;
  final int vocabularyCount;

  factory LearningTopicDto.fromObject(Object? value) {
    final json = learningJsonMap(value, context: 'Learning topic');
    return LearningTopicDto(
      topicId: learningRequiredString(json, 'topicId'),
      topicName: learningRequiredString(json, 'topicName'),
      vocabularyCount: learningRequiredInt(
        json['vocabularyCount'],
        'vocabularyCount',
      ),
    );
  }

  LearningTopic toDomain() => LearningTopic(
    id: topicId,
    name: topicName,
    vocabularyCount: vocabularyCount,
  );
}

class LearningVocabularyDto {
  const LearningVocabularyDto({
    required this.vocabularyId,
    required this.topicId,
    required this.word,
    required this.phonetic,
    required this.definition,
    required this.example,
    required this.audioUrl,
    required this.imageUrl,
  });

  final String vocabularyId;
  final String topicId;
  final String word;
  final String phonetic;
  final String definition;
  final String example;
  final String audioUrl;
  final String imageUrl;

  factory LearningVocabularyDto.fromObject(Object? value) {
    final json = learningJsonMap(value, context: 'Learning vocabulary');
    return LearningVocabularyDto(
      vocabularyId: learningRequiredString(json, 'vocabularyId'),
      topicId: learningRequiredString(json, 'topicId'),
      word: learningRequiredString(json, 'word'),
      phonetic: learningOptionalString(json, 'phonetic'),
      definition: learningRequiredString(json, 'definition'),
      example: learningOptionalString(json, 'example'),
      audioUrl: learningOptionalString(json, 'audioUrl'),
      imageUrl: learningOptionalString(json, 'imageUrl'),
    );
  }

  LearningVocabulary toDomain({required String topicName}) =>
      LearningVocabulary(
        id: vocabularyId,
        topicId: topicId,
        topicName: topicName,
        word: word,
        phonetic: phonetic,
        definition: definition,
        example: example,
        audioUrl: audioUrl,
        imageUrl: imageUrl,
      );
}

class LearningGrammarLessonDto {
  const LearningGrammarLessonDto({
    required this.lessonId,
    required this.lessonTitle,
    required this.category,
    required this.contentMarkdown,
    required this.contentHtml,
    required this.status,
  });

  final String lessonId;
  final String lessonTitle;
  final String category;
  final String contentMarkdown;
  final String contentHtml;
  final String status;

  factory LearningGrammarLessonDto.fromObject(Object? value) {
    final json = learningJsonMap(value, context: 'Grammar lesson');
    final markdown = json['contentMarkdown'];
    final html = json['contentHtml'];

    if (markdown is! String || markdown.trim().isEmpty) {
      throw const FormatException('contentMarkdown is missing or invalid.');
    }
    if (html != null && html is! String) {
      throw const FormatException('contentHtml has an invalid type.');
    }

    return LearningGrammarLessonDto(
      lessonId: learningRequiredString(json, 'lessonId'),
      lessonTitle: learningRequiredString(json, 'lessonTitle'),
      category: learningRequiredString(json, 'category'),
      contentMarkdown: markdown,
      contentHtml: html as String? ?? '',
      status: learningRequiredString(json, 'status'),
    );
  }

  GrammarLesson toDomain() {
    final sections = _markdownSections(contentMarkdown);
    final summary = _markdownSummary(contentMarkdown);
    return GrammarLesson(
      id: lessonId,
      title: lessonTitle,
      category: category,
      summary: summary,
      level: null,
      durationMinutes: null,
      sections: sections,
      keyTakeaway: null,
      contentMarkdown: contentMarkdown,
      contentHtml: contentHtml,
      serverStatus: status,
    );
  }

  static String _markdownSummary(String markdown) {
    final lines = markdown.split('\n');
    for (final line in lines) {
      final trimmed = line.trim();
      if (trimmed.isEmpty || trimmed.startsWith('#')) continue;
      final summary = _plainText(trimmed);
      if (summary.isNotEmpty) return summary;
    }
    return 'Nội dung bài học ngữ pháp.';
  }

  static List<GrammarLessonSection> _markdownSections(String markdown) {
    final result = <GrammarLessonSection>[];
    var currentTitle = 'Nội dung bài học';
    final currentLines = <String>[];

    void flush() {
      final explanation = _plainText(currentLines.join('\n')).trim();
      if (explanation.isNotEmpty) {
        result.add(
          GrammarLessonSection(title: currentTitle, explanation: explanation),
        );
      }
      currentLines.clear();
    }

    for (final sourceLine in markdown.split('\n')) {
      final line = sourceLine.trimRight();
      final heading = RegExp(r'^#{1,6}\s+(.+)$').firstMatch(line.trim());
      if (heading != null) {
        flush();
        currentTitle = _plainText(heading.group(1) ?? 'Nội dung');
      } else {
        currentLines.add(line);
      }
    }
    flush();

    if (result.isEmpty) {
      result.add(
        GrammarLessonSection(
          title: 'Nội dung bài học',
          explanation: _plainText(markdown),
        ),
      );
    }
    return List.unmodifiable(result);
  }

  static String _plainText(String source) {
    return source
        .replaceAll(RegExp(r'!\[([^\]]*)\]\([^)]*\)'), r'$1')
        .replaceAll(RegExp(r'\[([^\]]+)\]\(([^)]+)\)'), r'$1 ($2)')
        .replaceAll(RegExp(r'`([^`]+)`'), r'$1')
        .replaceAll(RegExp(r'\*\*(.+?)\*\*'), r'$1')
        .replaceAll(RegExp(r'__(.+?)__'), r'$1')
        .replaceAll(RegExp(r'(?<!\*)\*([^*]+)\*(?!\*)'), r'$1')
        .replaceAll(RegExp(r'^\s*[-*+]\s+', multiLine: true), '• ')
        .replaceAll(RegExp(r'^\s*>\s?', multiLine: true), '')
        .trim();
  }
}

class LearningReviewProgressDto {
  const LearningReviewProgressDto({
    required this.entityId,
    required this.revision,
    this.quality,
    this.nextReviewDate,
  });

  final String entityId;
  final String revision;
  final int? quality;
  final DateTime? nextReviewDate;

  factory LearningReviewProgressDto.fromObject(Object? value) {
    final json = learningJsonMap(value, context: 'Review progress');
    final entityType = learningRequiredString(json, 'entityType');
    if (entityType != 'VOCABULARY') {
      throw const FormatException(
        'Review progress contains an unsupported entity type.',
      );
    }
    final state = json['state'] == null
        ? <String, dynamic>{}
        : learningJsonMap(json['state'], context: 'Review progress state');
    return LearningReviewProgressDto(
      entityId: learningRequiredString(json, 'entityId'),
      revision: learningRequiredString(json, 'revision'),
      quality: state['quality'] == null
          ? null
          : _validatedQuality(state['quality']),
      nextReviewDate: learningDate(state['nextReviewDate'], 'nextReviewDate'),
    );
  }

  static int _validatedQuality(Object? value) {
    final quality = learningRequiredInt(value, 'quality');
    if (quality < 0 || quality > 5) {
      throw const FormatException('quality must be between 0 and 5.');
    }
    return quality;
  }

  LearningReviewProgress toDomain() => LearningReviewProgress(
    entityId: entityId,
    revision: revision,
    quality: quality,
    nextReviewDate: nextReviewDate,
  );
}

class LearningMutationReceiptDto {
  const LearningMutationReceiptDto({
    required this.operationId,
    required this.entityId,
    required this.revision,
  });

  final String operationId;
  final String entityId;
  final String revision;

  factory LearningMutationReceiptDto.fromObject(
    Object? value, {
    required String expectedEntityId,
    required String expectedOperationId,
    required String expectedEntityType,
  }) {
    final json = learningJsonMap(value, context: 'Learning mutation result');
    final operationId = learningRequiredString(json, 'operationId');
    if (operationId != expectedOperationId) {
      throw const FormatException(
        'Mutation returned a different operation ID.',
      );
    }
    final rawProgress = json['progress'];
    if (rawProgress is! List || rawProgress.length != 1) {
      throw const FormatException(
        'Mutation progress must contain exactly one item.',
      );
    }

    final first = learningJsonMap(rawProgress.first, context: 'Progress item');
    final entityType = learningRequiredString(first, 'entityType');
    if (entityType != expectedEntityType) {
      throw const FormatException('Mutation returned a different entity type.');
    }
    final entityId = learningRequiredString(first, 'entityId');
    final revision = learningRequiredString(first, 'revision');
    final parsedRevision = BigInt.tryParse(revision);
    if (parsedRevision == null || parsedRevision.isNegative) {
      throw const FormatException('Mutation revision is invalid.');
    }
    if (entityId != expectedEntityId) {
      throw const FormatException('Mutation returned a different entity ID.');
    }

    return LearningMutationReceiptDto(
      operationId: operationId,
      entityId: entityId,
      revision: revision,
    );
  }

  LearningMutationReceipt toDomain() => LearningMutationReceipt(
    operationId: operationId,
    entityId: entityId,
    revision: revision,
  );
}

class LearningProgressSummaryDto {
  const LearningProgressSummaryDto({
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

  factory LearningProgressSummaryDto.fromObject(Object? value) {
    final json = learningJsonMap(value, context: 'Learning progress summary');
    return LearningProgressSummaryDto(
      reviewedVocabularies: learningRequiredInt(
        json['reviewedVocabularies'],
        'reviewedVocabularies',
      ),
      vocabulariesLearned: learningRequiredInt(
        json['vocabulariesLearned'],
        'vocabulariesLearned',
      ),
      dueVocabularies: learningRequiredInt(
        json['dueVocabularies'],
        'dueVocabularies',
      ),
      grammarLessonsCompleted: learningRequiredInt(
        json['grammarLessonsCompleted'],
        'grammarLessonsCompleted',
      ),
      sessionsCompleted: learningRequiredInt(
        json['sessionsCompleted'],
        'sessionsCompleted',
      ),
      updatedAt: learningDate(json['updatedAt'], 'updatedAt'),
    );
  }

  LearningProgressSummary toDomain() => LearningProgressSummary(
    reviewedVocabularies: reviewedVocabularies,
    vocabulariesLearned: vocabulariesLearned,
    dueVocabularies: dueVocabularies,
    grammarLessonsCompleted: grammarLessonsCompleted,
    sessionsCompleted: sessionsCompleted,
    updatedAt: updatedAt,
  );
}
