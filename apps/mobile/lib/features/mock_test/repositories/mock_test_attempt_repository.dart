// ignore_for_file: prefer_initializing_formals
import 'dart:async';
import 'dart:math';

import '../../../core/errors/app_exception.dart';
import '../models/exam_api_dtos.dart';
import '../services/exam_api_service.dart';
import 'exam_attempt_local_store.dart';
import 'exam_attempt_start_journal.dart';

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
  MockTestAttemptRepository({
    required MockTestRepository testRepository,
    ExamApiService? api,
    String? Function()? currentUserId,
    ExamAttemptStartJournal? startJournal,
    ExamAttemptLocalStore? localStore,
  }) : _testRepository = testRepository,
       _api = api,
       _currentUserId = currentUserId,
       _startJournal = startJournal ?? ExamAttemptStartJournal(),
       _localStore = localStore ?? ExamAttemptLocalStore();

  final MockTestRepository _testRepository;
  ExamApiService? _api;
  String? Function()? _currentUserId;
  final ExamAttemptStartJournal _startJournal;
  final ExamAttemptLocalStore _localStore;
  final Map<String, Map<String, String>> _apiDraftAnswers = {};
  final Map<String, ExamAttemptDto> _apiAttemptSnapshots = {};
  final Map<String, MockTestSubmission> _apiSubmissions = {};
  final Map<String, Future<void>> _attemptWriteQueues = {};

  bool get usesBackend => _api != null;

  void configureApi({
    required ExamApiService? api,
    String? Function()? currentUserId,
  }) {
    _api = api;
    _currentUserId = currentUserId;
    resetForUserScopeChange();
  }

  final Map<String, TestAttempt> _attempts = {};
  final Map<String, Map<String, String>> _draftAnswers = {};
  final Map<String, MockTestSubmission> _submissions = {};
  int _scopeRevision = 0;
  late final MockTestQuestionBank _questionBank =
      MockTestTakingMockData.buildBank();

  static const int fullDurationSeconds = 7200;
  static const int minPartDurationSeconds = 300;
  static const int maxPartDurationSeconds = 10800;
  static const List<int> fullParts = [1, 2, 3, 4, 5, 6, 7];

  /// Drops in-memory attempts, drafts and results when the account changes.
  /// The public test catalogue remains untouched.
  void resetForUserScopeChange() {
    _scopeRevision++;
    _attempts.clear();
    _draftAnswers.clear();
    _submissions.clear();
    _apiDraftAnswers.clear();
    _apiAttemptSnapshots.clear();
    _apiSubmissions.clear();
    _attemptWriteQueues.clear();
  }

  void _ensureScope(int revision) {
    if (revision != _scopeRevision) {
      throw StateError('Tài khoản đã thay đổi trong lúc xử lý bài thi.');
    }
  }

  Future<TestAttempt> startFullAttempt(String testId) async {
    if (_api != null) return _startApiFullAttempt(testId);

    final revision = _scopeRevision;
    final test = await _testRepository.getTest(testId);
    _ensureScope(revision);
    final structure = await _testRepository.getTestParts(testId);
    _ensureScope(revision);
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
    if (_api != null) {
      return _startApiPartAttempt(
        testId: testId,
        parts: parts,
        durationSeconds: durationSeconds,
      );
    }

    final revision = _scopeRevision;
    await _testRepository.getTest(testId);
    _ensureScope(revision);

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
    _ensureScope(revision);
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
    if (_api != null) {
      final scope = _captureApiScope();
      final dto = await _loadApiAttempt(attemptId, scope);
      if (dto.isFinal && !dto.readOnlySnapshot) {
        final submission = dto.toSubmission();
        _apiSubmissions[attemptId] = submission;
      }
      return dto.toAttempt();
    }

    final revision = _scopeRevision;
    var attempt = _attempts[attemptId];
    if (attempt == null) {
      throw StateError('Không tìm thấy phiên thi.');
    }

    // An Attempt remains governed by its absolute deadline even while the
    // user is outside the Taking screen. Reconcile it whenever it is read.
    if (attempt.status == TestAttemptStatus.inProgress &&
        !DateTime.now().isBefore(attempt.deadlineAt)) {
      await submitAttempt(attemptId, expired: true);
      _ensureScope(revision);
      attempt = _attempts[attemptId]!;
    }

    return attempt;
  }

  Future<MockTestSubmission?> getSubmission(String attemptId) async {
    if (_api != null) {
      final cached = _apiSubmissions[attemptId];
      if (cached != null) return cached;
      final scope = _captureApiScope();
      final dto = await _loadApiAttempt(attemptId, scope);
      if (!dto.isFinal || dto.readOnlySnapshot) return null;
      final submission = dto.toSubmission();
      _apiSubmissions[attemptId] = submission;
      return submission;
    }
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
    if (_api != null) {
      if (page < 1 || size < 1 || size > 50) {
        throw ArgumentError('Lịch sử yêu cầu page >= 1 và size từ 1 đến 50.');
      }
      final scope = _captureApiScope();
      final raw = await _api!.getAttemptHistory(
        page: page,
        size: size,
        testId: testId,
        mode: mode == null
            ? null
            : (mode == TestAttemptMode.full ? 'FULL' : 'PART'),
      );
      _ensureApiScope(scope);
      return ExamHistoryPageDto.fromObject(raw).page;
    }

    final revision = _scopeRevision;
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
      _ensureScope(revision);
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
      _ensureScope(revision);
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
          deadlineAt: attempt.deadlineAt,
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
    if (_api != null) {
      final scope = _captureApiScope();
      final dto = await _loadApiAttempt(attemptId, scope);
      if (dto.readOnlySnapshot) {
        throw StateError(
          'Lượt thi lịch sử này chỉ hỗ trợ xem thông tin, không có snapshot để tiếp tục làm bài.',
        );
      }
      if (dto.status != TestAttemptStatus.inProgress) {
        if (dto.isFinal) _apiSubmissions[attemptId] = dto.toSubmission();
        throw StateError('Phiên thi này đã được nộp hoặc hết hạn.');
      }

      final localAnswers = await _localStore.loadUnsyncedAnswers(
        userId: scope.userId,
        attemptId: attemptId,
      );
      _ensureApiScope(scope);

      final merged = Map<String, String>.from(dto.answers);
      for (final entry in localAnswers.entries) {
        if (entry.value.selectedOption == null) {
          merged.remove(entry.key);
        } else {
          merged[entry.key] = entry.value.selectedOption!;
        }
      }
      _apiDraftAnswers[attemptId] = Map<String, String>.from(merged);
      return dto.toSession(mergedAnswers: merged);
    }

    final revision = _scopeRevision;
    final attempt = await getAttempt(attemptId);
    _ensureScope(revision);
    if (attempt.status != TestAttemptStatus.inProgress) {
      throw StateError('Phiên thi này đã được nộp hoặc hết hạn.');
    }

    final test = await _testRepository.getTest(attempt.testId);
    _ensureScope(revision);
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
    if (_api != null) {
      final scope = _captureApiScope();
      final snapshot =
          _apiAttemptSnapshots[attemptId] ??
          await _loadApiAttempt(attemptId, scope);
      _ensureApiScope(scope);
      if (snapshot.status != TestAttemptStatus.inProgress) {
        throw StateError(
          'Không thể thay đổi đáp án của phiên thi đã kết thúc.',
        );
      }
      final questionSnapshot = snapshot.questions.where(
        (item) => item.question.questionId == questionId,
      );
      if (questionSnapshot.isEmpty ||
          (selectedOption != null &&
              !questionSnapshot.first.question.options.any(
                (option) => option.optionCode == selectedOption,
              ))) {
        throw ArgumentError(
          'Câu hỏi hoặc mã đáp án không thuộc Attempt hiện tại.',
        );
      }

      await _localStore.saveAnswer(
        userId: scope.userId,
        attemptId: attemptId,
        questionId: questionId,
        selectedOption: selectedOption,
      );
      _ensureApiScope(scope);

      final currentAnswers = _apiDraftAnswers.putIfAbsent(
        attemptId,
        () => <String, String>{},
      );
      if (selectedOption == null) {
        currentAnswers.remove(questionId);
      } else {
        currentAnswers[questionId] = selectedOption;
      }

      final api = _api!;
      await _enqueueAttemptWrite(
        scope: scope,
        attemptId: attemptId,
        operation: () async {
          await api.saveAnswer(
            attemptId: attemptId,
            questionId: questionId,
            selectedOption: selectedOption,
          );
          await _localStore.markAnswerSynced(
            userId: scope.userId,
            attemptId: attemptId,
            questionId: questionId,
            expectedSelectedOption: selectedOption,
          );
        },
      );
      return;
    }

    final revision = _scopeRevision;
    final attempt = await getAttempt(attemptId);
    _ensureScope(revision);
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

  /// Synchronizes the current full draft before the app moves to background.
  /// The service contract accepts a bounded list of up to 200 snapshot answers.
  Future<void> saveDraft({
    required String attemptId,
    required Map<String, String> answers,
  }) async {
    if (_api == null) return;
    final scope = _captureApiScope();
    final snapshot =
        _apiAttemptSnapshots[attemptId] ??
        await _loadApiAttempt(attemptId, scope);
    _ensureApiScope(scope);
    if (snapshot.status != TestAttemptStatus.inProgress) return;

    final completeDraft = <String, String?>{
      for (final question in snapshot.questions)
        question.question.questionId: answers[question.question.questionId],
    };

    // Every per-question PUT, batch draft and final submit shares one queue
    // per Attempt. This preserves invocation order even if the app resumes
    // while a background draft request is still running.
    final api = _api!;
    await _enqueueAttemptWrite(
      scope: scope,
      attemptId: attemptId,
      operation: () async {
        await api.saveDraft(attemptId: attemptId, answers: completeDraft);

        final pending = await _localStore.loadUnsyncedAnswers(
          userId: scope.userId,
          attemptId: attemptId,
        );
        final snapshotQuestionIds = snapshot.questions
            .map((question) => question.question.questionId)
            .toSet();
        for (final entry in pending.entries) {
          if (!snapshotQuestionIds.contains(entry.key) ||
              completeDraft[entry.key] != entry.value.selectedOption) {
            continue;
          }
          await _localStore.markAnswerSynced(
            userId: scope.userId,
            attemptId: attemptId,
            questionId: entry.key,
            expectedSelectedOption: entry.value.selectedOption,
          );
        }
      },
    );
  }

  Future<MockTestSubmission> submitAttempt(
    String attemptId, {
    bool expired = false,
    Map<String, String>? answers,
  }) async {
    if (_api != null) {
      final scope = _captureApiScope();
      final api = _api!;
      late MockTestSubmission submitted;

      await _enqueueAttemptWrite(
        scope: scope,
        attemptId: attemptId,
        operation: () async {
          final merged = Map<String, String?>.from(
            _apiDraftAnswers[attemptId] ?? const <String, String>{},
          );
          final local = await _localStore.loadUnsyncedAnswers(
            userId: scope.userId,
            attemptId: attemptId,
          );
          _ensureApiScope(scope);
          for (final entry in local.entries) {
            merged[entry.key] = entry.value.selectedOption;
          }
          if (answers != null) {
            for (final entry in answers.entries) {
              merged[entry.key] = entry.value;
            }
          }

          final raw = await api.submitAttempt(
            attemptId: attemptId,
            answers: merged,
          );
          final dto = ExamAttemptDto.fromObject(raw);
          if (!dto.isFinal) {
            throw const FormatException(
              'Exam API chưa xác nhận trạng thái đã nộp.',
            );
          }
          submitted = dto.toSubmission();
          _apiAttemptSnapshots[attemptId] = dto;
          _apiSubmissions[attemptId] = submitted;
          _apiDraftAnswers.remove(attemptId);

          // Submission is already authoritative. Failure to clear a stale local
          // cache must not turn a successful server submission into a failure.
          try {
            await _localStore.clearAttempt(
              userId: scope.userId,
              attemptId: attemptId,
            );
          } catch (_) {
            // The finalized server Attempt will not be reopened by History.
          }
        },
      );
      _ensureApiScope(scope);
      return submitted;
    }

    final revision = _scopeRevision;
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
    _ensureScope(revision);
    final selectedParts = attempt.parts.toSet();
    final selectedSeeds = _questionBank.questions
        .where((seed) => selectedParts.contains(seed.question.part))
        .toList(growable: false);
    final draftAnswers = _draftAnswers[attemptId] ?? <String, String>{};
    if (answers != null) {
      draftAnswers
        ..clear()
        ..addAll(answers);
    }
    final effectiveAnswers = draftAnswers;
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
        final selected = effectiveAnswers[seed.question.questionId];
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
            selectedOption: effectiveAnswers[seed.question.questionId],
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

    _ensureScope(revision);
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

  Future<void> _enqueueAttemptWrite({
    required _ExamApiScope scope,
    required String attemptId,
    required Future<void> Function() operation,
  }) async {
    final previous = _attemptWriteQueues[attemptId];
    final next = (previous ?? Future<void>.value()).catchError((_) {}).then((
      _,
    ) async {
      _ensureApiScope(scope);
      await operation();
      _ensureApiScope(scope);
    });

    _attemptWriteQueues[attemptId] = next;

    try {
      await next;
    } finally {
      if (identical(_attemptWriteQueues[attemptId], next)) {
        _attemptWriteQueues.remove(attemptId);
      }
    }
  }

  Future<TestAttempt> _startApiFullAttempt(String testId) async {
    final api = _api!;
    final scope = _captureApiScope();
    final test = await _testRepository.getTest(testId);
    _ensureApiScope(scope);
    final structure = await _testRepository.getTestParts(testId);
    _ensureApiScope(scope);

    final questionCount = structure.fold<int>(
      0,
      (sum, part) => sum + part.totalQuestions,
    );
    final expectedCounts = MockTestTakingMockData.expectedQuestionCounts;
    final validParts =
        structure.length == 7 &&
        structure.every((part) => part.available) &&
        expectedCounts.entries.every(
          (entry) => structure.any(
            (part) =>
                part.part == entry.key && part.totalQuestions == entry.value,
          ),
        );

    if (test.totalQuestions != 200 ||
        test.durationSeconds != fullDurationSeconds ||
        questionCount != 200 ||
        !validParts) {
      throw StateError(
        'Cấu trúc đề thi không đáp ứng quy tắc FULL TOEIC 200 câu.',
      );
    }

    const parts = fullParts;
    final fingerprint = _startFingerprint(
      testId: testId,
      mode: TestAttemptMode.full,
      parts: parts,
      durationSeconds: fullDurationSeconds,
    );
    final key = await _startJournal.getOrCreate(
      userId: scope.userId,
      fingerprint: fingerprint,
    );
    _ensureApiScope(scope);

    final raw = await api.startFullAttempt(testId: testId, idempotencyKey: key);
    _ensureApiScope(scope);
    final dto = ExamAttemptDto.fromObject(raw);
    _validateStartedAttempt(
      dto,
      expectedTestId: testId,
      expectedMode: TestAttemptMode.full,
      expectedParts: parts,
      expectedDuration: fullDurationSeconds,
    );
    _apiAttemptSnapshots[dto.attemptId] = dto;
    _apiDraftAnswers[dto.attemptId] = Map<String, String>.from(dto.answers);
    if (dto.isFinal && !dto.readOnlySnapshot) {
      _apiSubmissions[dto.attemptId] = dto.toSubmission();
    }

    // If removal fails, a later identical Start reuses the same idempotency key
    // and the Backend returns the existing Attempt instead of duplicating it.
    try {
      await _startJournal.remove(
        userId: scope.userId,
        fingerprint: fingerprint,
        idempotencyKey: key,
      );
    } catch (_) {}
    _ensureApiScope(scope);
    return dto.toAttempt();
  }

  Future<TestAttempt> _startApiPartAttempt({
    required String testId,
    required List<int> parts,
    required int durationSeconds,
  }) async {
    final api = _api!;
    final scope = _captureApiScope();
    await _testRepository.getTest(testId);
    _ensureApiScope(scope);

    if (parts.isEmpty ||
        parts.toSet().length != parts.length ||
        parts.any((part) => !fullParts.contains(part))) {
      throw ArgumentError('Danh sách Part không hợp lệ.');
    }
    if (durationSeconds < minPartDurationSeconds ||
        durationSeconds > maxPartDurationSeconds) {
      throw ArgumentError('Thời lượng PART phải từ 5 phút đến 3 giờ.');
    }

    final structure = await _testRepository.getTestParts(testId);
    _ensureApiScope(scope);
    final available = structure
        .where((part) => part.available)
        .map((part) => part.part)
        .toSet();
    if (parts.any((part) => !available.contains(part))) {
      throw ArgumentError('Có Part không khả dụng trong đề thi này.');
    }

    final orderedParts = List<int>.from(parts)..sort();
    final fingerprint = _startFingerprint(
      testId: testId,
      mode: TestAttemptMode.part,
      parts: orderedParts,
      durationSeconds: durationSeconds,
    );
    final key = await _startJournal.getOrCreate(
      userId: scope.userId,
      fingerprint: fingerprint,
    );
    _ensureApiScope(scope);

    final raw = await api.startPartAttempt(
      testId: testId,
      parts: orderedParts,
      durationSeconds: durationSeconds,
      idempotencyKey: key,
    );
    _ensureApiScope(scope);
    final dto = ExamAttemptDto.fromObject(raw);
    _validateStartedAttempt(
      dto,
      expectedTestId: testId,
      expectedMode: TestAttemptMode.part,
      expectedParts: orderedParts,
      expectedDuration: durationSeconds,
    );
    final expectedCountsByPart = <int, int>{
      for (final part in structure)
        if (orderedParts.contains(part.part)) part.part: part.totalQuestions,
    };
    for (final entry in expectedCountsByPart.entries) {
      final actualCount = dto.questions
          .where((item) => item.question.part == entry.key)
          .length;
      if (actualCount != entry.value) {
        throw const FormatException(
          'PART attempt snapshot không khớp số câu của cấu trúc đề thi.',
        );
      }
    }
    _apiAttemptSnapshots[dto.attemptId] = dto;
    _apiDraftAnswers[dto.attemptId] = Map<String, String>.from(dto.answers);
    if (dto.isFinal && !dto.readOnlySnapshot) {
      _apiSubmissions[dto.attemptId] = dto.toSubmission();
    }

    try {
      await _startJournal.remove(
        userId: scope.userId,
        fingerprint: fingerprint,
        idempotencyKey: key,
      );
    } catch (_) {}
    _ensureApiScope(scope);
    return dto.toAttempt();
  }

  void _validateStartedAttempt(
    ExamAttemptDto dto, {
    required String expectedTestId,
    required TestAttemptMode expectedMode,
    required List<int> expectedParts,
    required int expectedDuration,
  }) {
    final actualParts = List<int>.from(dto.parts)..sort();
    final expected = List<int>.from(expectedParts)..sort();
    if (dto.testId != expectedTestId ||
        dto.mode != expectedMode ||
        dto.durationSeconds != expectedDuration ||
        actualParts.length != expected.length ||
        !List.generate(
          expected.length,
          (index) => actualParts[index] == expected[index],
        ).every((value) => value)) {
      throw const FormatException(
        'Attempt được tạo không khớp lựa chọn đã gửi.',
      );
    }
    if (dto.questions.length != dto.totalQuestions) {
      throw const FormatException('Attempt snapshot không đủ câu hỏi.');
    }
    if (expectedMode == TestAttemptMode.full) {
      final counts = <int, int>{};
      for (final question in dto.questions) {
        counts.update(
          question.question.part,
          (value) => value + 1,
          ifAbsent: () => 1,
        );
      }
      final expectedCounts = MockTestTakingMockData.expectedQuestionCounts;
      if (dto.totalQuestions != 200 ||
          expectedCounts.entries.any(
            (entry) => counts[entry.key] != entry.value,
          )) {
        throw const FormatException(
          'FULL attempt snapshot không đúng phân bổ 200 câu.',
        );
      }
    }
  }

  String _startFingerprint({
    required String testId,
    required TestAttemptMode mode,
    required List<int> parts,
    required int durationSeconds,
  }) => '$testId|${mode.name}|${parts.join(',')}|$durationSeconds';

  Future<ExamAttemptDto> _loadApiAttempt(
    String attemptId,
    _ExamApiScope scope,
  ) async {
    // Do not return a cached active snapshot: deadline and draft must be read
    // from Backend each time an Attempt is reopened or checked in History.
    final raw = await _api!.getAttempt(attemptId);
    _ensureApiScope(scope);
    final dto = ExamAttemptDto.fromObject(raw);
    if (dto.attemptId != attemptId) {
      throw const FormatException('Backend trả về attemptId không khớp.');
    }
    _apiAttemptSnapshots[attemptId] = dto;
    if (dto.isFinal && !dto.readOnlySnapshot) {
      _apiSubmissions[attemptId] = dto.toSubmission();
    }
    return dto;
  }

  _ExamApiScope _captureApiScope() {
    final userId = _currentUserId?.call()?.trim();
    if (userId == null || userId.isEmpty) {
      throw const AppException.unauthorized(
        message: 'Bạn cần đăng nhập để sử dụng chức năng thi thử.',
      );
    }
    return _ExamApiScope(userId: userId, revision: _scopeRevision);
  }

  void _ensureApiScope(_ExamApiScope scope) {
    if (scope.revision != _scopeRevision ||
        _currentUserId?.call()?.trim() != scope.userId) {
      throw const AppException.cancelled(
        message: 'Thao tác thi thử đã bị hủy do tài khoản thay đổi.',
      );
    }
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

class _ExamApiScope {
  const _ExamApiScope({required this.userId, required this.revision});

  final String userId;
  final int revision;
}
