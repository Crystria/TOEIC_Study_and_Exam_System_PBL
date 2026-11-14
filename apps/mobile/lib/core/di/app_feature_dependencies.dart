import 'package:flutter/foundation.dart' show kReleaseMode;

import '../../features/ai_chat/ai_chat_dependencies.dart';
import '../../features/ai_chat/repositories/ai_chat_repository.dart';
import '../../features/analytics/data_sources/remote/api_analytics_data_source.dart';
import '../../features/analytics/data_sources/test_data/analytics_test_data_source.dart';
import '../../features/analytics/repositories/analytics_repository.dart';
import '../../features/analytics/repositories/test_data/test_data_analytics_repository.dart';
import '../../features/analytics/services/analytics_api_service.dart';
import '../../features/auth/repositories/api_auth_repository.dart';
import '../../features/auth/repositories/auth_repository.dart';
import '../../features/auth/repositories/test_data_auth_repository.dart';
import '../../features/auth/data_sources/remote/api_auth_remote_data_source.dart';
import '../../features/auth/data_sources/local/secure_auth_local_data_source.dart';
import '../../features/auth/data_sources/test_data/test_data_auth_data_source.dart';
import '../../features/auth/services/auth_api_service.dart';
import '../../features/auth/services/device_id_provider.dart';
import '../../features/learning/data_sources/local/learning_local_data_source.dart';
import '../../features/learning/data_sources/remote/api_learning_data_source.dart';
import '../../features/learning/data_sources/test_data/learning_test_data_source.dart';
import '../../features/learning/repositories/learning_repository.dart';
import '../../features/learning/repositories/test_data_learning_repository.dart';
import '../../features/learning/services/learning_api_service.dart';
import '../../features/mock_test/data_sources/remote/api_mock_test_remote_data_source.dart';
import '../../features/mock_test/data_sources/local/exam_attempt_local_data_source.dart';
import '../../features/mock_test/data_sources/local/exam_attempt_start_journal.dart';
import '../../features/mock_test/data_sources/test_data/mock_test_test_data_source.dart';
import '../../features/mock_test/data_sources/test_data/test_data_mock_test_question_bank_data_source.dart';
import '../../features/mock_test/repositories/api_mock_test_repository.dart';
import '../../features/mock_test/repositories/test_data_mock_test_repository.dart';
import '../../features/mock_test/repositories/api_mock_test_attempt_repository.dart';
import '../../features/mock_test/repositories/test_data_mock_test_attempt_repository.dart';
import '../../features/mock_test/repositories/mock_test_repository.dart';
import '../../features/mock_test/repositories/mock_test_attempt_repository.dart';
import '../../features/mock_test/services/exam_api_service.dart';
import 'app_dependencies.dart';
import 'app_feature_graph.dart';

/// Feature-level dependency graph created once by the application composition
/// root. It is the only place that selects the currently available feature
/// repository implementations from `AppConfig`.
///
/// This is the application composition root for feature dependencies. Providers
/// receive non-null Repository contracts and never select data sources.
class AppFeatureDependencies implements AppFeatureGraph {
  AppFeatureDependencies._({
    required this.authRepository,
    required this.apiAuthRepository,
    required this.learningRepository,
    required this.analyticsRepository,
    required this.mockTestRepository,
    required this.mockTestAttemptRepository,
    required this.aiChat,
  });

