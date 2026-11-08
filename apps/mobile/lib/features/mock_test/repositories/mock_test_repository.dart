import '../mock_data/mock_test_mock_data.dart';
import '../models/mock_test.dart';
import '../models/test_part.dart';

class MockTestRepository {
  Future<List<MockTest>> getTests() async {
    return List<MockTest>.unmodifiable(MockTestMockData.tests);
  }

  Future<MockTest> getTest(String testId) async {
    for (final test in MockTestMockData.tests) {
      if (test.testId == testId) return test;
    }
    throw StateError('Không tìm thấy đề thi được chọn.');
  }

  Future<List<TestPart>> getTestParts(String testId) async {
    await getTest(testId);
    return List<TestPart>.unmodifiable(MockTestMockData.parts);
  }
}
