import '../data_sources/mock_test_catalog_data_source.dart';
import '../models/mock_test.dart';
import '../models/test_part.dart';
import 'mock_test_repository.dart';

/// Development-only Test Data implementation of the Test Catalog contract.
class TestDataMockTestRepository implements MockTestRepository {
  TestDataMockTestRepository({
    required MockTestCatalogDataSource testDataSource,
  }) : _testDataSource = testDataSource;

  final MockTestCatalogDataSource _testDataSource;

  @override
  Future<List<MockTest>> getTests() => _testDataSource.getTests();

  @override
  Future<MockTest> getTest(String testId) => _testDataSource.getTest(testId);

  @override
  Future<List<TestPart>> getTestParts(String testId) =>
      _testDataSource.getTestParts(testId);

  @override
  void resetForUserScopeChange() {
    // Catalog fixtures are public app content, not user-owned state.
  }
}
