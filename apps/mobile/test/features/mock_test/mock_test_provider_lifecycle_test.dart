import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/mock_test/data_sources/test_data/mock_test_test_data_source.dart';
import 'package:toeic_mobile/features/mock_test/data_sources/local/exam_attempt_local_data_source.dart';
import 'package:toeic_mobile/features/mock_test/data_sources/test_data/test_data_mock_test_question_bank_data_source.dart';
import 'package:toeic_mobile/features/mock_test/models/mock_test.dart';
import 'package:toeic_mobile/features/mock_test/models/test_part.dart';
import 'package:toeic_mobile/features/mock_test/models/test_attempt.dart';
import 'package:toeic_mobile/features/mock_test/models/test_history_item.dart';
import 'package:toeic_mobile/features/mock_test/providers/mock_test_select_provider.dart';
import 'package:toeic_mobile/features/mock_test/providers/mock_test_taking_provider.dart';
import 'package:toeic_mobile/features/mock_test/providers/select_test_parts_provider.dart';
import 'package:toeic_mobile/features/mock_test/providers/test_history_detail_provider.dart';
import 'package:toeic_mobile/features/mock_test/providers/test_history_provider.dart';
import 'package:toeic_mobile/features/mock_test/repositories/mock_test_repository.dart';
import 'package:toeic_mobile/features/mock_test/repositories/test_data_mock_test_repository.dart';
import 'package:toeic_mobile/features/mock_test/repositories/test_data_mock_test_attempt_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Mock Test Providers clear state when the active user changes', () {
    final testRepository = TestDataMockTestRepository(
      testDataSource: MockTestTestDataSource(),
    );
    final attemptRepository = TestDataMockTestAttemptRepository(
      testRepository: testRepository,
      currentUserId: () => 'scope-reset-user',
      localDataSource: ExamAttemptLocalDataSource(),
      questionBankDataSource: const TestDataMockTestQuestionBankDataSource(),
    );
    final selectProvider = MockTestSelectProvider(repository: testRepository);
    final partsProvider = SelectTestPartsProvider(
      testRepository: testRepository,
      attemptRepository: attemptRepository,
    );
    final historyProvider = TestHistoryProvider(repository: attemptRepository);
    final detailProvider = TestHistoryDetailProvider(
      attemptRepository: attemptRepository,
      testRepository: testRepository,
    );
    final takingProvider = MockTestTakingProvider(
      repository: attemptRepository,
    );
    addTearDown(selectProvider.dispose);
    addTearDown(partsProvider.dispose);
    addTearDown(historyProvider.dispose);
    addTearDown(detailProvider.dispose);
    addTearDown(takingProvider.dispose);

    selectProvider.changeFilter(TestFilter.fullTest);
    selectProvider.resetForUserScopeChange();
    partsProvider.resetForUserScopeChange();
    historyProvider.resetForUserScopeChange();
    detailProvider.resetForUserScopeChange();
    takingProvider.resetForUserScopeChange();

    expect(selectProvider.status, TestSelectStatus.idle);
    expect(selectProvider.filter, TestFilter.all);
    expect(selectProvider.tests, isEmpty);
    expect(partsProvider.status, SelectPartsStatus.idle);
    expect(partsProvider.test, isNull);
    expect(historyProvider.status, TestHistoryStatus.idle);
    expect(historyProvider.items, isEmpty);
    expect(detailProvider.status, TestHistoryDetailStatus.idle);
    expect(detailProvider.attempt, isNull);
    expect(takingProvider.status, TakingStatus.idle);
    expect(takingProvider.session, isNull);
  });

  test(
    'does not notify listeners after MockTestSelectProvider is disposed',
    () async {
      final repository = _PendingMockTestRepository();
      final provider = MockTestSelectProvider(repository: repository);
      var notifications = 0;
      provider.addListener(() => notifications++);

      final pendingLoad = provider.loadTests();
      expect(notifications, 1);
      provider.dispose();
      repository.tests.complete(const <MockTest>[]);

      await expectLater(pendingLoad, completes);
      expect(notifications, 1);
    },
  );

  test(
    'does not apply structure after SelectTestPartsProvider is disposed',
    () async {
      final repository = _PendingStructureMockTestRepository();
      final attemptRepository = TestDataMockTestAttemptRepository(
        testRepository: repository,
        currentUserId: () => 'lifecycle-user',
        localDataSource: ExamAttemptLocalDataSource(),
        questionBankDataSource: const TestDataMockTestQuestionBankDataSource(),
      );
      final provider = SelectTestPartsProvider(
        testRepository: repository,
        attemptRepository: attemptRepository,
      );
      var notifications = 0;
      provider.addListener(() => notifications++);

      final pendingLoad = provider.loadStructure('test-id');
      expect(notifications, 1);
      provider.dispose();
      repository.testCompleter.complete(_test());
      repository.partsCompleter.complete(const <TestPart>[]);

      await expectLater(pendingLoad, completes);
      expect(notifications, 1);
      expect(provider.test, isNull);
      expect(provider.parts, isEmpty);
    },
  );

  test('does not notify after TestHistoryProvider is disposed', () async {
    final testRepository = TestDataMockTestRepository(
      testDataSource: MockTestTestDataSource(),
    );
    final attemptRepository = _PendingHistoryAttemptRepository(
      testRepository: testRepository,
    );
    final provider = TestHistoryProvider(repository: attemptRepository);
    var notifications = 0;
    provider.addListener(() => notifications++);

    final pendingLoad = provider.loadHistory();
    expect(notifications, 1);
    provider.dispose();
    attemptRepository.historyCompleter.complete(
      const TestHistoryPage(
        items: <TestHistoryItem>[],
        total: 0,
        page: 1,
        size: 20,
        totalPages: 0,
      ),
    );

    await expectLater(pendingLoad, completes);
    expect(notifications, 1);
  });

  test(
    'does not load a test after TestHistoryDetailProvider is disposed',
    () async {
      final testRepository = _PendingStructureMockTestRepository();
      final attemptRepository = _PendingHistoryAttemptRepository(
        testRepository: testRepository,
      );
      final provider = TestHistoryDetailProvider(
        attemptRepository: attemptRepository,
        testRepository: testRepository,
      );
      var notifications = 0;
      provider.addListener(() => notifications++);

      final pendingLoad = provider.loadDetail('attempt-id');
      expect(notifications, 1);
      provider.dispose();
      attemptRepository.attemptCompleter.complete(_attempt());

      await expectLater(pendingLoad, completes);
      expect(notifications, 1);
      expect(testRepository.testCompleter.isCompleted, isFalse);
    },
  );
}

