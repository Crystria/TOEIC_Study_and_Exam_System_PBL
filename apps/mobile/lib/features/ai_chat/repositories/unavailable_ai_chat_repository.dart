import '../models/ai_chat_context.dart';
import '../models/ai_chat_failure.dart';
import '../models/ai_chat_usage.dart';
import '../models/ai_conversation.dart';
import '../models/chat_message.dart';
import 'ai_chat_repository.dart';

/// Fail-closed implementation used when AI Backend integration is not approved.
/// It never reads fixtures or creates a Test Data repository.
class UnavailableAiChatRepository implements AiChatRepository {
  const UnavailableAiChatRepository();

  AiChatFailure get _unavailable => const AiChatFailure(
    kind: AiChatFailureKind.serviceUnavailable,
    message: 'AI Chat is disabled until the Backend security review passes.',
  );

  @override
  Future<AiChatUsage> getUsage() async => throw _unavailable;

  @override
  Future<List<AiConversation>> getConversations() async => throw _unavailable;

  @override
  Future<AiConversation> getConversation(String conversationId) async =>
      throw _unavailable;

  @override
  Future<List<ChatMessage>> getMessages(String conversationId) async =>
      throw _unavailable;

  @override
  Future<AiConversation> createConversation({
    String? title,
    AiChatContext? context,
  }) async => throw _unavailable;

  @override
  Future<ChatMessage> sendMessage(
    String conversationId,
    ChatMessage userMessage,
  ) async => throw _unavailable;

  @override
  Future<AiConversation> renameConversation(
    String conversationId,
    String newTitle,
  ) async => throw _unavailable;

  @override
  Future<void> deleteConversation(String conversationId) async =>
      throw _unavailable;

  @override
  void resetForUserScopeChange() {}
}
