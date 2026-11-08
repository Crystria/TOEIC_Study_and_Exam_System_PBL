import 'dart:math';

import '../mock_data/mock_test_taking_mock_data.dart';
import '../mock_data/mock_test_score_reference.dart';
import '../models/mock_test_submission.dart';
import '../models/test_attempt.dart';
import '../models/test_attempt_session.dart';
import '../models/test_history_item.dart';
import 'mock_test_repository.dart';

/// In-memory implementation used until the Exam Service is connected.
/// It keeps attempt snapshots, answers, and submission data for the current app session.
class MockTestAttemptRepository {
  MockTestAttemptRepository({required MockTestRepository testRepository})
    : _testRepository = testRepository;

  final MockTestRepository _testRepository;
  final Map<String, TestAttempt> _attempts = {};
  final Map<String, Map<String, String>> _draftAnswers = {};
  final Map<String, MockTestSubmission> _submissions = {};
  late final MockTestQuestionBank _questionBank =
      MockTestTakingMockData.buildBank();

  static const int fullDurationSeconds = 7200;
  static const int minPartDurationSeconds = 300;
  static const int maxPartDurationSeconds = 10800;
  static const List<int> fullParts = [1, 2, 3, 4, 5, 6, 7];

  Future<TestAttempt> startFullAttempt(String testId) async {
    final test = await _testRepository.getTest(testId);
    final structure = await _testRepository.getTestParts(testId);
    final questionCount = structure.fold<int>(
      0,
      (total, part) => total + part.totalQuestions,
    );
    final expectedCounts = MockTestTakingMockData.expectedQuestionCounts;
    final structurePartNumbers = structure.map((part) => part.part).toSet();
    final hasCorrectPartCounts =
        structure.length == expectedCounts.length &&
        structurePartNumbers.length == expectedCounts.length &&
        expectedCounts.keys.every(
          (part) => structure.any(
            (item) =>
                item.part == part &&
                item.totalQuestions == expectedCounts[part],
          ),
        );

    if (test.totalQuestions != 200 ||
        test.durationSeconds != fullDurationSeconds ||
        structure.length != fullParts.length ||
        structure.any((part) => !part.available) ||
        questionCount != 200 ||
        !hasCorrectPartCounts) {
      throw StateError(
        'Cấu trúc đề thi không đáp ứng quy tắc FULL TOEIC 200 câu.',
      );
    }

    return _createAttempt(
      testId: testId,
      mode: TestAttemptMode.full,
      parts: fullParts,
      durationSeconds: fullDurationSeconds,
    );
  }

  Future<TestAttempt> startPartAttempt({
    required String testId,
    required List<int> parts,
    required int durationSeconds,
  }) async {
    await _testRepository.getTest(testId);

    if (parts.isEmpty) {
      throw ArgumentError('Vui lòng chọn ít nhất một Part.');
    }
    if (parts.toSet().length != parts.length ||
        parts.any((part) => !fullParts.contains(part))) {
      throw ArgumentError('Danh sách Part không hợp lệ.');
    }
    if (durationSeconds < minPartDurationSeconds ||
        durationSeconds > maxPartDurationSeconds) {
      throw ArgumentError('Thời lượng PART phải từ 5 phút đến 3 giờ.');
    }

    final structure = await _testRepository.getTestParts(testId);
    final availableParts = structure
        .where((part) => part.available)
        .map((part) => part.part)
        .toSet();
    if (parts.any((part) => !availableParts.contains(part))) {
      throw ArgumentError('Có Part không khả dụng trong đề thi này.');
    }

    return _createAttempt(
      testId: testId,
      mode: TestAttemptMode.part,
      parts: parts,
      durationSeconds: durationSeconds,
    );
  }

  Future<TestAttempt> getAttempt(String attemptId) async {
    var attempt = _attempts[attemptId];
    if (attempt == null) {
      throw StateError('Không tìm thấy phiên thi.');
    }

    // An Attempt remains governed by its absolute deadline even while the
    // user is outside the Taking screen. Reconcile it whenever it is read.
    if (attempt.status == TestAttemptStatus.inProgress &&
        !DateTime.now().isBefore(attempt.deadlineAt)) {
      await submitAttempt(attemptId, expired: true);
      attempt = _attempts[attemptId]!;
    }

    return attempt;
  }

  Future<MockTestSubmission?> getSubmission(String attemptId) async {
    return _submissions[attemptId];
  }

