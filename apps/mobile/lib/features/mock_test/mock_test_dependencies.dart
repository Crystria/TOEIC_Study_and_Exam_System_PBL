import 'repositories/mock_test_attempt_repository.dart';
import 'repositories/mock_test_repository.dart';
import 'services/exam_api_service.dart';

/// App-lifetime repositories shared by test selection, active attempts and
/// history. API configuration is selected once from AppConfig.apiEnabled.
class MockTestDependencies {
  MockTestDependencies._();

  static final MockTestRepository testRepository = MockTestRepository();

  static final MockTestAttemptRepository attemptRepository =
      MockTestAttemptRepository(testRepository: testRepository);

  static void configureApi({
    required ExamApiService? api,
    String? Function()? currentUserId,
  }) {
    testRepository.configureApi(
      api: api,
      currentUserId: currentUserId,
    );
    attemptRepository.configureApi(
      api: api,
      currentUserId: currentUserId,
    );
  }

  static void resetForUserScopeChange() {
    attemptRepository.resetForUserScopeChange();
    testRepository.resetForUserScopeChange();
  }
}
