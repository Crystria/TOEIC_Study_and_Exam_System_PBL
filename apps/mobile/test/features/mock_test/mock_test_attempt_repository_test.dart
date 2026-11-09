import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/features/mock_test/mock_data/mock_test_mock_data.dart';
import 'package:toeic_mobile/features/mock_test/models/test_attempt.dart';
import 'package:toeic_mobile/features/mock_test/repositories/mock_test_attempt_repository.dart';
import 'package:toeic_mobile/features/mock_test/repositories/mock_test_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockTestRepository testRepository;
  late MockTestAttemptRepository attemptRepository;

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    testRepository = MockTestRepository();
    attemptRepository = MockTestAttemptRepository(
      testRepository: testRepository,
    );
  });

  test(
    'starts a Full TOEIC attempt with 200 questions and 120 minutes',
    () async {
      final testId = MockTestMockData.tests.first.testId;
      final attempt = await attemptRepository.startFullAttempt(testId);

      expect(attempt.mode, TestAttemptMode.full);
      expect(attempt.parts, [1, 2, 3, 4, 5, 6, 7]);
      expect(attempt.durationSeconds, 7200);
      expect(attempt.status, TestAttemptStatus.inProgress);

      final structure = await testRepository.getTestParts(testId);
      expect(
        structure.fold<int>(0, (total, part) => total + part.totalQuestions),
        200,
      );
      expect(structure.map((part) => part.totalQuestions).toList(), [
        6,
        25,
        39,
        30,
        30,
        16,
        54,
      ]);
    },
  );

  test('rejects duplicate Part selections and invalid duration', () async {
    final testId = MockTestMockData.tests.first.testId;

    await expectLater(
      attemptRepository.startPartAttempt(
        testId: testId,
        parts: [2, 2],
        durationSeconds: 1800,
      ),
      throwsA(isA<ArgumentError>()),
    );

    await expectLater(
      attemptRepository.startPartAttempt(
        testId: testId,
        parts: [2],
        durationSeconds: 299,
      ),
      throwsA(isA<ArgumentError>()),
    );
  });

  test('starts a Part attempt without changing Full TOEIC rules', () async {
    final attempt = await attemptRepository.startPartAttempt(
      testId: MockTestMockData.tests.first.testId,
      parts: [7, 2],
      durationSeconds: 900,
    );

    expect(attempt.mode, TestAttemptMode.part);
    expect(attempt.parts, [7, 2]);
    expect(attempt.durationSeconds, 900);
  });
}
