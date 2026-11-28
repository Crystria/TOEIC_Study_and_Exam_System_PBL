import 'package:flutter_test/flutter_test.dart';

import 'package:toeic_mobile/core/config/app_config.dart';
import 'package:toeic_mobile/core/di/app_dependencies.dart';
import 'package:toeic_mobile/core/di/app_feature_dependencies.dart';
import 'package:toeic_mobile/core/di/production_feature_dependencies.dart';
import 'package:toeic_mobile/core/storage/token_storage.dart';
import 'package:toeic_mobile/core/storage/grammar_progress_storage.dart';
import 'package:toeic_mobile/core/storage/vocabulary_progress_storage.dart';

import 'package:toeic_mobile/features/auth/repositories/api_auth_repository.dart';
import 'package:toeic_mobile/features/learning/data_sources/local/learning_local_data_source.dart';
import 'package:toeic_mobile/features/learning/repositories/learning_repository.dart';
import 'package:toeic_mobile/features/learning/repositories/api_learning_session_repository.dart';
import 'package:toeic_mobile/features/analytics/repositories/analytics_repository.dart';
import 'package:toeic_mobile/features/mock_test/repositories/api_mock_test_repository.dart';
import 'package:toeic_mobile/features/mock_test/repositories/api_mock_test_attempt_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Development API graph uses Backend repositories for all modules', () {
    final app = AppDependencies.fromEnvironment(
      config: AppConfig(
        environment: AppEnvironment.development,
        baseUrl: 'https://api.example.test/api/v1',
        apiEnabled: true,
      ),
      tokenStorage: TokenStorage(secureStore: _MemorySecureKeyValueStore()),
    );

    addTearDown(() => app.apiClient.close(force: true));

    final graph = AppFeatureDependencies.create(
      app: app,
      currentUserId: () => 'qa-user',
      learningLocalDataSource: _createLearningLocalDataSource(),
    );

    expect(graph.authRepository, isA<ApiAuthRepository>());
    expect(graph.learningRepository, isA<ApiLearningRepository>());
    expect(
      graph.learningSessionRepository,
      isA<ApiLearningSessionRepository>(),
    );
    expect(graph.analyticsRepository, isA<ApiAnalyticsRepository>());
    expect(graph.mockTestRepository, isA<ApiMockTestRepository>());
    expect(
      graph.mockTestAttemptRepository,
      isA<ApiMockTestAttemptRepository>(),
    );
  });

  test('Production API graph uses Backend repositories for all modules', () {
    final app = AppDependencies.fromEnvironment(
      config: AppConfig(
        environment: AppEnvironment.production,
        baseUrl: 'https://api.example.test/api/v1',
        apiEnabled: true,
      ),
      tokenStorage: TokenStorage(secureStore: _MemorySecureKeyValueStore()),
    );

    addTearDown(() => app.apiClient.close(force: true));

    final graph = ProductionFeatureDependencies.create(
      app: app,
      currentUserId: () => 'qa-user',
      learningLocalDataSource: _createLearningLocalDataSource(),
    );

    expect(graph.authRepository, isA<ApiAuthRepository>());
    expect(graph.learningRepository, isA<ApiLearningRepository>());
    expect(
      graph.learningSessionRepository,
      isA<ApiLearningSessionRepository>(),
    );
    expect(graph.analyticsRepository, isA<ApiAnalyticsRepository>());
    expect(graph.mockTestRepository, isA<ApiMockTestRepository>());
    expect(
      graph.mockTestAttemptRepository,
      isA<ApiMockTestAttemptRepository>(),
    );
  });
}

SharedPreferencesLearningLocalDataSource _createLearningLocalDataSource() {
  return SharedPreferencesLearningLocalDataSource(
    vocabularyStorage: VocabularyProgressStorage(),
    grammarStorage: GrammarProgressStorage(),
  );
}

class _MemorySecureKeyValueStore implements SecureKeyValueStore {
  final Map<String, String> _values = {};

  @override
  Future<String?> read({required String key}) async => _values[key];

  @override
  Future<void> write({required String key, required String value}) async {
    _values[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    _values.remove(key);
  }
}
