import '../models/mock_test.dart';
import '../models/test_part.dart';

/// Shared Test Catalog repository contract used by providers and screens.
abstract interface class MockTestRepository {
  Future<List<MockTest>> getTests();
  Future<MockTest> getTest(String testId);
  Future<List<TestPart>> getTestParts(String testId);
  void resetForUserScopeChange();
}