  /// Returns Attempts ordered newest-first. The mock implementation mirrors
  /// the Exam Service's 1-based page and maximum page-size contract.
  Future<TestHistoryPage> getAttemptHistory({
    int page = 1,
    int size = 20,
    String? testId,
    TestAttemptMode? mode,
  }) async {
    if (page < 1) {
      throw ArgumentError.value(page, 'page', 'Phải lớn hơn hoặc bằng 1.');
    }
    if (size < 1 || size > 50) {
      throw ArgumentError.value(size, 'size', 'Phải nằm trong khoảng 1–50.');
    }

    // Reconcile expired sessions before building the list so History does
    // not keep presenting an overdue Attempt as IN_PROGRESS.
    final attemptIds = _attempts.keys.toList(growable: false);
    for (final attemptId in attemptIds) {
      await getAttempt(attemptId);
    }

    final matchingAttempts =
        _attempts.values.where((attempt) {
          if (testId != null && attempt.testId != testId) return false;
          if (mode != null && attempt.mode != mode) return false;
          return true;
        }).toList()..sort((a, b) {
          final timeComparison = b.startedAt.compareTo(a.startedAt);
          return timeComparison != 0
              ? timeComparison
              : b.attemptId.compareTo(a.attemptId);
        });

    final total = matchingAttempts.length;
    final start = (page - 1) * size;
    final end = (start + size).clamp(0, total).toInt();
    final pageAttempts = start >= total
        ? const <TestAttempt>[]
        : matchingAttempts.sublist(start, end);

    final items = <TestHistoryItem>[];
    for (final attempt in pageAttempts) {
      final test = await _testRepository.getTest(attempt.testId);
      final submission = _submissions[attempt.attemptId];
      final attemptQuestionCount = attempt.parts.fold<int>(
        0,
        (total, part) =>
            total + (MockTestTakingMockData.expectedQuestionCounts[part] ?? 0),
      );
      items.add(
        TestHistoryItem(
          attemptId: attempt.attemptId,
          testId: attempt.testId,
          testTitle: test.title,
          mode: attempt.mode,
          status: attempt.status,
          parts: List<int>.unmodifiable(attempt.parts),
          durationSeconds: attempt.durationSeconds,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
          score: attempt.mode == TestAttemptMode.full
              ? submission?.totalScore
              : null,
          scoreListening: attempt.mode == TestAttemptMode.full
              ? submission?.listeningScore
              : null,
          scoreReading: attempt.mode == TestAttemptMode.full
              ? submission?.readingScore
              : null,
          accuracy: submission?.accuracy,
          correctCount: submission?.correctCount,
          totalQuestions: submission?.totalQuestions ?? attemptQuestionCount,
        ),
      );
    }

    return TestHistoryPage(
      items: List<TestHistoryItem>.unmodifiable(items),
      total: total,
      page: page,
      size: size,
      totalPages: total == 0 ? 0 : (total + size - 1) ~/ size,
    );
  }

  Future<TestAttemptSession> getAttemptSession(String attemptId) async {
    final attempt = await getAttempt(attemptId);
    if (attempt.status != TestAttemptStatus.inProgress) {
      throw StateError('Phiên thi này đã được nộp hoặc hết hạn.');
    }

    final test = await _testRepository.getTest(attempt.testId);
    final selectedParts = attempt.parts.toSet();
    final selectedSeeds = _questionBank.questions
        .where((seed) => selectedParts.contains(seed.question.part))
        .toList(growable: false);
    final expectedTotal = attempt.parts.fold<int>(
      0,
      (total, part) =>
          total + (MockTestTakingMockData.expectedQuestionCounts[part] ?? 0),
    );
    if (selectedSeeds.length != expectedTotal) {
      throw StateError('Ngân hàng câu hỏi mẫu không khớp cấu trúc phiên thi.');
    }

    final questions = selectedSeeds
        .map((seed) => seed.question)
        .toList(growable: false);
    final groupIds = questions
        .map((question) => question.groupId)
        .whereType<String>()
        .toSet();
    final groups = _questionBank.groups
        .where((group) => groupIds.contains(group.groupId))
        .toList(growable: false);

    return TestAttemptSession(
      attemptId: attempt.attemptId,
      testId: attempt.testId,
      testTitle: test.title,
      mode: attempt.mode,
      parts: List.unmodifiable(attempt.parts),
      durationSeconds: attempt.durationSeconds,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      questions: List.unmodifiable(questions),
      groups: List.unmodifiable(groups),
      answers: Map<String, String>.unmodifiable(
        _draftAnswers[attemptId] ?? const <String, String>{},
      ),
    );
  }

  Future<void> saveAnswer({
    required String attemptId,
    required String questionId,
    required String? selectedOption,
  }) async {
    final attempt = await getAttempt(attemptId);
    if (attempt.status != TestAttemptStatus.inProgress) {
      throw StateError('Không thể thay đổi đáp án của phiên thi đã kết thúc.');
    }
    MockTestQuestionSeed? seed;
    for (final item in _questionBank.questions) {
      if (item.question.questionId == questionId) {
        seed = item;
        break;
      }
    }
    if (seed == null || !attempt.parts.contains(seed.question.part)) {
      throw StateError('Câu hỏi không thuộc phiên thi hiện tại.');
    }
    if (selectedOption != null &&
        !seed.question.options.any(
          (option) => option.optionCode == selectedOption,
        )) {
      throw ArgumentError('Mã đáp án không hợp lệ.');
    }

    final answers = _draftAnswers.putIfAbsent(attemptId, () => {});
    if (selectedOption == null) {
      answers.remove(questionId);
    } else {
      answers[questionId] = selectedOption;
    }
  }

