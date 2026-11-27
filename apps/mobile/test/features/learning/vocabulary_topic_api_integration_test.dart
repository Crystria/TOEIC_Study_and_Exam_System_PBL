import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/core/storage/grammar_progress_storage.dart';
import 'package:toeic_mobile/core/storage/vocabulary_progress_storage.dart';
import 'package:toeic_mobile/features/learning/data_sources/local/learning_local_data_source.dart';
import 'package:toeic_mobile/features/learning/models/learning_models.dart';
import 'package:toeic_mobile/features/learning/repositories/learning_local_state_repository.dart';
import 'package:toeic_mobile/features/learning/providers/vocabulary_provider.dart';
import 'package:toeic_mobile/features/learning/repositories/learning_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test(
    'loads canonical topic detail before the API vocabulary queue',
    () async {
      final repository = _TopicDetailRepository();
      final provider = VocabularyProvider(
        repository: repository,
        localStateRepository: _createLocalStateRepository(),
        currentUserId: () => 'qa-user',
      );
      addTearDown(provider.dispose);

      await provider.loadTopic('topic-uuid');

      expect(repository.calls, <String>[
        'topic:topic-uuid',
        'vocabularies:topic-uuid',
        'due:topic-uuid',
      ]);
      expect(provider.currentTopicId, 'topic-uuid');
      expect(provider.currentTopicName, 'Backend Topic Name');
      expect(provider.status, VocabularyStatus.empty);

      provider.resetForUserScopeChange();
      expect(provider.currentTopicName, isNull);
    },
  );

  test(
    'clears the API topic label when switching to random learning',
    () async {
      final repository = _TopicDetailRepository();
      final provider = VocabularyProvider(
        repository: repository,
        localStateRepository: _createLocalStateRepository(),
        currentUserId: () => 'qa-user',
      );
      addTearDown(provider.dispose);

      await provider.loadTopic('topic-uuid');
      expect(provider.currentTopicName, 'Backend Topic Name');

      await provider.loadRandom();

      expect(provider.currentTopicName, isNull);
      expect(provider.currentTopicId, isNull);
    },
  );
  test('loads new vocabulary in topic even when mastery grade is 1', () async {
    final repository = _TopicDetailRepository(
      vocabularies: const [
        LearningVocabulary(
          id: 'word-new-1',
          topicId: 'topic-uuid',
          topicName: 'Backend Topic Name',
          word: 'allocate',
          phonetic: '/ˈæləkeɪt/',
          definition: 'phân bổ',
          example: 'The manager will allocate resources.',
          audioUrl: '',
          imageUrl: '',
        ),
      ],
    );

    final provider = VocabularyProvider(
      repository: repository,
      localStateRepository: _createLocalStateRepository(),
      currentUserId: () => 'qa-user',
    );
    addTearDown(provider.dispose);

    await provider.loadTopic('topic-uuid');

    expect(provider.status, VocabularyStatus.loaded);
    expect(provider.queue, hasLength(1));
    expect(provider.current?.id, 'word-new-1');
    expect(provider.current?.masteryGrade, 1);
  });
}

class _TopicDetailRepository implements LearningRepository {
  _TopicDetailRepository({this.vocabularies = const []});

  final List<LearningVocabulary> vocabularies;
  final List<String> calls = [];

  @override
  Future<LearningTopic> getTopic(String topicId) async {
    calls.add('topic:$topicId');
    return LearningTopic(
      id: topicId,
      name: 'Backend Topic Name',
      vocabularyCount: 10,
    );
  }

  @override
  Future<List<LearningVocabulary>> getVocabularies({String? topicId}) async {
    calls.add('vocabularies:$topicId');

    return vocabularies
        .where((item) => topicId == null || item.topicId == topicId)
        .toList(growable: false);
  }

  @override
  Future<List<LearningReviewProgress>> getDueProgress({String? topicId}) async {
    calls.add('due:$topicId');
    return const [];
  }

  @override
  void resetForUserScopeChange() {}

  @override
  noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

LearningLocalStateRepository _createLocalStateRepository() {
  const userId = 'qa-user';
  final localDataSource = SharedPreferencesLearningLocalDataSource(
    vocabularyStorage: VocabularyProgressStorage()..bindUser(userId),
    grammarStorage: GrammarProgressStorage(),
  );
  return ScopedLearningLocalStateRepository(
    localDataSource: localDataSource,
    currentUserId: () => userId,
  );
}