  factory AppFeatureDependencies.create({
    required AppDependencies app,
    required String? Function() currentUserId,
    required LearningLocalDataSource learningLocalDataSource,
  }) {
    final config = app.config;

    if (!config.isAuthApiEnabled && (!config.isDevelopment || kReleaseMode)) {
      throw StateError(
        'Auth Test Data is available only in a non-release Development build. '
        'Enable the Auth API for Staging/Production/Release.',
      );
    }

    final ApiAuthRepository? apiAuthRepository = config.isAuthApiEnabled
        ? ApiAuthRepository(
            remoteDataSource: ApiAuthRemoteDataSource(
              service: AuthApiService(client: app.apiClient),
            ),
            localDataSource: SecureAuthLocalDataSource(
              tokenStorage: app.tokenStorage,
            ),
            deviceIdProvider: SecureDeviceIdProvider(),
          )
        : null;

    if (apiAuthRepository != null) {
      app.apiClient.setUnauthorizedRefreshHandler(
        apiAuthRepository.refreshAfterUnauthorized,
        onRetryRejected: apiAuthRepository.clearRejectedSessionIfCurrent,
      );
    }

    if (!config.isLearningApiEnabled &&
        (!config.isDevelopment || kReleaseMode)) {
      throw StateError(
        'Learning Test Data is available only in a non-release Development '
        'build. Enable the Learning API for Staging/Production/Release.',
      );
    }

    final LearningRepository learningRepository = config.isLearningApiEnabled
        ? ApiLearningRepository(
            remoteDataSource: ApiLearningDataSource(
              service: LearningApiService(client: app.apiClient),
            ),
            localDataSource: learningLocalDataSource,
            currentUserId: currentUserId,
          )
        : TestDataLearningRepository(
            testDataSource: LearningTestDataSource(),
            localDataSource: learningLocalDataSource,
            currentUserId: currentUserId,
          );

    if (!config.isAnalyticsApiEnabled &&
        (!config.isDevelopment || kReleaseMode)) {
      throw StateError(
        'Analytics Test Data is available only in a non-release Development '
        'build. Enable the Analytics API for Staging/Production/Release.',
      );
    }

    final AnalyticsRepository analyticsRepository = config.isAnalyticsApiEnabled
        ? ApiAnalyticsRepository(
            remoteDataSource: ApiAnalyticsDataSource(
              service: AnalyticsApiService(client: app.apiClient),
            ),
            currentUserId: currentUserId,
          )
        : TestDataAnalyticsRepository(
            testDataSource: AnalyticsTestDataSource(),
            currentUserId: currentUserId,
          );

    if (!config.isMockTestApiEnabled &&
        (!config.isDevelopment || kReleaseMode)) {
      throw StateError(
        'Mock Test Test Data is available only in a non-release Development '
        'build. Enable the Mock Test API for Staging/Production/Release.',
      );
    }

    late final MockTestRepository mockTestRepository;
    late final MockTestAttemptRepository mockTestAttemptRepository;
    final examAttemptLocalDataSource = ExamAttemptLocalDataSource();
    if (config.isMockTestApiEnabled) {
      final remoteDataSource = ApiMockTestRemoteDataSource(
        service: ExamApiService(client: app.apiClient),
      );
      mockTestRepository = ApiMockTestRepository(
        remoteDataSource: remoteDataSource,
        currentUserId: currentUserId,
      );
      mockTestAttemptRepository = ApiMockTestAttemptRepository(
        testRepository: mockTestRepository,
        remoteDataSource: remoteDataSource,
        currentUserId: currentUserId,
        localDataSource: examAttemptLocalDataSource,
        startJournal: ExamAttemptStartJournal(),
      );
    } else {
      mockTestRepository = TestDataMockTestRepository(
        testDataSource: MockTestTestDataSource(),
      );
      mockTestAttemptRepository = TestDataMockTestAttemptRepository(
        testRepository: mockTestRepository,
        currentUserId: currentUserId,
        localDataSource: examAttemptLocalDataSource,
        questionBankDataSource: const TestDataMockTestQuestionBankDataSource(),
      );
    }
    return AppFeatureDependencies._(
      authRepository:
          apiAuthRepository ??
          TestDataAuthRepository(dataSource: TestDataAuthDataSource()),
      apiAuthRepository: apiAuthRepository,
      learningRepository: learningRepository,
      analyticsRepository: analyticsRepository,
      mockTestRepository: mockTestRepository,
      mockTestAttemptRepository: mockTestAttemptRepository,
      aiChat: AiChatDependencies.create(
        environment: config.environment,
        currentUserId: currentUserId,
      ),
    );
  }

  @override
  final AuthRepository authRepository;
  final ApiAuthRepository? apiAuthRepository;
  @override
  final LearningRepository learningRepository;
  @override
  final AnalyticsRepository analyticsRepository;
  @override
  final MockTestRepository mockTestRepository;
  @override
  final MockTestAttemptRepository mockTestAttemptRepository;
  final AiChatDependencies aiChat;

  @override
  AiChatRepository get aiChatRepository => aiChat.repository;

  /// Connects API Auth's session invalidation callback after the session
  /// provider has been constructed by the composition root.
  void bindAuthSessionInvalidation(
    Future<void> Function(String userId) handler,
  ) {
    apiAuthRepository?.setSessionInvalidationHandler(handler);
  }
}
