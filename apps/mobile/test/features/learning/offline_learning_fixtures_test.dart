import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/core/storage/grammar_progress_storage.dart';
import 'package:toeic_mobile/core/storage/vocabulary_progress_storage.dart';
import 'package:toeic_mobile/features/learning/data_sources/local/learning_local_data_source.dart';
import 'package:toeic_mobile/features/learning/data_sources/test_data/learning_test_data_source.dart';
import 'package:toeic_mobile/features/learning/providers/grammar_lesson_provider.dart';
import 'package:toeic_mobile/features/learning/providers/grammar_list_provider.dart';
import 'package:toeic_mobile/features/learning/providers/vocabulary_provider.dart';
import 'package:toeic_mobile/features/learning/providers/vocabulary_topic_provider.dart';
import 'package:toeic_mobile/features/learning/repositories/learning_local_state_repository.dart';
import 'package:toeic_mobile/features/learning/repositories/test_data_learning_repository.dart';

import '../../support/fixtures/offline_fixture_loader.dart';
import '../../support/fixtures/offline_learning_fixtures.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('Offline learning fixtures', () {
    test('loads the approved vocabulary and grammar test fixtures', () async {
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
      'loads fixture-backed content through the Repository into Providers',
      () async {
        const userId = 'offline-test-user';
        final localDataSource = _createLocalDataSource(userId);
        final localStateRepository = ScopedLearningLocalStateRepository(
          localDataSource: localDataSource,
          currentUserId: () => userId,
        );
        final repository = TestDataLearningRepository(
          testDataSource: LearningTestDataSource(),
          currentUserId: () => userId,
        );
        final vocabularyProvider = VocabularyProvider(
          repository: repository,
          localStateRepository: localStateRepository,
          currentUserId: () => userId,
        );
        final vocabularyTopicsProvider = VocabularyTopicsProvider(
          repository: repository,
          localStateRepository: localStateRepository,
        );
        final grammarListProvider = GrammarListProvider(
          repository: repository,
          localStateRepository: localStateRepository,
          currentUserId: () => userId,
        );
        final grammarLessonProvider = GrammarLessonProvider(
          repository: repository,
          localStateRepository: localStateRepository,
          currentUserId: () => userId,
        );
        addTearDown(vocabularyProvider.dispose);
        addTearDown(vocabularyTopicsProvider.dispose);
        addTearDown(grammarListProvider.dispose);
        addTearDown(grammarLessonProvider.dispose);

        await vocabularyProvider.loadTopic('t1');
        await vocabularyTopicsProvider.loadTopics();
        await grammarListProvider.loadLessons();
        await grammarLessonProvider.loadLesson('g1');

        expect(vocabularyProvider.status, VocabularyStatus.loaded);

        expect(vocabularyProvider.queue, hasLength(3));

        expect(vocabularyProvider.queue.map((item) => item.id).toList(), [
          't1-v1',
          't1-v2',
          't1-v3',
        ]);

        expect(
          vocabularyProvider.queue.map((item) => item.masteryGrade).toList(),
          [5, 3, 1],
        );
        expect(vocabularyTopicsProvider.status, TopicsStatus.loaded);
        expect(vocabularyTopicsProvider.topics, hasLength(2));
        expect(vocabularyTopicsProvider.topics.first.total, 20);
        expect(grammarListProvider.lessons, hasLength(8));
        expect(grammarLessonProvider.lesson?.id, 'g1');
      },
    );

    test(
      'does not expose tester-only files through the fixture allow-list',
      () {
        final paths = OfflineFixture.values.map((item) => item.relativePath);

        expect(paths, hasLength(2));
        expect(paths.join(' '), isNot(contains('answer_key')));
        expect(paths.join(' '), isNot(contains('qa_accounts')));
        expect(paths.join(' '), isNot(contains('answer_sets')));
      },
    );

    test('fixture paths are rooted in the project test_data directory', () {
      for (final fixture in OfflineFixture.values) {
        expect(fixture.relativePath, startsWith('test_data/'));
      }
    });
  });
}

LearningLocalDataSource _createLocalDataSource(String userId) {
  return SharedPreferencesLearningLocalDataSource(
    vocabularyStorage: VocabularyProgressStorage()..bindUser(userId),
    grammarStorage: GrammarProgressStorage(),
  );
}
