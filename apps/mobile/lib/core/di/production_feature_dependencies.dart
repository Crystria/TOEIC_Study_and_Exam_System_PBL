import '../../features/ai_chat/repositories/ai_chat_repository.dart';
import '../../features/ai_chat/repositories/unavailable_ai_chat_repository.dart';
import '../../features/analytics/data_sources/remote/api_analytics_data_source.dart';
import '../../features/analytics/repositories/analytics_repository.dart';
import '../../features/analytics/services/analytics_api_service.dart';
import '../../features/auth/data_sources/local/secure_auth_local_data_source.dart';
import '../../features/auth/data_sources/remote/api_auth_remote_data_source.dart';
import '../../features/auth/repositories/api_auth_repository.dart';
import '../../features/auth/repositories/auth_repository.dart';
import '../../features/auth/services/auth_api_service.dart';
import '../../features/auth/services/device_id_provider.dart';
import '../../features/learning/data_sources/local/learning_local_data_source.dart';
import '../../features/learning/data_sources/remote/api_learning_data_source.dart';
import '../../features/learning/repositories/api_learning_session_repository.dart';
import '../../features/learning/repositories/learning_local_state_repository.dart';
import '../../features/learning/repositories/learning_repository.dart';
import '../../features/learning/repositories/learning_session_journal.dart';
import '../../features/learning/repositories/learning_session_repository.dart';
import '../../features/learning/services/learning_api_service.dart';
import '../../features/mock_test/data_sources/local/exam_attempt_local_data_source.dart';
import '../../features/mock_test/data_sources/local/exam_attempt_start_journal.dart';
import '../../features/mock_test/data_sources/remote/api_mock_test_remote_data_source.dart';
import '../../features/mock_test/repositories/api_mock_test_attempt_repository.dart';
import '../../features/mock_test/repositories/api_mock_test_repository.dart';
import '../../features/mock_test/repositories/mock_test_attempt_repository.dart';
import '../../features/mock_test/repositories/mock_test_repository.dart';
import '../../features/mock_test/services/exam_api_service.dart';
import 'app_dependencies.dart';
import 'app_feature_graph.dart';

/// Production-only composition graph. It has mandatory API implementations
/// for Auth, Learning, Mock Test and Analytics; no Test Data implementation is
/// imported or selectable from this library.
class ProductionFeatureDependencies implements AppFeatureGraph {
  ProductionFeatureDependencies._({
    required this.authRepository,
    required this.learningRepository,
    required this.learningLocalStateRepository,
    required this.learningSessionRepository,
    required this.analyticsRepository,
    required this.mockTestRepository,
    required this.mockTestAttemptRepository,
    required this.aiChatRepository,
    required ApiAuthRepository apiAuthRepository,
  }) : _apiAuthRepository = apiAuthRepository;

  factory ProductionFeatureDependencies.create({
    required AppDependencies app,
    required String? Function() currentUserId,
    required LearningLocalDataSource learningLocalDataSource,
  }) {
    app.config.validateForRelease();

    final apiAuthRepository = ApiAuthRepository(
      remoteDataSource: ApiAuthRemoteDataSource(
        service: AuthApiService(client: app.apiClient),
      ),
      localDataSource: SecureAuthLocalDataSource(
        tokenStorage: app.tokenStorage,
      ),
      deviceIdProvider: SecureDeviceIdProvider(),
    );
    app.apiClient.setUnauthorizedRefreshHandler(
      apiAuthRepository.refreshAfterUnauthorized,
      onRetryRejected: apiAuthRepository.clearRejectedSessionIfCurrent,
    );

    final learningLocalStateRepository = ScopedLearningLocalStateRepository(
      localDataSource: learningLocalDataSource,
      currentUserId: currentUserId,
    );
    final learningRemoteDataSource = ApiLearningDataSource(
      service: LearningApiService(client: app.apiClient),
    );
    final learningRepository = ApiLearningRepository(
      remoteDataSource: learningRemoteDataSource,
      currentUserId: currentUserId,
    );
    final learningSessionRepository = ApiLearningSessionRepository(
      remoteDataSource: learningRemoteDataSource,
      currentUserId: currentUserId,
      journal: LearningSessionJournal(),
    );

    final analyticsRepository = ApiAnalyticsRepository(
      remoteDataSource: ApiAnalyticsDataSource(
        service: AnalyticsApiService(client: app.apiClient),
      ),
      currentUserId: currentUserId,
    );

    final examRemoteDataSource = ApiMockTestRemoteDataSource(
      service: ExamApiService(client: app.apiClient),
    );
    final mockTestRepository = ApiMockTestRepository(
      remoteDataSource: examRemoteDataSource,
      currentUserId: currentUserId,
    );
    final mockTestAttemptRepository = ApiMockTestAttemptRepository(
      testRepository: mockTestRepository,
      remoteDataSource: examRemoteDataSource,
      currentUserId: currentUserId,
      localDataSource: ExamAttemptLocalDataSource(),
      startJournal: ExamAttemptStartJournal(),
    );

    // AI Chat remains unavailable until its independent Backend security gate
    // passes. The Release graph must never load its fixtures/local mock adapter.
    final aiChatRepository = const UnavailableAiChatRepository();

    return ProductionFeatureDependencies._(
      authRepository: apiAuthRepository,
      apiAuthRepository: apiAuthRepository,
      learningRepository: learningRepository,
      learningLocalStateRepository: learningLocalStateRepository,
      learningSessionRepository: learningSessionRepository,
      analyticsRepository: analyticsRepository,
      mockTestRepository: mockTestRepository,
      mockTestAttemptRepository: mockTestAttemptRepository,
      aiChatRepository: aiChatRepository,
    );
  }

  @override
  final AuthRepository authRepository;
  final ApiAuthRepository _apiAuthRepository;

  @override
  final LearningRepository learningRepository;

  @override
  final LearningLocalStateRepository learningLocalStateRepository;

  @override
  final LearningSessionRepository learningSessionRepository;

  @override
  final AnalyticsRepository analyticsRepository;

  @override
  final MockTestRepository mockTestRepository;

  @override
  final MockTestAttemptRepository mockTestAttemptRepository;

  @override
  final AiChatRepository aiChatRepository;

  @override
  void bindAuthSessionInvalidation(
    Future<void> Function(String userId) handler,
  ) {
    _apiAuthRepository.setSessionInvalidationHandler(handler);
  }
}
