import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/core/session/user_scoped_data_coordinator.dart';
import 'package:toeic_mobile/core/storage/vocabulary_progress_storage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late VocabularyProgressStorage storage;
  late UserScopedDataCoordinator coordinator;

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    storage = VocabularyProgressStorage();
    coordinator = UserScopedDataCoordinator(
      vocabularyStorage: storage,
      resetCallbacks: const [],
      loadCallbacks: const [],
    );
  });

  test('keeps vocabulary progress isolated between two accounts', () async {
    await coordinator.activateUser('learner-a');
    await storage.recordStudiedWord(
      wordId: 'word-a',
      word: 'negotiate',
      phonetic: '/nɪˈɡoʊʃieɪt/',
      definition: 'thương lượng',
      example: 'They negotiate the contract.',
      audioUrl: '',
      topicId: 'office',
      topicName: 'Office',
      grade: 4,
    );

    await coordinator.clearCurrentUser();
    expect(coordinator.activeUserId, isNull);
    expect(storage.activeUserId, isNull);

    await coordinator.activateUser('learner-b');
    expect((await storage.loadSnapshot()).words, isEmpty);

    await coordinator.clearCurrentUser();
    await coordinator.activateUser('learner-a');
    final restored = await storage.loadSnapshot();

    expect(restored.words.keys, contains('word-a'));
    expect(restored.words['word-a']?.word, 'negotiate');
  });

  test('rejects an empty account id without binding storage', () async {
    await expectLater(
      coordinator.activateUser('  '),
      throwsA(isA<ArgumentError>()),
    );

    expect(coordinator.activeUserId, isNull);
    expect(storage.activeUserId, isNull);
  });
}
