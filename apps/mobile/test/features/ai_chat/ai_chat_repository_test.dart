import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/features/ai_chat/ai_chat_dependencies.dart';
import 'package:toeic_mobile/features/ai_chat/data_sources/local/ai_chat_local_data_source.dart';
import 'package:toeic_mobile/features/ai_chat/data_sources/local/shared_preferences_ai_chat_local_data_source.dart';
import 'package:toeic_mobile/features/ai_chat/data_sources/test_data/ai_chat_test_data_source.dart';
import 'package:toeic_mobile/features/ai_chat/models/ai_chat_context.dart';
import 'package:toeic_mobile/features/ai_chat/models/ai_chat_data_snapshot.dart';
import 'package:toeic_mobile/features/ai_chat/models/ai_chat_failure.dart';
import 'package:toeic_mobile/features/ai_chat/models/ai_chat_usage.dart';
import 'package:toeic_mobile/features/ai_chat/models/ai_conversation.dart';
import 'package:toeic_mobile/features/ai_chat/models/chat_message.dart';
import 'package:toeic_mobile/features/ai_chat/repositories/ai_chat_repository.dart';
import 'package:toeic_mobile/features/ai_chat/repositories/test_data/test_data_ai_chat_repository.dart';
import 'package:toeic_mobile/features/ai_chat/repositories/unavailable_ai_chat_repository.dart';
import 'package:toeic_mobile/core/config/app_config.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('AI Backend remains disabled until its security gate is approved', () {
    expect(AiChatDependencies.backendIntegrationSafetyPassed, isFalse);
  });

  test('Development selects Test Data with a non-null Repository contract', () {
    final dependencies = AiChatDependencies.create(
      environment: AppEnvironment.development,
      currentUserId: () => 'user-a',
      releaseBuild: false,
    );

    expect(dependencies.isAvailable, isTrue);
    expect(dependencies.usesDevelopmentTestData, isTrue);
    expect(dependencies.repository, isA<AiChatRepository>());
    expect(dependencies.repository, isA<TestDataAiChatRepository>());
  });

  test(
    'Staging, Production and Release never select a Test Data Repository',
    () async {
      for (final environment in [
        AppEnvironment.staging,
        AppEnvironment.production,
      ]) {
        final dependencies = AiChatDependencies.create(
          environment: environment,
          currentUserId: () => 'user-a',
          releaseBuild: false,
        );
        expect(dependencies.isAvailable, isFalse);
        expect(dependencies.usesDevelopmentTestData, isFalse);
        expect(dependencies.repository, isA<UnavailableAiChatRepository>());
        await expectLater(
          dependencies.repository.getConversations(),
          throwsA(isA<AiChatFailure>()),
        );
      }

      final releaseDevelopment = AiChatDependencies.create(
        environment: AppEnvironment.development,
        currentUserId: () => 'user-a',
        releaseBuild: true,
      );
      expect(releaseDevelopment.usesDevelopmentTestData, isFalse);
      expect(releaseDevelopment.repository, isA<UnavailableAiChatRepository>());
    },
  );

  test(
    'repository creates, sends, renames and deletes through data sources',
    () async {
      final repository = _createRepository();
      final conversation = await repository.createConversation(
        title: '  Grammar help  ',
      );
      expect(conversation.title, 'Grammar help');

      final reply = await repository.sendMessage(
        conversation.id,
        const ChatMessage(
          role: ChatRole.user,
          text: 'Explain the difference between since and for.',
          status: ChatMessageStatus.sending,
        ),
      );
      expect(reply.role, ChatRole.assistant);
      expect(reply.text, contains('Since dùng với mốc thời gian'));
      expect(reply.text, contains('Phản hồi mô phỏng'));

      final messages = await repository.getMessages(conversation.id);
      expect(messages, hasLength(2));
      expect(messages.first.role, ChatRole.user);
      expect(messages.first.status, ChatMessageStatus.sent);

      final renamed = await repository.renameConversation(
        conversation.id,
        'TOEIC Grammar',
      );
      expect(renamed.title, 'TOEIC Grammar');
      await repository.deleteConversation(conversation.id);
      await expectLater(
        repository.getConversation(conversation.id),
        throwsA(isA<AiChatFailure>()),
      );
    },
  );

  test(
    'runtime history and usage survive repository recreation for same user',
    () async {
      final localDataSource = SharedPreferencesAiChatLocalDataSource();
      final firstInstance = _createRepository(
        localDataSource: localDataSource,
        currentUserId: () => 'user-persisted',
      );
      final created = await firstInstance.createConversation(
        title: 'Persist me',
      );
      await firstInstance.sendMessage(
        created.id,
        const ChatMessage(role: ChatRole.user, text: 'since and for'),
      );
      final usageBeforeRestart = await firstInstance.getUsage();

      final secondInstance = _createRepository(
        localDataSource: localDataSource,
        currentUserId: () => 'user-persisted',
      );
      final restored = await secondInstance.getConversation(created.id);
      final restoredMessages = await secondInstance.getMessages(created.id);
      final usageAfterRestart = await secondInstance.getUsage();

      expect(restored.title, 'Persist me');
      expect(restoredMessages, hasLength(2));
      expect(usageAfterRestart.used, usageBeforeRestart.used);
    },
  );

  test(
    'SharedPreferences local data source uses a separate key per user',
    () async {
      final dataSource = SharedPreferencesAiChatLocalDataSource();
      await dataSource.writeSnapshot('user-a', {'version': 1, 'owner': 'a'});
      await dataSource.writeSnapshot('user-b', {'version': 1, 'owner': 'b'});

      expect(await dataSource.readSnapshot('user-a'), {
        'version': 1,
        'owner': 'a',
      });
      expect(await dataSource.readSnapshot('user-b'), {
        'version': 1,
        'owner': 'b',
      });
    },
  );

  test('local snapshots are isolated between users', () async {
    String activeUserId = 'user-a';
    final repository = _createRepository(currentUserId: () => activeUserId);
    final userAConversation = await repository.createConversation(
      title: 'Private A',
    );

    repository.resetForUserScopeChange();
    activeUserId = 'user-b';
    final userBConversations = await repository.getConversations();
    expect(
      userBConversations.any((item) => item.id == userAConversation.id),
      isFalse,
    );
    final userBConversation = await repository.createConversation(
      title: 'Private B',
    );

    repository.resetForUserScopeChange();
    activeUserId = 'user-a';
    final userAHistory = await repository.getConversations();
    expect(userAHistory.map((item) => item.id), contains(userAConversation.id));
    expect(
      userAHistory.map((item) => item.id),
      isNot(contains(userBConversation.id)),
    );
  });

  test('account reset invalidates in-flight repository work', () async {
    final repository = _createRepository();
    final conversation = await repository.createConversation();
    final pendingSend = repository.sendMessage(
      conversation.id,
      const ChatMessage(role: ChatRole.user, text: 'A pending question.'),
    );

    repository.resetForUserScopeChange();

    await expectLater(pendingSend, throwsA(isA<StateError>()));
  });

  test('rejects empty conversation titles', () async {
    final repository = _createRepository();
    await expectLater(
      repository.createConversation(title: '  '),
      throwsA(isA<ArgumentError>()),
    );
  });

  test('persists typed contextual conversation data', () async {
    final localDataSource = _MemoryAiChatLocalDataSource();
    final repository = _createRepository(localDataSource: localDataSource);
    final context = _lessonContext();
    final created = await repository.createConversation(context: context);
    final restoredRepository = _createRepository(
      localDataSource: localDataSource,
    );
    final restored = await restoredRepository.getConversation(created.id);

    expect(restored.context, isA<AiGrammarLessonContext>());
  });
}

