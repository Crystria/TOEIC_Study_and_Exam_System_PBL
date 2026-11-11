import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/core/storage/vocabulary_progress_storage.dart';
import 'package:toeic_mobile/features/learning/models/learning_models.dart';
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
        storage: VocabularyProgressStorage(),
        repository: repository,
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
        storage: VocabularyProgressStorage(),
        repository: repository,
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
}

class _TopicDetailRepository implements LearningRepository {
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
    return const [];
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
