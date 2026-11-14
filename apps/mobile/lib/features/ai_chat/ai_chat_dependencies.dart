import 'package:flutter/foundation.dart' show kReleaseMode;

import '../../core/config/app_config.dart';
import 'data_sources/local/shared_preferences_ai_chat_local_data_source.dart';
import 'data_sources/test_data/asset_ai_chat_test_data_source.dart';
import 'repositories/ai_chat_repository.dart';
import 'repositories/test_data/test_data_ai_chat_repository.dart';
import 'repositories/unavailable_ai_chat_repository.dart';

/// AI Chat dependencies are created by the application composition root.
///
/// Backend integration has an independent security gate. Enabling API_ENABLED
/// for another feature never enables AI Chat or selects a mock fallback.
class AiChatDependencies {
  AiChatDependencies._({
    required this.repository,
    required this.isAvailable,
    required this.usesDevelopmentTestData,
  });

  /// Must remain false until Auth identity, conversation ownership, and access
  /// control have passed an explicit Backend security review.
  static const bool backendIntegrationSafetyPassed = false;

  final AiChatRepository repository;
  final bool isAvailable;
  final bool usesDevelopmentTestData;

  factory AiChatDependencies.create({
    required AppEnvironment environment,
    required String? Function() currentUserId,
    bool releaseBuild = kReleaseMode,
  }) {
    if (backendIntegrationSafetyPassed) {
      throw StateError(
        'AI Chat Backend integration is marked approved, but no reviewed API '
        'repository is implemented. Keep the safety gate disabled until the '
        'approved implementation is wired here.',
      );
    }

    if (environment == AppEnvironment.development && !releaseBuild) {
      return AiChatDependencies._(
        repository: TestDataAiChatRepository(
          testDataSource: AssetAiChatTestDataSource(),
          localDataSource: SharedPreferencesAiChatLocalDataSource(),
          currentUserId: currentUserId,
        ),
        isAvailable: true,
        usesDevelopmentTestData: true,
      );
    }

    // Staging, Production, and every Release build fail closed. There is no
    // Test Data fallback while the Backend security gate remains false.
    return AiChatDependencies._(
      repository: const UnavailableAiChatRepository(),
      isAvailable: false,
      usesDevelopmentTestData: false,
    );
  }
}
