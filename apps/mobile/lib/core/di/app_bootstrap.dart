import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app.dart';
import '../../features/ai_chat/providers/ai_chat_history_provider.dart';
import '../../features/ai_chat/providers/ai_chat_provider.dart';
import '../../features/analytics/providers/analytics_provider.dart';
import '../../features/auth/providers/auth_session_provider.dart';
import '../../features/auth/providers/change_password_provider.dart';
import '../../features/auth/providers/email_verification_provider.dart';
import '../../features/auth/providers/forgot_password_provider.dart';
import '../../features/auth/providers/login_provider.dart';
import '../../features/auth/providers/register_provider.dart';
import '../../features/auth/providers/reset_password_provider.dart';
import '../../features/home/providers/home_provider.dart';
import '../../features/home/repositories/analytics_home_repository.dart';
import '../../features/learning/data_sources/local/learning_local_data_source.dart';
import '../../features/learning/providers/grammar_lesson_provider.dart';
import '../../features/learning/providers/grammar_list_provider.dart';
import '../../features/learning/providers/quick_quiz_provider.dart';
import '../../features/learning/providers/review_flashcard_provider.dart';
import '../../features/learning/providers/review_select_words_provider.dart';
import '../../features/learning/providers/vocabulary_provider.dart';
import '../../features/learning/providers/vocabulary_topic_provider.dart';
import '../../features/mock_test/providers/mock_test_select_provider.dart';
import '../../features/mock_test/providers/mock_test_taking_provider.dart';
import '../../features/mock_test/providers/select_test_parts_provider.dart';
import '../../features/mock_test/providers/test_history_detail_provider.dart';
import '../../features/mock_test/providers/test_history_provider.dart';
import '../session/user_scoped_data_coordinator.dart';
import '../storage/grammar_progress_storage.dart';
import '../storage/vocabulary_progress_storage.dart';
import 'app_dependencies.dart';
import 'app_feature_graph.dart';

/// A single Provider tree for every build. Only the composition graph factory
/// differs between Development and Release entry points.
typedef AppFeatureGraphFactory = AppFeatureGraph Function({
  required AppDependencies app,
  required String? Function() currentUserId,
  required LearningLocalDataSource learningLocalDataSource,
});

Future<void> startToeicApp({
  required AppDependencies appDependencies,
  required AppFeatureGraphFactory createFeatureGraph,
}) async {
  WidgetsFlutterBinding.ensureInitialized();

  final vocabularyStorage = VocabularyProgressStorage();
  final grammarProgressStorage = GrammarProgressStorage();
  final learningLocalDataSource = SharedPreferencesLearningLocalDataSource(
    vocabularyStorage: vocabularyStorage,
    grammarStorage: grammarProgressStorage,
  );
  late final UserScopedDataCoordinator userDataCoordinator;

  final featureGraph = createFeatureGraph(
    app: appDependencies,
    currentUserId: () => userDataCoordinator.currentUserId,
    learningLocalDataSource: learningLocalDataSource,
  );

  final authRepository = featureGraph.authRepository;
  final learningRepository = featureGraph.learningRepository;
  final learningLocalStateRepository =
      featureGraph.learningLocalStateRepository;
  final learningSessionRepository = featureGraph.learningSessionRepository;
  final analyticsRepository = featureGraph.analyticsRepository;
  final mockTestRepository = featureGraph.mockTestRepository;
  final mockTestAttemptRepository = featureGraph.mockTestAttemptRepository;
  final aiChatRepository = featureGraph.aiChatRepository;

  final mockTestSelectProvider = MockTestSelectProvider(
    repository: mockTestRepository,
  );
  final selectTestPartsProvider = SelectTestPartsProvider(
    testRepository: mockTestRepository,
    attemptRepository: mockTestAttemptRepository,
  );
  final testHistoryProvider = TestHistoryProvider(
    repository: mockTestAttemptRepository,
  );
  final testHistoryDetailProvider = TestHistoryDetailProvider(
    attemptRepository: mockTestAttemptRepository,
    testRepository: mockTestRepository,
  );
  final mockTestTakingProvider = MockTestTakingProvider(
    repository: mockTestAttemptRepository,
  );

  final analyticsProvider = AnalyticsProvider(repository: analyticsRepository);
  late final AuthSessionProvider authSessionProvider;
  final homeRepository = AnalyticsHomeRepository(
    analyticsRepository: analyticsRepository,
    learningRepository: learningRepository,
    currentUserName: () => authSessionProvider.currentUser?.fullName,
  );
  final homeProvider = HomeProvider(repository: homeRepository);

  final vocabularyTopicsProvider = VocabularyTopicsProvider(
    repository: learningRepository,
    localStateRepository: learningLocalStateRepository,
  );
  final vocabularyProvider = VocabularyProvider(
    repository: learningRepository,
    localStateRepository: learningLocalStateRepository,
    currentUserId: () => userDataCoordinator.currentUserId,
  );
  final grammarListProvider = GrammarListProvider(
    repository: learningRepository,
    localStateRepository: learningLocalStateRepository,
    currentUserId: () => userDataCoordinator.currentUserId,
  );
  final grammarLessonProvider = GrammarLessonProvider(
    repository: learningRepository,
    localStateRepository: learningLocalStateRepository,
    currentUserId: () => userDataCoordinator.currentUserId,
  );
  final quickQuizProvider = QuickQuizProvider(
    sessionRepository: learningSessionRepository,
  );
  final reviewSelectWordsProvider = ReviewSelectWordsProvider(
    repository: learningRepository,
    localStateRepository: learningLocalStateRepository,
    currentUserId: () => userDataCoordinator.currentUserId,
  );
  final reviewFlashcardProvider = ReviewFlashcardProvider(
    repository: learningRepository,
    localStateRepository: learningLocalStateRepository,
    currentUserId: () => userDataCoordinator.currentUserId,
    onProgressPersisted: vocabularyTopicsProvider.refreshProgress,
  );

  final aiChatHistoryProvider = AiChatHistoryProvider(
    repository: aiChatRepository,
  );
  final aiChatProvider = AiChatProvider(repository: aiChatRepository);

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
      learningLocalStateRepository.resetForUserScopeChange,
      learningSessionRepository.resetForUserScopeChange,
      learningRepository.resetForUserScopeChange,
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
      aiChatRepository.resetForUserScopeChange,
      mockTestAttemptRepository.resetForUserScopeChange,
      mockTestRepository.resetForUserScopeChange,
      mockTestSelectProvider.resetForUserScopeChange,
      selectTestPartsProvider.resetForUserScopeChange,
      testHistoryProvider.resetForUserScopeChange,
      testHistoryDetailProvider.resetForUserScopeChange,
      mockTestTakingProvider.resetForUserScopeChange,
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
  featureGraph.bindAuthSessionInvalidation(
    authSessionProvider.invalidateSessionForUser,
  );

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<MockTestSelectProvider>.value(
          value: mockTestSelectProvider,
        ),
        ChangeNotifierProvider<SelectTestPartsProvider>.value(
          value: selectTestPartsProvider,
        ),
        ChangeNotifierProvider<TestHistoryProvider>.value(
          value: testHistoryProvider,
        ),
        ChangeNotifierProvider<TestHistoryDetailProvider>.value(
          value: testHistoryDetailProvider,
        ),
        ChangeNotifierProvider<MockTestTakingProvider>.value(
          value: mockTestTakingProvider,
        ),
        ChangeNotifierProvider<AnalyticsProvider>.value(
          value: analyticsProvider,
        ),
        ChangeNotifierProvider<HomeProvider>.value(value: homeProvider),
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
