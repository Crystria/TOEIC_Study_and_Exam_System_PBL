import 'repositories/ai_chat_repository.dart';

/// Shared in-app dependencies for the AI Chat feature.
///
/// The repository is app-session scoped and currently backed by mock data.
class AiChatDependencies {
  AiChatDependencies._();

  static final AiChatRepository repository = AiChatRepository();
}
