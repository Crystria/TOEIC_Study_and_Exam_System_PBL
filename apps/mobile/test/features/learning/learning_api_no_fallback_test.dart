import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/core/storage/grammar_progress_storage.dart';
import 'package:toeic_mobile/core/storage/vocabulary_progress_storage.dart';
import 'package:toeic_mobile/features/learning/data_sources/local/learning_local_data_source.dart';
import 'package:toeic_mobile/features/learning/repositories/learning_local_state_repository.dart';
import 'package:toeic_mobile/features/learning/providers/grammar_lesson_provider.dart';
import 'package:toeic_mobile/features/learning/providers/grammar_list_provider.dart';
import 'package:toeic_mobile/features/learning/providers/vocabulary_provider.dart';
import 'package:toeic_mobile/features/learning/providers/vocabulary_topic_provider.dart';
import 'package:toeic_mobile/features/learning/repositories/learning_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('Learning API mode does not fall back to Test Data', () {
    test(
      'Vocabulary exposes the remote failure instead of showing fixture words',
      () async {
        final provider = VocabularyProvider(
          repository: _UnavailableLearningRepository(),
          localStateRepository: _createLocalStateRepository('test-user-001'),
          currentUserId: () => 'test-user-001',
        );
        addTearDown(provider.dispose);

        await provider.loadTopic('t1');

        expect(provider.status, VocabularyStatus.error);
        expect(provider.queue, isEmpty);
        expect(provider.errorMessage, isNotNull);
      },
    );

    test('Vocabulary topics expose the remote failure instead of showing fixture topics', () async {
      final provider = VocabularyTopicsProvider(
        repository: _UnavailableLearningRepository(),
        localStateRepository: _createLocalStateRepository('test-user-001'),
      );
      addTearDown(provider.dispose);

      await provider.loadTopics();

      expect(provider.status, TopicsStatus.error);
      expect(provider.topics, isEmpty);
      expect(provider.errorMessage, isNotNull);
    });

    test('Grammar list exposes the remote failure instead of showing fixture lessons', () async {
      final provider = GrammarListProvider(
        repository: _UnavailableLearningRepository(),
        localStateRepository: _createLocalStateRepository('test-user-001'),
        currentUserId: () => 'test-user-001',
      );
      addTearDown(provider.dispose);

      await provider.loadLessons();

      expect(provider.status, GrammarListFetchStatus.error);
      expect(provider.lessons, isEmpty);
      expect(provider.errorMessage, isNotNull);
    });

    test('Grammar detail exposes the remote failure instead of showing a fixture lesson', () async {
      final provider = GrammarLessonProvider(
        repository: _UnavailableLearningRepository(),
        localStateRepository: _createLocalStateRepository('test-user-001'),
        currentUserId: () => 'test-user-001',
      );
      addTearDown(provider.dispose);

      await provider.loadLesson('g1');

      expect(provider.status, GrammarLessonFetchStatus.error);
      expect(provider.lesson, isNull);
      expect(provider.errorMessage, isNotNull);
    });
  });
}

/// Models an API-backed Repository whose remote content endpoints are down.
/// Local user progress remains readable so each test reaches a remote operation.
class _UnavailableLearningRepository implements LearningRepository {
  @override
  void resetForUserScopeChange() {}

  @override
  dynamic noSuchMethod(Invocation invocation) {
    throw StateError('Simulated Backend API unavailable.');
  }
}

LearningLocalStateRepository _createLocalStateRepository(String userId) {
  final localDataSource = SharedPreferencesLearningLocalDataSource(
    vocabularyStorage: VocabularyProgressStorage()..bindUser(userId),
    grammarStorage: GrammarProgressStorage(),
  );
  return ScopedLearningLocalStateRepository(
    localDataSource: localDataSource,
    currentUserId: () => userId,
  );
}
