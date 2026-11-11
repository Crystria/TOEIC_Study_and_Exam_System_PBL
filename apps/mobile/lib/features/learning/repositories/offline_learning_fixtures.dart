import '../../../core/testing/offline_fixture_loader.dart';
import '../models/grammar_lesson.dart';
import '../models/learning_models.dart';
import '../providers/vocabulary_provider.dart';

/// Parsed, source-aligned content for development/offline mode.
///
/// Progress, sessions, account credentials, answer keys and attempt state are
/// intentionally not loaded here. They remain in their existing storage or
/// repository implementations.
class OfflineLearningFixtures {
  const OfflineLearningFixtures({
    required this.vocabularyCatalog,
    required this.vocabularyTopics,
    required this.grammarLessons,
  });

  final List<FlashcardItem> vocabularyCatalog;
  final List<LearningTopic> vocabularyTopics;
  final List<GrammarLesson> grammarLessons;

  static Future<OfflineLearningFixtures> load({
    OfflineFixtureLoader? loader,
  }) async {
    final fixtureLoader = loader ?? OfflineFixtureLoader();
    final vocabularyJson = await fixtureLoader.loadObject(
      OfflineFixture.vocabularyCatalog,
    );
    final grammarJson = await fixtureLoader.loadObject(
      OfflineFixture.grammarCatalog,
    );

    return OfflineLearningFixtures(
      vocabularyCatalog: _parseVocabulary(vocabularyJson),
      vocabularyTopics: _parseVocabularyTopics(vocabularyJson),
      grammarLessons: _parseGrammar(grammarJson),
    );
  }

  static List<FlashcardItem> _parseVocabulary(Map<String, dynamic> json) {
    final items = _list(json, 'items');
    final declaredCount = _integer(json, 'catalogCount');
    if (items.length != declaredCount) {
      throw FormatException(
        'Vocabulary catalogCount=$declaredCount but found ${items.length} items.',
      );
    }

    final parsed = items
        .map((value) {
          final item = _object(value, 'vocabulary item');
          return FlashcardItem(
            id: _string(item, 'id'),
            word: _string(item, 'word'),
            phonetic: _string(item, 'phonetic', allowEmpty: true),
            definition: _string(item, 'definition'),
            example: _string(item, 'example', allowEmpty: true),
            audioUrl: _string(item, 'audioUrl', allowEmpty: true),
            masteryGrade: _integer(item, 'masteryGrade'),
            topicId: _string(item, 'topicId'),
            topicName: _string(item, 'topicName'),
          );
        })
        .toList(growable: false);

    _ensureUniqueIds(parsed.map((item) => item.id), 'vocabulary');
    return List<FlashcardItem>.unmodifiable(parsed);
  }

  static List<LearningTopic> _parseVocabularyTopics(Map<String, dynamic> json) {
    final topicValues = _list(
      json,
      'topicCountsDeclaredByVocabularyTopicsProvider',
    );
    final parsed = topicValues
        .map((value) {
          final topic = _object(value, 'vocabulary topic');
          return LearningTopic(
            id: _string(topic, 'id'),
            name: _string(topic, 'name'),
            vocabularyCount: _integer(topic, 'total'),
          );
        })
        .toList(growable: false);
    _ensureUniqueIds(parsed.map((topic) => topic.id), 'vocabulary topic');
    return List<LearningTopic>.unmodifiable(parsed);
  }

  static List<GrammarLesson> _parseGrammar(Map<String, dynamic> json) {
    final items = _list(json, 'items');
    final declaredCount = _integer(json, 'catalogCount');
    if (items.length != declaredCount) {
      throw FormatException(
        'Grammar catalogCount=$declaredCount but found ${items.length} items.',
      );
    }

    final parsed = items
        .map((value) {
          final item = _object(value, 'grammar lesson');
          final sections = _list(item, 'sections')
              .map((sectionValue) {
                final section = _object(sectionValue, 'grammar section');
                final examplesValue = section['examples'];
                if (examplesValue != null && examplesValue is! List) {
                  throw const FormatException(
                    'Grammar section examples must be a list.',
                  );
                }
                return GrammarLessonSection(
                  title: _string(section, 'title'),
                  explanation: _string(section, 'explanation'),
                  examples:
                      (examplesValue as List<dynamic>? ?? const <dynamic>[])
                          .map(
                            (example) =>
                                _valueString(example, 'grammar example'),
                          )
                          .toList(growable: false),
                );
              })
              .toList(growable: false);

          return GrammarLesson(
            id: _string(item, 'id'),
            title: _string(item, 'title'),
            category: _string(item, 'category'),
            summary: _string(item, 'summary'),
            level: _optionalString(item, 'level'),
            durationMinutes: _optionalInteger(item, 'durationMinutes'),
            sections: List<GrammarLessonSection>.unmodifiable(sections),
            keyTakeaway: _optionalString(item, 'keyTakeaway'),
          );
        })
        .toList(growable: false);

    _ensureUniqueIds(parsed.map((item) => item.id), 'grammar');
    return List<GrammarLesson>.unmodifiable(parsed);
  }

  static Map<String, dynamic> _object(Object? value, String label) {
    if (value is Map<String, dynamic>) return value;
    throw FormatException('Expected JSON object for $label.');
  }

  static List<dynamic> _list(Map<String, dynamic> map, String key) {
    final value = map[key];
    if (value is List<dynamic>) return value;
    throw FormatException('Expected list at "$key".');
  }

  static String _string(
    Map<String, dynamic> map,
    String key, {
    bool allowEmpty = false,
  }) {
    final value = map[key];
    if (value is! String || (!allowEmpty && value.trim().isEmpty)) {
      final expectation = allowEmpty ? 'string' : 'non-empty string';
      throw FormatException('Expected $expectation at "$key".');
    }
    return value;
  }

  static String? _optionalString(Map<String, dynamic> map, String key) {
    final value = map[key];
    if (value == null) return null;
    if (value is String) return value;
    throw FormatException('Expected string or null at "$key".');
  }

  static int _integer(Map<String, dynamic> map, String key) {
    final value = map[key];
    if (value is int) return value;
    throw FormatException('Expected integer at "$key".');
  }

  static int? _optionalInteger(Map<String, dynamic> map, String key) {
    final value = map[key];
    if (value == null) return null;
    if (value is int) return value;
    throw FormatException('Expected integer or null at "$key".');
  }

  static String _valueString(Object? value, String label) {
    if (value is String) return value;
    throw FormatException('Expected string for $label.');
  }

  static void _ensureUniqueIds(Iterable<String> ids, String label) {
    final values = ids.toList(growable: false);
    if (values.toSet().length != values.length) {
      throw FormatException('Duplicate IDs in $label fixture.');
    }
  }
}
