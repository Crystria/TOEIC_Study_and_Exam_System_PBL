import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/features/mock_test/models/test_attempt.dart';
import 'package:toeic_mobile/features/mock_test/repositories/mock_test_repository.dart';
import 'package:toeic_mobile/features/mock_test/repositories/test_data_mock_test_repository.dart';
import 'package:toeic_mobile/features/mock_test/repositories/test_data_mock_test_attempt_repository.dart';
import 'package:toeic_mobile/features/mock_test/data_sources/test_data/mock_test_test_data_source.dart';
import 'package:toeic_mobile/features/mock_test/data_sources/local/exam_attempt_local_data_source.dart';
import 'package:toeic_mobile/features/mock_test/data_sources/test_data/test_data_mock_test_question_bank_data_source.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockTestRepository testRepository;
  late TestDataMockTestAttemptRepository attemptRepository;

  const testId = '11111111-1111-4111-8111-000000000005';
  const userId = 'mock-test-user-001';

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    testRepository = TestDataMockTestRepository(
      testDataSource: MockTestTestDataSource(),
    );
    attemptRepository = TestDataMockTestAttemptRepository(
      testRepository: testRepository,
      currentUserId: () => userId,
      localDataSource: ExamAttemptLocalDataSource(),
      questionBankDataSource: const TestDataMockTestQuestionBankDataSource(),
    );
  });

  test(
    'starts a Full TOEIC attempt with 200 questions and 120 minutes',
    () async {
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
      testId: testId,
      parts: [7, 2],
      durationSeconds: 900,
    );

    expect(attempt.mode, TestAttemptMode.part);
    expect(attempt.parts, [7, 2]);
    expect(attempt.durationSeconds, 900);
  });

  test(
    'persists a draft and active Attempt across repository instances',
    () async {
      final attempt = await attemptRepository.startPartAttempt(
        testId: testId,
        parts: [5],
        durationSeconds: 1800,
      );
      await attemptRepository.saveAnswer(
        attemptId: attempt.attemptId,
        questionId: 'mock-question-101',
        selectedOption: 'B',
      );

      final reopenedRepository = TestDataMockTestAttemptRepository(
        testRepository: testRepository,
        currentUserId: () => userId,
        localDataSource: ExamAttemptLocalDataSource(),
        questionBankDataSource: const TestDataMockTestQuestionBankDataSource(),
      );
      final session = await reopenedRepository.getAttemptSession(
        attempt.attemptId,
      );

      expect(session.answers['mock-question-101'], 'B');
      expect(session.questions.length, 30);
    },
  );

  test(
    'restores submitted Attempt, History and result after reopening',
    () async {
      final attempt = await attemptRepository.startPartAttempt(
        testId: testId,
        parts: [5],
        durationSeconds: 1800,
      );
      await attemptRepository.saveAnswer(
        attemptId: attempt.attemptId,
        questionId: 'mock-question-101',
        selectedOption: 'B',
      );
      final originalSubmission = await attemptRepository.submitAttempt(
        attempt.attemptId,
      );

      final reopenedRepository = TestDataMockTestAttemptRepository(
        testRepository: testRepository,
        currentUserId: () => userId,
        localDataSource: ExamAttemptLocalDataSource(),
        questionBankDataSource: const TestDataMockTestQuestionBankDataSource(),
      );
      final restoredAttempt = await reopenedRepository.getAttempt(
        attempt.attemptId,
      );
      final restoredSubmission = await reopenedRepository.getSubmission(
        attempt.attemptId,
      );
      final history = await reopenedRepository.getAttemptHistory();

      expect(restoredAttempt.status, TestAttemptStatus.submitted);
      expect(restoredSubmission, isNotNull);
      expect(restoredSubmission!.totalQuestions, 30);
      expect(
        restoredSubmission.answeredCount,
        originalSubmission.answeredCount,
      );
      expect(restoredSubmission.correctCount, originalSubmission.correctCount);
      expect(history.total, 1);
      expect(history.items.single.attemptId, attempt.attemptId);
    },
  );

  test('isolates Test Data Attempts by account', () async {
    final attempt = await attemptRepository.startPartAttempt(
      testId: testId,
      parts: [5],
      durationSeconds: 1800,
    );

    final otherUserRepository = TestDataMockTestAttemptRepository(
      testRepository: testRepository,
      currentUserId: () => 'mock-test-user-002',
      localDataSource: ExamAttemptLocalDataSource(),
      questionBankDataSource: const TestDataMockTestQuestionBankDataSource(),
    );
    await expectLater(
      otherUserRepository.getAttempt(attempt.attemptId),
      throwsA(isA<StateError>()),
    );
  });
}
