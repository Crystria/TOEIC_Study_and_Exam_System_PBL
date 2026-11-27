import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/mock_test/data_sources/remote/mock_test_remote_data_source.dart';
import 'package:toeic_mobile/features/mock_test/data_sources/test_data/mock_test_test_data_source.dart';
import 'package:toeic_mobile/features/mock_test/repositories/api_mock_test_repository.dart';
import 'package:toeic_mobile/features/mock_test/repositories/test_data_mock_test_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Test Data catalog is read from the runtime fixtures', () async {
    final repository = TestDataMockTestRepository(
      testDataSource: MockTestTestDataSource(),
    );

    final tests = await repository.getTests();
    final parts = await repository.getTestParts(tests.first.testId);

    expect(tests, isNotEmpty);
    expect(tests.first.testId, '11111111-1111-4111-8111-000000000005');
    expect(
      parts.map((part) => part.totalQuestions).reduce((a, b) => a + b),
      200,
    );
  });

  test(
    'API catalog errors propagate without using Test Data fixtures',
    () async {
      final repository = ApiMockTestRepository(
        remoteDataSource: _FailingCatalogRemoteDataSource(),
        currentUserId: () => 'api-user-001',
      );

      await expectLater(repository.getTests(), throwsA(isA<StateError>()));
    },
  );
}

class _FailingCatalogRemoteDataSource implements MockTestRemoteDataSource {
  @override
  Future<Object?> listTests({required int page, required int size}) async {
    throw StateError('Exam API unavailable');
  }

  @override
  noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
