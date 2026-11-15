import '../../features/ai_chat/repositories/ai_chat_repository.dart';
import '../../features/analytics/repositories/analytics_repository.dart';
import '../../features/auth/repositories/auth_repository.dart';
import '../../features/learning/repositories/learning_local_state_repository.dart';
import '../../features/learning/repositories/learning_repository.dart';
import '../../features/learning/repositories/learning_session_repository.dart';
import '../../features/mock_test/repositories/mock_test_attempt_repository.dart';
import '../../features/mock_test/repositories/mock_test_repository.dart';

/// Source-neutral dependency graph consumed by the shared application bootstrap.
/// This interface deliberately imports Repository contracts only; it knows
/// nothing about Test Data implementations or environment selection.
abstract interface class AppFeatureGraph {
  AuthRepository get authRepository;
  LearningRepository get learningRepository;
  LearningLocalStateRepository get learningLocalStateRepository;
  LearningSessionRepository get learningSessionRepository;
  AnalyticsRepository get analyticsRepository;
  MockTestRepository get mockTestRepository;
  MockTestAttemptRepository get mockTestAttemptRepository;
  AiChatRepository get aiChatRepository;

  void bindAuthSessionInvalidation(
    Future<void> Function(String userId) handler,
  );
}