  Future<MockTestSubmission> submitAttempt(
    String attemptId, {
    bool expired = false,
  }) async {
    final existingSubmission = _submissions[attemptId];
    if (existingSubmission != null) return existingSubmission;

    // Read the stored record directly here: getAttempt() may itself trigger
    // expiry finalization, which would recurse back into submitAttempt().
    final attempt = _attempts[attemptId];
    if (attempt == null) {
      throw StateError('Không tìm thấy phiên thi.');
    }
    if (attempt.status != TestAttemptStatus.inProgress) {
      throw StateError('Phiên thi không còn ở trạng thái làm bài.');
    }

    final wasExpired = expired || !DateTime.now().isBefore(attempt.deadlineAt);

    final test = await _testRepository.getTest(attempt.testId);
    final selectedParts = attempt.parts.toSet();
    final selectedSeeds = _questionBank.questions
        .where((seed) => selectedParts.contains(seed.question.part))
        .toList(growable: false);
    final answers = _draftAnswers[attemptId] ?? const <String, String>{};
    final partStats = <MockTestPartSubmission>[];
    var answeredCount = 0;
    var correctCount = 0;

    for (final part in attempt.parts) {
      final partSeeds = selectedSeeds
          .where((seed) => seed.question.part == part)
          .toList(growable: false);
      var partAnswered = 0;
      var partCorrect = 0;
      for (final seed in partSeeds) {
        final selected = answers[seed.question.questionId];
        if (selected != null) {
          partAnswered++;
          if (selected == seed.correctOption) partCorrect++;
        }
      }
      answeredCount += partAnswered;
      correctCount += partCorrect;
      partStats.add(
        MockTestPartSubmission(
          part: part,
          answeredCount: partAnswered,
          correctCount: partCorrect,
          totalQuestions: partSeeds.length,
        ),
      );
    }

    final totalQuestions = selectedSeeds.length;
    final listeningCorrectCount = partStats
        .where((stat) => stat.isListening)
        .fold<int>(0, (total, stat) => total + stat.correctCount);
    final readingCorrectCount = partStats
        .where((stat) => !stat.isListening)
        .fold<int>(0, (total, stat) => total + stat.correctCount);
    final isFull = attempt.mode == TestAttemptMode.full;
    final listeningScore = isFull
        ? MockTestScoreReference.listeningScore(listeningCorrectCount)
        : null;
    final readingScore = isFull
        ? MockTestScoreReference.readingScore(readingCorrectCount)
        : null;

    final questionReviews = selectedSeeds
        .map(
          (seed) => MockTestQuestionReview(
            question: seed.question,
            correctOption: seed.correctOption,
            selectedOption: answers[seed.question.questionId],
            explanation: seed.explanation,
          ),
        )
        .toList(growable: false);
    final usedGroupIds = questionReviews
        .map((review) => review.question.groupId)
        .whereType<String>()
        .toSet();
    final resultGroups = _questionBank.groups
        .where((group) => usedGroupIds.contains(group.groupId))
        .toList(growable: false);
    final submittedAt = DateTime.now();

    final submission = MockTestSubmission(
      attemptId: attemptId,
      testId: attempt.testId,
      testTitle: test.title,
      mode: attempt.mode,
      parts: List.unmodifiable(attempt.parts),
      answeredCount: answeredCount,
      correctCount: correctCount,
      totalQuestions: totalQuestions,
      submittedAt: submittedAt,
      expired: wasExpired,
      partStats: List.unmodifiable(partStats),
      questionReviews: List.unmodifiable(questionReviews),
      groups: List.unmodifiable(resultGroups),
      listeningCorrectCount: isFull ? listeningCorrectCount : null,
      readingCorrectCount: isFull ? readingCorrectCount : null,
      listeningScore: listeningScore,
      readingScore: readingScore,
      scoreDisclaimer: isFull ? MockTestScoreReference.disclaimer : null,
      scoreTableVersion: isFull ? MockTestScoreReference.version : null,
      scoreOfficial: isFull ? MockTestScoreReference.official : null,
    );

    _submissions[attemptId] = submission;
    _attempts[attemptId] = attempt.copyWith(
      status: wasExpired
          ? TestAttemptStatus.expired
          : TestAttemptStatus.submitted,
      completedAt: submittedAt,
    );
    return submission;
  }

  Future<TestAttempt> _createAttempt({
    required String testId,
    required TestAttemptMode mode,
    required List<int> parts,
    required int durationSeconds,
  }) async {
    final attempt = TestAttempt(
      attemptId: _newUuidV4(),
      testId: testId,
      mode: mode,
      parts: List<int>.unmodifiable(parts),
      durationSeconds: durationSeconds,
      status: TestAttemptStatus.inProgress,
      startedAt: DateTime.now(),
    );
    _attempts[attempt.attemptId] = attempt;
    _draftAnswers[attempt.attemptId] = {};
    return attempt;
  }

  String _newUuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20, 32)}';
  }
}