TestDataAiChatRepository _createRepository({
  AiChatLocalDataSource? localDataSource,
  String? Function()? currentUserId,
}) {
  return TestDataAiChatRepository(
    testDataSource: _MemoryAiChatTestDataSource(),
    localDataSource: localDataSource ?? _MemoryAiChatLocalDataSource(),
    currentUserId: currentUserId ?? () => 'user-a',
  );
}

class _MemoryAiChatTestDataSource implements AiChatTestDataSource {
  @override
  Future<AiChatDataSnapshot> loadInitialSnapshot() async => AiChatDataSnapshot(
    conversations: [
      AiConversation(
        id: 'seed-1',
        title: 'Seed conversation',
        lastMessagePreview: 'Seed preview',
        updatedAt: DateTime(2026, 1, 1),
      ),
    ],
    messagesByConversation: {
      'seed-1': [const ChatMessage(role: ChatRole.user, text: 'Seed message')],
    },
    usage: AiChatUsage.preview(limit: 20, used: 3),
  );
}

class _MemoryAiChatLocalDataSource implements AiChatLocalDataSource {
  final Map<String, Map<String, Object?>> _snapshots = {};

  @override
  Future<Map<String, Object?>?> readSnapshot(String userId) async {
    final value = _snapshots[userId];
    if (value == null) return null;
    return Map<String, Object?>.from(value);
  }

  @override
  Future<void> writeSnapshot(
    String userId,
    Map<String, Object?> snapshot,
  ) async {
    _snapshots[userId] = Map<String, Object?>.from(snapshot);
  }
}

AiGrammarLessonContext _lessonContext() => const AiGrammarLessonContext(
  lessonId: 'lesson-1',
  title: 'Prepositions',
  category: 'Grammar',
  summary: 'Summary',
  content: 'Content',
  keyTakeaway: 'Takeaway',
);
