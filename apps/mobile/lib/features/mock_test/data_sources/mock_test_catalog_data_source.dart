import '../models/mock_test.dart';
import '../models/test_part.dart';

/// Source contract for the public Test Catalog (tests and Part structure).
abstract interface class MockTestCatalogDataSource {
  Future<List<MockTest>> getTests();
  Future<MockTest> getTest(String testId);
  Future<List<TestPart>> getTestParts(String testId);
}
