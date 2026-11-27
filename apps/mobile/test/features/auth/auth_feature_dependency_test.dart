import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/core/config/app_config.dart';
import 'package:toeic_mobile/core/di/app_dependencies.dart';
import 'package:toeic_mobile/core/di/app_feature_dependencies.dart';
import 'package:toeic_mobile/core/storage/grammar_progress_storage.dart';
import 'package:toeic_mobile/core/storage/token_storage.dart';
import 'package:toeic_mobile/core/storage/vocabulary_progress_storage.dart';
import 'package:toeic_mobile/features/auth/repositories/api_auth_repository.dart';
import 'package:toeic_mobile/features/auth/repositories/test_data_auth_repository.dart';
import 'package:toeic_mobile/features/learning/data_sources/local/learning_local_data_source.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test('selects Test Data Auth only for Development with API disabled', () {
    final app = AppDependencies.fromEnvironment(
      config: AppConfig(
        environment: AppEnvironment.development,
        baseUrl: '',
        apiEnabled: false,
      ),
      tokenStorage: TokenStorage(secureStore: _MemorySecureKeyValueStore()),
    );

    final dependencies = AppFeatureDependencies.create(
      app: app,
      currentUserId: () => null,
      learningLocalDataSource: _learningLocalDataSource(),
    );

    expect(dependencies.authRepository, isA<TestDataAuthRepository>());
    expect(dependencies.apiAuthRepository, isNull);
    app.apiClient.close(force: true);
  });

  test('selects API Auth when its feature flag is enabled', () {
    final app = AppDependencies.fromEnvironment(
      config: AppConfig(
        environment: AppEnvironment.development,
        baseUrl: 'https://api.example.test/api/v1',
        apiEnabled: false,
        authApiEnabled: true,
        learningApiEnabled: false,
        mockTestApiEnabled: false,
        analyticsApiEnabled: false,
      ),
      tokenStorage: TokenStorage(secureStore: _MemorySecureKeyValueStore()),
    );

    final dependencies = AppFeatureDependencies.create(
      app: app,
      currentUserId: () => null,
      learningLocalDataSource: _learningLocalDataSource(),
    );

    expect(dependencies.authRepository, isA<ApiAuthRepository>());
    expect(dependencies.apiAuthRepository, isNotNull);
    app.apiClient.close(force: true);
  });

  test('rejects Test Data Auth outside Development', () {
    final app = AppDependencies.fromEnvironment(
      config: AppConfig(
        environment: AppEnvironment.staging,
        baseUrl: '',
        apiEnabled: false,
      ),
      tokenStorage: TokenStorage(secureStore: _MemorySecureKeyValueStore()),
    );

    expect(
      () => AppFeatureDependencies.create(
        app: app,
        currentUserId: () => null,
        learningLocalDataSource: _learningLocalDataSource(),
      ),
      throwsStateError,
    );
    app.apiClient.close(force: true);
  });
}

SharedPreferencesLearningLocalDataSource _learningLocalDataSource() {
  return SharedPreferencesLearningLocalDataSource(
    vocabularyStorage: VocabularyProgressStorage(),
    grammarStorage: GrammarProgressStorage(),
  );
}

class _MemorySecureKeyValueStore implements SecureKeyValueStore {
  final Map<String, String> _values = <String, String>{};

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
