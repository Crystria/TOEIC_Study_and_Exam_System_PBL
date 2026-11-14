import '../models/ai_chat_context.dart';
import '../models/ai_chat_usage.dart';
import '../models/ai_conversation.dart';
import '../models/chat_message.dart';

/// Single data contract used by both AI Chat providers.
///
/// The contract intentionally contains no API/Test Data selection details.
abstract interface class AiChatRepository {
  Future<AiChatUsage> getUsage();
  Future<List<AiConversation>> getConversations();
  Future<AiConversation> getConversation(String conversationId);
  Future<List<ChatMessage>> getMessages(String conversationId);
  Future<AiConversation> createConversation({
    String? title,
    AiChatContext? context,
  });
  Future<ChatMessage> sendMessage(
    String conversationId,
    ChatMessage userMessage,
  );
  Future<AiConversation> renameConversation(
    String conversationId,
    String newTitle,
  );
  Future<void> deleteConversation(String conversationId);

  /// Drops in-memory state when the authenticated user changes. Persisted
  /// user-specific history is retained and loaded again for that user.
  void resetForUserScopeChange();
}
