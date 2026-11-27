import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/core/errors/app_exception.dart';
import 'package:toeic_mobile/core/storage/grammar_progress_storage.dart';
import 'package:toeic_mobile/core/storage/vocabulary_progress_storage.dart';
import 'package:toeic_mobile/features/learning/data_sources/local/learning_local_data_source.dart';
import 'package:toeic_mobile/features/learning/repositories/learning_local_state_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test(
    'persists vocabulary progress and reminder preferences per user',
    () async {
      final repository = _repository('user-a');

      final settings = await repository.saveReviewSettings(
        dailyGoal: 30,
        remindEnabled: false,
      );
      expect(settings.dailyGoal, 30);
      expect(settings.remindEnabled, isFalse);

      await repository.recordStudiedVocabulary(
        wordId: 'vocabulary-a',
        word: 'negotiate',
        phonetic: '/nɪˈɡoʊʃieɪt/',
        definition: 'thương lượng',
        example: 'They negotiate the contract.',
        audioUrl: '',
        topicId: 'topic-a',
        topicName: 'Office',
        grade: 4,
        serverRevision: '7',
      );

      final saved = await repository.getVocabularyProgress();
      expect(saved.words, contains('vocabulary-a'));
      expect(saved.words['vocabulary-a']!.serverRevision, '7');
      expect(saved.todayWords, hasLength(1));

      final userB = _repository('user-b');
      final empty = await userB.getVocabularyProgress();
      expect(empty.words, isEmpty);
      expect(empty.dailyGoal, 20);
      expect(empty.remindEnabled, isTrue);

      final reloadedUserA = await repository.getVocabularyProgress();
      expect(reloadedUserA.words, contains('vocabulary-a'));
      expect(reloadedUserA.dailyGoal, 30);
      expect(reloadedUserA.remindEnabled, isFalse);
    },
  );

  test(
    'persists started and completed grammar state independently per user',
    () async {
      final repository = _repository('user-a');

      await repository.markGrammarLessonStarted('user-a', 'grammar-1');
      var progress = await repository.getGrammarProgress('user-a');
      expect(progress.startedLessonIds, contains('grammar-1'));
      expect(progress.completedLessonIds, isEmpty);

      await repository.markGrammarLessonCompleted(
        'user-a',
        'grammar-1',
        revision: '3',
      );
      progress = await repository.getGrammarProgress('user-a');
      expect(progress.startedLessonIds, isNot(contains('grammar-1')));
      expect(progress.completedLessonIds, contains('grammar-1'));
      expect(progress.revisionFor('grammar-1'), '3');

      final userB = _repository('user-b');
      await expectLater(
        repository.getGrammarProgress('user-b'),
        throwsA(isA<AppException>()),
      );
      expect(
        (await userB.getGrammarProgress('user-b')).completedLessonIds,
        isEmpty,
      );
    },
  );

  test('rejects access to another account grammar state', () async {
    final repository = _repository('user-a');
    await expectLater(
      repository.markGrammarLessonStarted('user-b', 'grammar-1'),
      throwsA(isA<AppException>()),
    );
  });
}

LearningLocalStateRepository _repository(String storageUser) {
  final localDataSource = SharedPreferencesLearningLocalDataSource(
    vocabularyStorage: VocabularyProgressStorage()..bindUser(storageUser),
    grammarStorage: GrammarProgressStorage(),
  );
  return ScopedLearningLocalStateRepository(
    localDataSource: localDataSource,
    currentUserId: () => storageUser,
  );
}
