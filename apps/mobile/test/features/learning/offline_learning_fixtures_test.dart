import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/testing/offline_fixture_loader.dart';
import 'package:toeic_mobile/features/learning/providers/grammar_lesson_provider.dart';
import 'package:toeic_mobile/features/learning/providers/grammar_list_provider.dart';
import 'package:toeic_mobile/features/learning/providers/vocabulary_provider.dart';
import 'package:toeic_mobile/features/learning/providers/vocabulary_topic_provider.dart';
import 'package:toeic_mobile/features/learning/repositories/offline_learning_fixtures.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Offline learning fixtures', () {
    test('loads the approved vocabulary and grammar assets', () async {
      final fixtures = await OfflineLearningFixtures.load();

      expect(fixtures.vocabularyCatalog, hasLength(6));
      expect(fixtures.vocabularyCatalog.first.id, 't1-v1');
      expect(fixtures.vocabularyCatalog.first.word, 'negotiate');
      expect(fixtures.vocabularyTopics, hasLength(2));
      expect(fixtures.vocabularyTopics.first.vocabularyCount, 20);
      expect(fixtures.grammarLessons, hasLength(8));
      expect(fixtures.grammarLessons.first.id, 'g1');
      expect(fixtures.grammarLessons.first.sections, isNotEmpty);
    });

    test(
      'injects JSON catalogs into the existing learning providers',
      () async {
        final fixtures = await OfflineLearningFixtures.load();
        final vocabularyProvider = VocabularyProvider(
          catalog: fixtures.vocabularyCatalog,
        );
        final vocabularyTopicsProvider = VocabularyTopicsProvider(
          mockTopics: fixtures.vocabularyTopics,
        );
        final grammarListProvider = GrammarListProvider(
          mockLessons: fixtures.grammarLessons,
        );
        final grammarLessonProvider = GrammarLessonProvider(
          mockLessons: fixtures.grammarLessons,
        );

        await vocabularyProvider.loadTopic('t1');
        await vocabularyTopicsProvider.loadTopics();
        await grammarListProvider.loadLessons();
        await grammarLessonProvider.loadLesson('g1');

        expect(vocabularyProvider.queue, hasLength(1));
        expect(vocabularyProvider.queue.single.id, 't1-v1');
        expect(vocabularyTopicsProvider.topics, hasLength(2));
        expect(vocabularyTopicsProvider.topics.first.total, 20);
        expect(grammarListProvider.lessons, hasLength(8));
        expect(grammarLessonProvider.lesson?.id, 'g1');
      },
    );

    test('does not expose tester-only fixture files to the app loader', () {
      final paths = OfflineFixture.values.map((item) => item.assetPath);

      expect(paths, hasLength(2));
      expect(paths.join(' '), isNot(contains('answer_key')));
      expect(paths.join(' '), isNot(contains('qa_accounts')));
      expect(paths.join(' '), isNot(contains('answer_sets')));
    });

    test('fixture paths are rooted in the project test_data directory', () {
      for (final fixture in OfflineFixture.values) {
        expect(fixture.assetPath, startsWith('test_data/'));
      }
    });
  });
}
