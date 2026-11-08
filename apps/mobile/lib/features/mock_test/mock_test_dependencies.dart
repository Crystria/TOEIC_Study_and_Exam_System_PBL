import 'repositories/mock_test_attempt_repository.dart';
import 'repositories/mock_test_repository.dart';

/// App-lifetime composition root for the in-memory Mock Test repositories.
/// This keeps Attempts available while navigating between the test list,
/// history list, detail screens, and result screens in the current app session.
class MockTestDependencies {
  MockTestDependencies._();

  static final MockTestRepository testRepository = MockTestRepository();

  static final MockTestAttemptRepository attemptRepository =
      MockTestAttemptRepository(testRepository: testRepository);
}
