import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/mock_test/models/mock_test.dart';
import 'package:toeic_mobile/features/mock_test/models/test_part.dart';
import 'package:toeic_mobile/features/mock_test/models/test_attempt.dart';
import 'package:toeic_mobile/features/mock_test/models/test_history_item.dart';
import 'package:toeic_mobile/features/mock_test/providers/mock_test_select_provider.dart';
import 'package:toeic_mobile/features/mock_test/providers/select_test_parts_provider.dart';
import 'package:toeic_mobile/features/mock_test/providers/test_history_detail_provider.dart';
import 'package:toeic_mobile/features/mock_test/providers/test_history_provider.dart';
import 'package:toeic_mobile/features/mock_test/repositories/mock_test_attempt_repository.dart';
import 'package:toeic_mobile/features/mock_test/repositories/mock_test_repository.dart';

void main() {
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
      final attemptRepository = MockTestAttemptRepository(
        testRepository: repository,
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
    final testRepository = MockTestRepository();
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

class _PendingMockTestRepository extends MockTestRepository {
  final Completer<List<MockTest>> tests = Completer<List<MockTest>>();

  @override
  Future<List<MockTest>> getTests() => tests.future;
}

class _PendingStructureMockTestRepository extends MockTestRepository {
  final Completer<MockTest> testCompleter = Completer<MockTest>();
  final Completer<List<TestPart>> partsCompleter = Completer<List<TestPart>>();

  @override
  Future<MockTest> getTest(String testId) => testCompleter.future;

  @override
  Future<List<TestPart>> getTestParts(String testId) => partsCompleter.future;
}

class _PendingHistoryAttemptRepository extends MockTestAttemptRepository {
  _PendingHistoryAttemptRepository({required super.testRepository});

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
