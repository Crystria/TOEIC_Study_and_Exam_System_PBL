import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/ai_chat/ai_chat_dependencies.dart';
import 'package:toeic_mobile/features/ai_chat/models/chat_message.dart';
import 'package:toeic_mobile/features/ai_chat/repositories/ai_chat_repository.dart';

void main() {
  test('AI Backend remains disabled until its security gate is approved', () {
    expect(AiChatDependencies.backendIntegrationSafetyPassed, isFalse);
  });

  test(
    'local repository creates a conversation and returns a mock reply',
    () async {
      final repository = AiChatRepository();
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
    },
  );

  test('account reset invalidates in-flight repository work', () async {
    final repository = AiChatRepository();
    final conversation = await repository.createConversation();
    final pendingSend = repository.sendMessage(
      conversation.id,
      const ChatMessage(role: ChatRole.user, text: 'A pending question.'),
    );

    repository.resetForUserScopeChange();

    await expectLater(pendingSend, throwsA(isA<StateError>()));
    await expectLater(
      repository.getConversation(conversation.id),
      throwsA(isA<StateError>()),
    );
  });

  test('rejects empty conversation titles', () async {
    final repository = AiChatRepository();

    await expectLater(
      repository.createConversation(title: '  '),
      throwsA(isA<ArgumentError>()),
    );
  });
}
