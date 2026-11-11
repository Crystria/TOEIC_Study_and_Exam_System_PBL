import 'repositories/ai_chat_repository.dart';

/// Shared in-app dependencies for the AI Chat feature.
///
/// AI Chat deliberately stays local/mock until the Backend identity and
/// conversation-ownership checks pass the security review. This decision is
/// kept independent from the Auth, Learning, Mock Test, and Analytics API flags.
class AiChatDependencies {
  AiChatDependencies._();

  /// The current AI Backend does not meet the requirements for safe mobile
  /// integration. Do not change this to true merely because any other API feature is
  /// true; the blockers must first be fixed and verified in the Backend.
  static const bool backendIntegrationSafetyPassed = false;

  static final AiChatRepository repository = _createRepository();

  static AiChatRepository _createRepository() {
    // Fail closed if someone marks the security gate as passed without also
    // implementing and explicitly wiring an approved API repository.
    if (backendIntegrationSafetyPassed) {
      throw StateError(
        'AI Chat safety gate passed, but no approved Backend repository is '
        'configured. Implement and review the API repository before enabling '
        'Backend integration.',
      );
    }

    return AiChatRepository();
  }
}