MockTest _test() => MockTest(
  testId: 'test-id',
  title: 'Lifecycle fixture',
  durationSeconds: 7200,
  createdAt: DateTime.utc(2026, 1, 1),
  totalQuestions: 200,
);

class _PendingMockTestRepository extends TestDataMockTestRepository {
  _PendingMockTestRepository()
    : super(testDataSource: MockTestTestDataSource());

  final Completer<List<MockTest>> tests = Completer<List<MockTest>>();

  @override
  Future<List<MockTest>> getTests() => tests.future;
}

class _PendingStructureMockTestRepository extends TestDataMockTestRepository {
  _PendingStructureMockTestRepository()
    : super(testDataSource: MockTestTestDataSource());

  final Completer<MockTest> testCompleter = Completer<MockTest>();
  final Completer<List<TestPart>> partsCompleter = Completer<List<TestPart>>();

  @override
  Future<MockTest> getTest(String testId) => testCompleter.future;

  @override
  Future<List<TestPart>> getTestParts(String testId) => partsCompleter.future;
}

class _PendingHistoryAttemptRepository
    extends TestDataMockTestAttemptRepository {
  _PendingHistoryAttemptRepository({required MockTestRepository testRepository})
    : super(
        testRepository: testRepository,
        currentUserId: () => 'history-user',
        localDataSource: ExamAttemptLocalDataSource(),
        questionBankDataSource: const TestDataMockTestQuestionBankDataSource(),
      );

  final Completer<TestHistoryPage> historyCompleter =
      Completer<TestHistoryPage>();
  final Completer<TestAttempt> attemptCompleter = Completer<TestAttempt>();

  @override
  Future<TestHistoryPage> getAttemptHistory({
    int page = 1,
    int size = 20,
    String? testId,
    TestAttemptMode? mode,
  }) => historyCompleter.future;

  @override
  Future<TestAttempt> getAttempt(String attemptId) => attemptCompleter.future;
}

TestAttempt _attempt() => TestAttempt(
  attemptId: 'attempt-id',
  testId: 'test-id',
  mode: TestAttemptMode.full,
  parts: const [1, 2, 3, 4, 5, 6, 7],
  durationSeconds: 7200,
  status: TestAttemptStatus.submitted,
  startedAt: DateTime.utc(2026, 1, 1),
  completedAt: DateTime.utc(2026, 1, 1, 2),
);
