import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/di/app_dependencies.dart';
import 'core/network/api_client.dart';
import 'core/session/user_scoped_data_coordinator.dart';
import 'features/learning/repositories/offline_learning_fixtures.dart';
import 'core/storage/token_storage.dart';
import 'core/storage/grammar_progress_storage.dart';
import 'core/storage/vocabulary_progress_storage.dart';
import 'features/ai_chat/ai_chat_dependencies.dart';
import 'features/ai_chat/providers/ai_chat_history_provider.dart';
import 'features/ai_chat/providers/ai_chat_provider.dart';
import 'features/auth/providers/auth_session_provider.dart';
import 'features/analytics/providers/analytics_provider.dart';
import 'features/analytics/repositories/analytics_repository.dart';
import 'features/analytics/services/analytics_api_service.dart';
import 'features/home/providers/home_provider.dart';
import 'features/home/repositories/analytics_home_repository.dart';
import 'features/auth/providers/change_password_provider.dart';
import 'features/auth/providers/email_verification_provider.dart';
import 'features/auth/providers/forgot_password_provider.dart';
import 'features/auth/providers/login_provider.dart';
import 'features/auth/providers/register_provider.dart';
import 'features/auth/providers/reset_password_provider.dart';
import 'features/auth/repositories/api_auth_repository.dart';
import 'features/auth/repositories/auth_repository.dart';
import 'features/auth/repositories/fake_auth_repository.dart';
import 'features/auth/services/auth_api_service.dart';
import 'features/auth/services/device_id_provider.dart';
import 'features/learning/repositories/learning_repository.dart';
import 'features/learning/services/learning_api_service.dart';
import 'features/learning/providers/grammar_lesson_provider.dart';
import 'features/learning/providers/grammar_list_provider.dart';
import 'features/learning/providers/quick_quiz_provider.dart';
import 'features/learning/providers/review_flashcard_provider.dart';
import 'features/learning/providers/review_select_words_provider.dart';
import 'features/learning/providers/vocabulary_provider.dart';
import 'features/learning/providers/vocabulary_topic_provider.dart';
import 'features/mock_test/mock_test_dependencies.dart';
import 'features/mock_test/services/exam_api_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final appDependencies = AppDependencies.fromEnvironment();
  OfflineLearningFixtures? offlineLearningFixtures;
  if (kDebugMode &&
      appDependencies.config.isDevelopment &&
      !appDependencies.config.isLearningApiEnabled) {
    try {
      offlineLearningFixtures = await OfflineLearningFixtures.load();
    } catch (error, stackTrace) {
      debugPrint(
        'Offline fixtures unavailable; using built-in mock data: $error',
      );
      debugPrintStack(stackTrace: stackTrace);
    }
  }
  final vocabularyStorage = VocabularyProgressStorage();
  final grammarProgressStorage = GrammarProgressStorage();
  late final UserScopedDataCoordinator userDataCoordinator;
  late final AuthSessionProvider authSessionProvider;

  MockTestDependencies.configureApi(
    api: appDependencies.config.isMockTestApiEnabled
        ? ExamApiService(client: appDependencies.apiClient)
        : null,
    currentUserId: () => userDataCoordinator.currentUserId,
  );

  final LearningRepository? learningRepository =
      appDependencies.config.isLearningApiEnabled
      ? ApiLearningRepository(
          api: LearningApiService(client: appDependencies.apiClient),
          currentUserId: () => userDataCoordinator.currentUserId,
        )
      : null;

  final AnalyticsRepository analyticsRepository =
      appDependencies.config.isAnalyticsApiEnabled
      ? ApiAnalyticsRepository(
          api: AnalyticsApiService(client: appDependencies.apiClient),
          currentUserId: () => userDataCoordinator.currentUserId,
        )
      : MockAnalyticsRepository();
  final analyticsProvider = AnalyticsProvider(repository: analyticsRepository);
  final homeRepository = AnalyticsHomeRepository(
    analyticsRepository: analyticsRepository,
    learningRepository: learningRepository,
    currentUserName: () => authSessionProvider.currentUser?.fullName,
  );
  final homeProvider = HomeProvider(repository: homeRepository);

  // Select the Auth implementation independently while retaining the legacy
  // API_ENABLED fallback through AppConfig.
  final ApiAuthRepository? apiAuthRepository =
      appDependencies.config.isAuthApiEnabled
      ? ApiAuthRepository(
          apiService: AuthApiService(client: appDependencies.apiClient),
          tokenStorage: appDependencies.tokenStorage,
          deviceIdProvider: SecureDeviceIdProvider(),
        )
      : null;
  final AuthRepository authRepository =
      apiAuthRepository ?? FakeAuthRepository();
  if (apiAuthRepository != null) {
    appDependencies.apiClient.setUnauthorizedRefreshHandler(
      apiAuthRepository.refreshAfterUnauthorized,
      onRetryRejected: apiAuthRepository.clearRejectedSessionIfCurrent,
    );
  }

  // App-lifetime providers are created once so the session coordinator can
  // reset every user-owned in-memory cache on logout/account switch.
  final vocabularyTopicsProvider = VocabularyTopicsProvider(
    storage: vocabularyStorage,
    repository: learningRepository,
    mockTopics: offlineLearningFixtures?.vocabularyTopics,
  );
  final vocabularyProvider = VocabularyProvider(
    storage: vocabularyStorage,
    catalog: offlineLearningFixtures?.vocabularyCatalog,
    repository: learningRepository,
    currentUserId: () => userDataCoordinator.currentUserId,
  );
  final grammarListProvider = GrammarListProvider(
    repository: learningRepository,
    mockLessons: offlineLearningFixtures?.grammarLessons,
    progressStorage: grammarProgressStorage,
    currentUserId: () => userDataCoordinator.currentUserId,
  );
  final grammarLessonProvider = GrammarLessonProvider(
    repository: learningRepository,
    mockLessons: offlineLearningFixtures?.grammarLessons,
    progressStorage: grammarProgressStorage,
    currentUserId: () => userDataCoordinator.currentUserId,
  );
  final quickQuizProvider = QuickQuizProvider();
  final reviewSelectWordsProvider = ReviewSelectWordsProvider(
    repository: learningRepository,
    currentUserId: () => userDataCoordinator.currentUserId,
  );
  final reviewFlashcardProvider = ReviewFlashcardProvider(
    repository: learningRepository,
    storage: vocabularyStorage,
    currentUserId: () => userDataCoordinator.currentUserId,
    onProgressPersisted: vocabularyTopicsProvider.refreshProgress,
  );

  final aiChatHistoryProvider = AiChatHistoryProvider(
    repository: AiChatDependencies.repository,
  );
  final aiChatProvider = AiChatProvider(
    repository: AiChatDependencies.repository,
  );

  final loginProvider = LoginProvider(repository: authRepository);
  final registerProvider = RegisterProvider(repository: authRepository);
  final forgotPasswordProvider = ForgotPasswordProvider(
    repository: authRepository,
  );
  final resetPasswordProvider = ResetPasswordProvider(
    repository: authRepository,
  );
  final changePasswordProvider = ChangePasswordProvider(
    repository: authRepository,
  );
  final emailVerificationProvider = EmailVerificationProvider(
    repository: authRepository,
  );

  userDataCoordinator = UserScopedDataCoordinator(
    vocabularyStorage: vocabularyStorage,
    resetCallbacks: [
      learningRepository?.resetForUserScopeChange ?? () {},
      analyticsRepository.resetForUserScopeChange,
      analyticsProvider.resetForUserScopeChange,
      homeProvider.resetForUserScopeChange,
      vocabularyProvider.resetForUserScopeChange,
      vocabularyTopicsProvider.resetForUserScopeChange,
      quickQuizProvider.resetForUserScopeChange,
      reviewSelectWordsProvider.resetForUserScopeChange,
      reviewFlashcardProvider.reset,
      grammarListProvider.resetForUserScopeChange,
      grammarLessonProvider.resetForUserScopeChange,
      aiChatHistoryProvider.resetForUserScopeChange,
      aiChatProvider.resetForUserScopeChange,
      AiChatDependencies.repository.resetForUserScopeChange,
      MockTestDependencies.resetForUserScopeChange,
      loginProvider.reset,
      registerProvider.reset,
      forgotPasswordProvider.reset,
      resetPasswordProvider.reset,
      changePasswordProvider.reset,
      emailVerificationProvider.reset,
    ],
    loadCallbacks: [
      vocabularyProvider.initialize,
      vocabularyTopicsProvider.initialize,
    ],
  );

  authSessionProvider = AuthSessionProvider(
    repository: authRepository,
    userDataCoordinator: userDataCoordinator,
  );
  apiAuthRepository?.setSessionInvalidationHandler(
    authSessionProvider.invalidateSessionForUser,
  );

  runApp(
    MultiProvider(
      providers: [
        Provider<AppDependencies>.value(value: appDependencies),
        Provider<AppConfig>.value(value: appDependencies.config),
        Provider<OfflineLearningFixtures?>.value(
          value: offlineLearningFixtures,
        ),
        Provider<TokenStorage>.value(value: appDependencies.tokenStorage),
        Provider<VocabularyProgressStorage>.value(value: vocabularyStorage),
        Provider<GrammarProgressStorage>.value(value: grammarProgressStorage),
        Provider<UserScopedDataCoordinator>.value(value: userDataCoordinator),
        Provider<LearningRepository?>.value(value: learningRepository),
        Provider<AnalyticsRepository>.value(value: analyticsRepository),
        ChangeNotifierProvider<AnalyticsProvider>.value(
          value: analyticsProvider,
        ),
        ChangeNotifierProvider<HomeProvider>.value(value: homeProvider),
        Provider<ApiClient>(
          create: (_) => appDependencies.apiClient,
          dispose: (_, apiClient) => apiClient.close(),
        ),
        ChangeNotifierProvider<AuthSessionProvider>.value(
          value: authSessionProvider,
        ),
        ChangeNotifierProvider<LoginProvider>.value(value: loginProvider),
        ChangeNotifierProvider<RegisterProvider>.value(value: registerProvider),
        ChangeNotifierProvider<ForgotPasswordProvider>.value(
          value: forgotPasswordProvider,
        ),
        ChangeNotifierProvider<ResetPasswordProvider>.value(
          value: resetPasswordProvider,
        ),
        ChangeNotifierProvider<ChangePasswordProvider>.value(
          value: changePasswordProvider,
        ),
        ChangeNotifierProvider<EmailVerificationProvider>.value(
          value: emailVerificationProvider,
        ),
        ChangeNotifierProvider<AiChatHistoryProvider>.value(
          value: aiChatHistoryProvider,
        ),
        ChangeNotifierProvider<AiChatProvider>.value(value: aiChatProvider),
        ChangeNotifierProvider<VocabularyTopicsProvider>.value(
          value: vocabularyTopicsProvider,
        ),
        ChangeNotifierProvider<VocabularyProvider>.value(
          value: vocabularyProvider,
        ),
        ChangeNotifierProvider<GrammarListProvider>.value(
          value: grammarListProvider,
        ),
        ChangeNotifierProvider<GrammarLessonProvider>.value(
          value: grammarLessonProvider,
        ),
        ChangeNotifierProvider<QuickQuizProvider>.value(
          value: quickQuizProvider,
        ),
        ChangeNotifierProvider<ReviewSelectWordsProvider>.value(
          value: reviewSelectWordsProvider,
        ),
        ChangeNotifierProvider<ReviewFlashcardProvider>.value(
          value: reviewFlashcardProvider,
        ),
      ],
      child: const ToeicMobileApp(),
    ),
  );

  WidgetsBinding.instance.addPostFrameCallback((_) {
    authSessionProvider.restoreSession();
  });
}
