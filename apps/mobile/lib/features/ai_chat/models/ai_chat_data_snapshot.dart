import 'ai_chat_usage.dart';
import 'ai_conversation.dart';
import 'chat_message.dart';

/// In-memory state shared by the AI Chat Test Data repository and its mapper.
class AiChatDataSnapshot {
  AiChatDataSnapshot({
    required List<AiConversation> conversations,
    required Map<String, List<ChatMessage>> messagesByConversation,
    required this.usage,
  }) : conversations = List<AiConversation>.of(conversations),
       messagesByConversation = {
         for (final entry in messagesByConversation.entries)
           entry.key: List<ChatMessage>.of(entry.value),
       };

  final List<AiConversation> conversations;
  final Map<String, List<ChatMessage>> messagesByConversation;
  AiChatUsage usage;
}
