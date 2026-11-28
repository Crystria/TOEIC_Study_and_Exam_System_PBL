import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  Future<String> readProjectFile(String path) async {
    final direct = File(path);
    if (await direct.exists()) return direct.readAsString();
    final mobileRoot = File('apps/mobile/$path');
    if (await mobileRoot.exists()) return mobileRoot.readAsString();
    throw FileSystemException('Project file was not found.', path);
  }

  test(
    'AI Chat providers depend only on the shared Repository contract',
    () async {
      final provider = await readProjectFile(
        'lib/features/ai_chat/providers/ai_chat_provider.dart',
      );
      final historyProvider = await readProjectFile(
        'lib/features/ai_chat/providers/ai_chat_history_provider.dart',
      );
      final screens = [
        await readProjectFile(
          'lib/features/ai_chat/screens/ai_chat_screen.dart',
        ),
        await readProjectFile(
          'lib/features/ai_chat/screens/ai_chat_history_screen.dart',
        ),
      ];

      expect(provider, contains('required AiChatRepository repository'));
      expect(historyProvider, contains('required AiChatRepository repository'));
      for (final source in [provider, historyProvider, ...screens]) {
        expect(source, isNot(contains('AiChatTestDataSource')));
        expect(source, isNot(contains('SharedPreferences')));
        expect(source, isNot(contains('API_ENABLED')));
        expect(source, isNot(contains('mock_data/')));
      }
    },
  );

  test(
    'Repository contract does not know fixture or storage implementations',
    () async {
      final repository = await readProjectFile(
        'lib/features/ai_chat/repositories/ai_chat_repository.dart',
      );
      expect(repository, contains('abstract interface class AiChatRepository'));
      expect(repository, isNot(contains('TestDataAiChatRepository')));
      expect(
        repository,
        isNot(contains('SharedPreferencesAiChatLocalDataSource')),
      );
      expect(repository, isNot(contains('AiChatMockData')));
    },
  );

  test('AI Chat backend gate remains independent and fail-closed', () async {
    final dependencies = await readProjectFile(
      'lib/features/ai_chat/ai_chat_dependencies.dart',
    );
    expect(dependencies, contains('backendIntegrationSafetyPassed = false'));
    expect(dependencies, contains('AppEnvironment.development'));
    expect(dependencies, contains('UnavailableAiChatRepository'));
    expect(
      dependencies,
      isNot(contains("String.fromEnvironment('API_ENABLED'")),
    );
  });
}
