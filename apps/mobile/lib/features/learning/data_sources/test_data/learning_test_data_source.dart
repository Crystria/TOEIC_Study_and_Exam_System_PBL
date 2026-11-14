import 'dart:convert';

import 'package:flutter/services.dart';

import '../../models/learning_dtos.dart';
import '../../requests/learning_request_dtos.dart';
import '../learning_content_data_source.dart';

/// Development-only fixture source. The loader is injectable so fixture
/// parsing can be tested without depending on the platform asset bundle.
class LearningTestDataSource implements LearningContentDataSource {
  LearningTestDataSource({
    Future<String> Function(String path)? loadAsset,
    this.assetDirectory = 'test_data/learning',
  }) : _loadAsset = loadAsset ?? _loadFromBundle;

  final Future<String> Function(String path) _loadAsset;
  final String assetDirectory;

  Future<Map<String, dynamic>>? _vocabularyCatalogFuture;
  Future<Map<String, dynamic>>? _grammarCatalogFuture;

  static Future<String> _loadFromBundle(String path) =>
      rootBundle.loadString(path);

  Future<Map<String, dynamic>> _loadJson(String filename) async {
    final raw = await _loadAsset('$assetDirectory/$filename');
    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      throw FormatException('Learning fixture $filename must be an object.');
    }
    return Map<String, dynamic>.from(decoded);
  }

  Future<Map<String, dynamic>> _vocabularyCatalog() =>
      _vocabularyCatalogFuture ??= _loadJson(
        'vocabulary_catalog_current_source.json',
      );

  Future<Map<String, dynamic>> _grammarCatalog() => _grammarCatalogFuture ??=
      _loadJson('grammar_catalog_current_source.json');

  List<Map<String, dynamic>> _readItems(
    Map<String, dynamic> json,
    String filename,
  ) {
    final raw = json['items'];
    if (raw is! List) {
      throw FormatException('Learning fixture $filename has no items list.');
    }
    return raw
        .map((item) {
          if (item is! Map) {
            throw FormatException(
              'Learning fixture $filename has an invalid item.',
            );
          }
          return Map<String, dynamic>.from(item);
        })
        .toList(growable: false);
  }

  Future<List<LearningTopicDto>> _topics() async {
    final json = await _vocabularyCatalog();
    final rawTopics = json['topicCountsDeclaredByVocabularyTopicsProvider'];
    if (rawTopics is! List) {
      throw const FormatException(
        'Vocabulary fixture topic metadata is missing.',
      );
    }
    return rawTopics
        .map((raw) {
          if (raw is! Map) {
            throw const FormatException('Vocabulary fixture topic is invalid.');
          }
          final topic = Map<String, dynamic>.from(raw);
          return LearningTopicDto(
            topicId: _requiredString(topic, 'id'),
            topicName: _requiredString(topic, 'name'),
            vocabularyCount: _requiredInt(topic, 'total'),
          );
        })
        .toList(growable: false);
  }

  Future<List<LearningVocabularyDto>> _vocabularies() async {
    final json = await _vocabularyCatalog();
    return _readItems(json, 'vocabulary_catalog_current_source.json')
        .map((item) {
          final normalized = <String, dynamic>{
            'vocabularyId': item['id'],
            'topicId': item['topicId'],
            'word': item['word'],
            'phonetic': item['phonetic'],
            'definition': item['definition'],
            'example': item['example'],
            'audioUrl': item['audioUrl'],
            'imageUrl': item['imageUrl'] ?? '',
          };
          return LearningVocabularyDto.fromObject(normalized);
        })
        .toList(growable: false);
  }

  Future<List<LearningGrammarLessonDto>> _grammarLessons() async {
    final json = await _grammarCatalog();
    return _readItems(
      json,
      'grammar_catalog_current_source.json',
    ).map(LearningGrammarLessonDto.fromObject).toList(growable: false);
  }

  List<T> _page<T>(List<T> items, LearningPageQueryDto query) {
    if (query.page < 1 || query.size < 1 || query.size > 50) {
      throw ArgumentError('Invalid Learning fixture pagination request.');
    }
    final start = (query.page - 1) * query.size;
    if (start >= items.length) return <T>[];
    final end = (start + query.size).clamp(0, items.length).toInt();
    return items.sublist(start, end);
  }

  LearningPageDto<T> _pageDto<T>(List<T> items, LearningPageQueryDto query) {
    final totalPages = items.isEmpty ? 0 : (items.length / query.size).ceil();
    return LearningPageDto<T>(
      items: _page(items, query),
      total: items.length,
      page: query.page,
      size: query.size,
      totalPages: totalPages,
    );
  }

  @override
  Future<LearningPageDto<LearningTopicDto>> listTopics({
    required LearningPageQueryDto query,
  }) async => _pageDto(await _topics(), query);

  @override
  Future<LearningTopicDto> getTopic(String topicId) async {
    final topics = await _topics();
    return topics.firstWhere(
      (topic) => topic.topicId == topicId,
      orElse: () => throw StateError('Learning topic not found: $topicId'),
    );
  }

  @override
  Future<LearningPageDto<LearningVocabularyDto>> listVocabularies({
    required LearningPageQueryDto query,
  }) async {
    var items = await _vocabularies();
    final topicId = query.topicId?.trim();
    if (topicId != null && topicId.isNotEmpty) {
      items = items.where((item) => item.topicId == topicId).toList();
    }
    final keyword = query.keyword?.trim().toLowerCase();
    if (keyword != null && keyword.isNotEmpty) {
      items = items
          .where(
            (item) =>
                item.word.toLowerCase().contains(keyword) ||
                item.definition.toLowerCase().contains(keyword),
          )
          .toList();
    }
    return _pageDto(items, query);
  }

  @override
  Future<LearningVocabularyDto> getVocabulary(String vocabularyId) async {
    final items = await _vocabularies();
    return items.firstWhere(
      (item) => item.vocabularyId == vocabularyId,
      orElse: () => throw StateError('Vocabulary not found: $vocabularyId'),
    );
  }

  @override
  Future<LearningPageDto<LearningGrammarLessonDto>> listGrammarLessons({
    required LearningPageQueryDto query,
  }) async {
    var items = await _grammarLessons();
    final category = query.category?.trim().toLowerCase();
    if (category != null && category.isNotEmpty) {
      items = items
          .where((item) => item.category.toLowerCase() == category)
          .toList();
    }
    return _pageDto(items, query);
  }

  @override
  Future<LearningGrammarLessonDto> getGrammarLesson(String lessonId) async {
    final items = await _grammarLessons();
    return items.firstWhere(
      (item) => item.lessonId == lessonId,
      orElse: () => throw StateError('Grammar lesson not found: $lessonId'),
    );
  }

  @override
  Future<LearningPageDto<LearningReviewProgressDto>> listDueReviews({
    required LearningPageQueryDto query,
  }) async {
    final vocabularies = await _vocabularies();
    final topics = await _topics();
    final topicIds = {for (final topic in topics) topic.topicId};
    final vocabularyJson = await _vocabularyCatalog();
    final sourceItems = _readItems(
      vocabularyJson,
      'vocabulary_catalog_current_source.json',
    );
    final grades = <String, int>{
      for (final item in sourceItems)
        if (item['id'] is String)
          item['id'] as String: (item['masteryGrade'] as num?)?.toInt() ?? 1,
    };
    final topicId = query.topicId?.trim();
    final items = vocabularies
        .where((item) => topicIds.contains(item.topicId))
        .where(
          (item) =>
              topicId == null || topicId.isEmpty || item.topicId == topicId,
        )
        .map(
          (item) => LearningReviewProgressDto(
            entityId: item.vocabularyId,
            revision: '0',
            quality: grades[item.vocabularyId] ?? 1,
          ),
        )
        .toList(growable: false);
    return _pageDto(items, query);
  }

  @override
  Future<LearningProgressSummaryDto> getProgressSummary() async {
    final vocabularies = await _vocabularies();
    return LearningProgressSummaryDto(
      reviewedVocabularies: 0,
      vocabulariesLearned: 0,
      dueVocabularies: vocabularies.length,
      grammarLessonsCompleted: 0,
      sessionsCompleted: 0,
    );
  }

  @override
  Future<LearningMutationReceiptDto> reviewFlashcard({
    required String vocabularyId,
    required ReviewFlashcardRequestDto request,
  }) async {
    if (request.quality < 0 || request.quality > 5) {
      throw ArgumentError.value(request.quality, 'quality');
    }
    await getVocabulary(vocabularyId);
    return LearningMutationReceiptDto(
      operationId: request.operationId,
      entityId: vocabularyId,
      revision: _nextRevision(request.baseEntityRevision),
    );
  }

  @override
  Future<LearningMutationReceiptDto> completeGrammarLesson({
    required String lessonId,
    required CompleteGrammarLessonRequestDto request,
  }) async {
    await getGrammarLesson(lessonId);
    return LearningMutationReceiptDto(
      operationId: request.operationId,
      entityId: lessonId,
      revision: _nextRevision(request.baseEntityRevision),
    );
  }

  String _requiredString(Map<String, dynamic> map, String key) {
    final value = map[key];
    if (value is! String || value.trim().isEmpty) {
      throw FormatException('Learning fixture field "$key" is missing.');
    }
    return value.trim();
  }

  String _nextRevision(String current) {
    final parsed = BigInt.tryParse(current);
    if (parsed == null || parsed.isNegative) {
      throw ArgumentError.value(current, 'baseEntityRevision');
    }
    return (parsed + BigInt.one).toString();
  }

  int _requiredInt(Map<String, dynamic> map, String key) {
    final value = map[key];
    if (value is! num || value < 0) {
      throw FormatException('Learning fixture field "$key" is invalid.');
    }
    return value.toInt();
  }
}
