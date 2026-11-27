import 'mock_test.dart';
import 'mock_test_submission.dart';
import 'test_attempt.dart';
import 'test_attempt_group.dart';
import 'test_attempt_question.dart';
import 'test_attempt_session.dart';
import 'test_history_item.dart';
import 'test_part.dart';

Map<String, dynamic> examJsonMap(Object? value, {required String context}) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  throw FormatException('$context phải là JSON object.');
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('Trường $key bị thiếu hoặc không hợp lệ.');
  }
  return value.trim();
}

String _requiredText(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String) {
    throw FormatException('Trường $key phải là chuỗi.');
  }
  return value;
}

String? _optionalString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value == null) return null;
  if (value is! String) throw FormatException('Trường $key phải là chuỗi.');
  final normalized = value.trim();
  return normalized.isEmpty ? null : normalized;
}

int _requiredInt(Object? value, String field) {
  if (value is int) return value;
  if (value is double && value.isFinite && value == value.roundToDouble()) {
    return value.toInt();
  }
  throw FormatException('Trường $field phải là số nguyên.');
}

int? _optionalInt(Object? value, String field) {
  if (value == null) return null;
  return _requiredInt(value, field);
}

double? _optionalDouble(Object? value, String field) {
  if (value == null) return null;
  if (value is num && value.isFinite) return value.toDouble();
  throw FormatException('Trường $field phải là số.');
}

bool? _optionalBool(Object? value, String field) {
  if (value == null) return null;
  if (value is bool) return value;
  throw FormatException('Trường $field phải là boolean.');
}

DateTime _requiredDate(Object? value, String field) {
  if (value is! String)
    throw FormatException('Trường $field phải là ISO date.');
  final result = DateTime.tryParse(value);
  if (result == null)
    throw FormatException('Trường $field không phải date hợp lệ.');
  return result.toUtc();
}

DateTime? _optionalDate(Object? value, String field) {
  if (value == null) return null;
  return _requiredDate(value, field);
}

String _uuid(Map<String, dynamic> json, String key) {
  final value = _requiredString(json, key);
  if (!RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
  ).hasMatch(value)) {
    throw FormatException('Trường $key không phải UUID hợp lệ.');
  }
  return value;
}

class ExamPageDto<T> {
  const ExamPageDto({
    required this.items,
    required this.total,
    required this.page,
    required this.size,
    required this.totalPages,
  });

  final List<T> items;
  final int total;
  final int page;
  final int size;
  final int totalPages;

  factory ExamPageDto.fromObject(
    Object? value, {
    required T Function(Object? item) parseItem,
  }) {
    final json = examJsonMap(value, context: 'Exam pagination');
    final rawItems = json['items'];
    if (rawItems is! List) {
      throw const FormatException('Danh sách items từ Exam API không hợp lệ.');
    }
    final page = _requiredInt(json['page'], 'page');
    final size = _requiredInt(json['size'], 'size');
    final total = _requiredInt(json['total'], 'total');
    final totalPages = _requiredInt(json['totalPages'], 'totalPages');
    if (page < 1 || size < 1 || size > 50 || total < 0 || totalPages < 0) {
      throw const FormatException('Metadata phân trang Exam API không hợp lệ.');
    }
    final expectedPages = total == 0 ? 0 : (total / size).ceil();
    if (rawItems.length > size ||
        totalPages != expectedPages ||
        page > (totalPages == 0 ? 1 : totalPages)) {
      throw const FormatException('Metadata phân trang Exam API không hợp lệ.');
    }
    return ExamPageDto<T>(
      items: rawItems.map(parseItem).toList(growable: false),
      total: total,
      page: page,
      size: size,
      totalPages: totalPages,
    );
  }
}

class ExamTestDto {
  const ExamTestDto({
    required this.testId,
    required this.title,
    required this.durationSeconds,
    required this.createdAt,
    required this.totalQuestions,
  });

  final String testId;
  final String title;
  final int durationSeconds;
  final DateTime createdAt;
  final int totalQuestions;

  factory ExamTestDto.fromObject(Object? value) {
    final json = examJsonMap(value, context: 'Exam test');
    final rawQuestions = json['questions'];
    final totalQuestions =
        json['totalQuestions'] ??
        (rawQuestions is List ? rawQuestions.length : null);
    return ExamTestDto(
      testId: _uuid(json, 'testId'),
      title: _requiredString(json, 'title'),
      durationSeconds: _requiredInt(json['durationSeconds'], 'durationSeconds'),
      createdAt: _requiredDate(json['createdAt'], 'createdAt'),
      totalQuestions: _requiredInt(totalQuestions, 'totalQuestions'),
    );
  }

  MockTest toDomain() => MockTest(
    testId: testId,
    title: title,
    durationSeconds: durationSeconds,
    createdAt: createdAt,
    totalQuestions: totalQuestions,
  );
}

class ExamTestPartsDto {
  const ExamTestPartsDto({required this.testId, required this.parts});

  final String testId;
  final List<TestPart> parts;

  factory ExamTestPartsDto.fromObject(Object? value) {
    final json = examJsonMap(value, context: 'Exam test parts');
    final testId = _uuid(json, 'testId');
    final rawParts = json['parts'];
    if (rawParts is! List || rawParts.length != 7) {
      throw const FormatException('Exam API phải trả đủ 7 Part.');
    }

    final parts = <TestPart>[];
    final seen = <int>{};
    for (final raw in rawParts) {
      final item = examJsonMap(raw, context: 'Exam Part');
      final part = _requiredInt(item['part'], 'part');
      if (part < 1 || part > 7 || !seen.add(part)) {
        throw const FormatException(
          'Cấu trúc Part bị trùng hoặc không hợp lệ.',
        );
      }
      final rawErrors = item['errors'];
      if (rawErrors != null && rawErrors is! List) {
        throw const FormatException('Part errors phải là danh sách.');
      }
      final errors = (rawErrors as List? ?? const []);
      if (errors.any((error) => error is! String)) {
        throw const FormatException(
          'Part errors chứa giá trị không phải chuỗi.',
        );
      }
      final available = item['available'];
      if (available is! bool) {
        throw const FormatException('Part available phải là boolean.');
      }
      final totalQuestions = _requiredInt(
        item['totalQuestions'],
        'totalQuestions',
      );
      final groupCount = _requiredInt(item['groupCount'], 'groupCount');
      if (totalQuestions < 0 || groupCount < 0) {
        throw const FormatException('Part count không được âm.');
      }
      parts.add(
        TestPart(
          part: part,
          title: 'Part $part',
          totalQuestions: totalQuestions,
          groupCount: groupCount,
          available: available,
          errors: List<String>.unmodifiable(errors.cast<String>()),
        ),
      );
    }
    parts.sort((a, b) => a.part.compareTo(b.part));
    return ExamTestPartsDto(testId: testId, parts: List.unmodifiable(parts));
  }
}

class ExamAttemptDto {
  const ExamAttemptDto({
    required this.attemptId,
    required this.testId,
    required this.testTitle,
    required this.mode,
    required this.status,
    required this.startedAt,
    required this.deadlineAt,
    required this.durationSeconds,
    required this.serverTime,
    required this.remainingSeconds,
    required this.parts,
    required this.groups,
    required this.questions,
    required this.answers,
    required this.totalQuestions,
    required this.readOnlySnapshot,
    this.submittedAt,
    this.completedAt,
    this.score,
    this.totalScore,
    this.scoreListening,
    this.scoreReading,
    this.correctCount,
    this.accuracy,
    this.correctListeningCount,
    this.correctReadingCount,
    this.scoreDisclaimer,
    this.scoreTableVersion,
    this.scoreOfficial,
    this.partStats = const [],
  });

  final String attemptId;
  final String testId;
  final String testTitle;
  final TestAttemptMode mode;
  final TestAttemptStatus status;
  final DateTime startedAt;
  final DateTime deadlineAt;
  final int durationSeconds;
  final DateTime serverTime;
  final int remainingSeconds;
  final List<int> parts;
  final List<TestAttemptGroup> groups;
  final List<ExamQuestionSnapshotDto> questions;
  final Map<String, String> answers;
  final int totalQuestions;
  final bool readOnlySnapshot;
  final DateTime? submittedAt;
  final DateTime? completedAt;
  final int? score;
  final int? totalScore;
  final int? scoreListening;
  final int? scoreReading;
  final int? correctCount;
  final double? accuracy;
  final int? correctListeningCount;
  final int? correctReadingCount;
  final String? scoreDisclaimer;
  final String? scoreTableVersion;
  final bool? scoreOfficial;
  final List<MockTestPartSubmission> partStats;

  bool get isFinal => status != TestAttemptStatus.inProgress;

  factory ExamAttemptDto.fromObject(Object? value) {
    final json = examJsonMap(value, context: 'Exam attempt');
    final modeValue = _requiredString(json, 'mode').toUpperCase();
    final mode = switch (modeValue) {
      'FULL' => TestAttemptMode.full,
      'PART' => TestAttemptMode.part,
      _ => throw const FormatException('Attempt mode không hợp lệ.'),
    };
    final statusValue = _requiredString(json, 'status').toUpperCase();
    final status = switch (statusValue) {
      'IN_PROGRESS' => TestAttemptStatus.inProgress,
      'SUBMITTED' => TestAttemptStatus.submitted,
      'EXPIRED' => TestAttemptStatus.expired,
      _ => throw const FormatException('Attempt status không hợp lệ.'),
    };

    final readOnlySnapshot =
        _optionalBool(json['readOnly'], 'readOnly') ?? false;
    final rawParts = json['parts'];
    if (rawParts is! List || (!readOnlySnapshot && rawParts.isEmpty)) {
      throw const FormatException('Attempt phải có ít nhất một Part.');
    }
    final parts = rawParts
        .map((value) => _requiredInt(value, 'parts[]'))
        .toList();
    if (parts.toSet().length != parts.length ||
        parts.any((part) => part < 1 || part > 7)) {
      throw const FormatException('Attempt parts không hợp lệ.');
    }

    final rawGroups = json['groups'];
    final rawQuestions = json['questions'];
    final rawAnswers = json['answers'];
    if (rawGroups is! List || rawQuestions is! List || rawAnswers is! List) {
      throw const FormatException(
        'Attempt snapshot bị thiếu groups/questions/answers.',
      );
    }

    final groups = rawGroups.map(_parseGroup).toList(growable: false);
    final questions = rawQuestions.map(_parseQuestion).toList(growable: false);
    if (questions.isEmpty && !readOnlySnapshot) {
      throw const FormatException('Attempt không có câu hỏi snapshot.');
    }

    questions.sort((a, b) {
      final partOrder = a.question.part.compareTo(b.question.part);
      return partOrder != 0
          ? partOrder
          : a.question.orderNo.compareTo(b.question.orderNo);
    });

    final questionIds = questions
        .map((item) => item.question.questionId)
        .toSet();
    final groupById = {for (final group in groups) group.groupId: group};
    if (questionIds.length != questions.length ||
        questions.any(
          (item) =>
              !parts.contains(item.question.part) ||
              (item.question.groupId != null &&
                  (groupById[item.question.groupId] == null ||
                      groupById[item.question.groupId]!.part !=
                          item.question.part)),
        )) {
      throw const FormatException('Câu hỏi snapshot không khớp Attempt.');
    }

    final answers = <String, String>{};
    for (final raw in rawAnswers) {
      if (readOnlySnapshot) continue;
      final answer = examJsonMap(raw, context: 'Attempt answer');
      final questionId = _uuid(answer, 'questionId');
      if (!questionIds.contains(questionId)) {
        throw const FormatException(
          'Attempt answer chứa questionId ngoài snapshot.',
        );
      }
      final selected = answer['selectedOption'];
      if (selected == null) continue;
      if (selected is! String ||
          !const ['A', 'B', 'C', 'D'].contains(selected)) {
        throw const FormatException('selectedOption của Attempt không hợp lệ.');
      }
      answers[questionId] = selected;
    }

    final totalQuestions = json['totalQuestions'] == null && readOnlySnapshot
        ? 0
        : _requiredInt(json['totalQuestions'], 'totalQuestions');
    final durationSeconds = _requiredInt(
      json['durationSeconds'],
      'durationSeconds',
    );
    final remainingSeconds = _requiredInt(
      json['remainingSeconds'],
      'remainingSeconds',
    );
    if ((!readOnlySnapshot && totalQuestions < 1) ||
        totalQuestions < 0 ||
        durationSeconds < 1 ||
        remainingSeconds < 0 ||
        remainingSeconds > durationSeconds) {
      throw const FormatException('Attempt duration/count không hợp lệ.');
    }
    if (!readOnlySnapshot && totalQuestions != questions.length) {
      throw const FormatException(
        'totalQuestions không khớp question snapshot.',
      );
    }
    if (!readOnlySnapshot &&
        mode == TestAttemptMode.full &&
        (parts.length != 7 ||
            totalQuestions != 200 ||
            !const [1, 2, 3, 4, 5, 6, 7].every((p) => parts.contains(p)))) {
      throw const FormatException('FULL attempt phải có đủ 200 câu và 7 Part.');
    }

    final scoring = json['scoring'] == null
        ? null
        : examJsonMap(json['scoring'], context: 'Attempt scoring');
    final rawStats = json['partStats'];
    final rawStatsList = rawStats is List ? rawStats : const <Object?>[];
    final partStats = rawStatsList
        .map((raw) {
          final stat = examJsonMap(raw, context: 'Attempt part statistic');
          return MockTestPartSubmission(
            part: _requiredInt(stat['part'], 'part'),
            answeredCount: 0,
            correctCount:
                _optionalInt(stat['correctCount'], 'correctCount') ?? 0,
            totalQuestions: _requiredInt(
              stat['totalQuestions'],
              'totalQuestions',
            ),
          );
        })
        .toList(growable: false);

    return ExamAttemptDto(
      attemptId: _uuid(json, 'attemptId'),
      testId: _uuid(json, 'testId'),
      testTitle: _requiredString(json, 'testTitle'),
      mode: mode,
      status: status,
      startedAt: _requiredDate(json['startedAt'], 'startedAt'),
      deadlineAt: _requiredDate(
        json['deadlineAt'] ?? json['deadline'],
        'deadlineAt',
      ),
      durationSeconds: durationSeconds,
      serverTime: _requiredDate(json['serverTime'], 'serverTime'),
      remainingSeconds: remainingSeconds,
      parts: List.unmodifiable(parts),
      groups: List.unmodifiable(groups),
      questions: List.unmodifiable(questions),
      answers: Map.unmodifiable(answers),
      totalQuestions: totalQuestions,
      readOnlySnapshot: readOnlySnapshot,
      submittedAt: _optionalDate(json['submittedAt'], 'submittedAt'),
      completedAt: _optionalDate(json['completedAt'], 'completedAt'),
      score: _optionalInt(json['score'], 'score'),
      totalScore: _optionalInt(json['totalScore'], 'totalScore'),
      scoreListening: _optionalInt(json['scoreListening'], 'scoreListening'),
      scoreReading: _optionalInt(json['scoreReading'], 'scoreReading'),
      correctCount: _optionalInt(json['correctCount'], 'correctCount'),
      accuracy: _optionalDouble(json['accuracy'], 'accuracy'),
      correctListeningCount: _optionalInt(
        json['correctListeningCount'],
        'correctListeningCount',
      ),
      correctReadingCount: _optionalInt(
        json['correctReadingCount'],
        'correctReadingCount',
      ),
      scoreDisclaimer: _optionalString(json, 'scoreDisclaimer'),
      scoreTableVersion: _optionalString(
        scoring ?? <String, dynamic>{},
        'tableVersion',
      ),
      scoreOfficial: _optionalBool(scoring?['official'], 'scoring.official'),
      partStats: List.unmodifiable(partStats),
    );
  }

  TestAttempt toAttempt() => TestAttempt(
    attemptId: attemptId,
    testId: testId,
    mode: mode,
    parts: parts,
    durationSeconds: durationSeconds,
    status: status,
    startedAt: startedAt,
    completedAt: completedAt ?? submittedAt,
    deadlineAtOverride: deadlineAt,
    readOnlySnapshot: readOnlySnapshot,
  );

  TestAttemptSession toSession({required Map<String, String> mergedAnswers}) {
    if (status != TestAttemptStatus.inProgress) {
      throw StateError('Attempt đã kết thúc, không thể tạo session làm bài.');
    }
    return TestAttemptSession(
      attemptId: attemptId,
      testId: testId,
      testTitle: testTitle,
      mode: mode,
      parts: parts,
      durationSeconds: durationSeconds,
      startedAt: startedAt,
      deadlineAt: deadlineAt,
      questions: questions.map((item) => item.question).toList(growable: false),
      groups: groups,
      answers: Map.unmodifiable(mergedAnswers),
      remainingSecondsAtSnapshot: remainingSeconds,
      serverTime: serverTime,
    );
  }

  MockTestSubmission toSubmission() {
    if (!isFinal) throw StateError('Attempt chưa được nộp.');
    if (readOnlySnapshot) {
      throw StateError(
        'Attempt lịch sử không có question snapshot để tạo phần giải thích.',
      );
    }

    // Correctness is verified against the server answer key in the final
    // question snapshot. The live DTO never exposes this field before submit.
    for (final item in questions) {
      if (item.correctOption == null) {
        throw const FormatException('Final attempt thiếu correctOption.');
      }
    }

    final reviews = questions
        .map((item) {
          final question = item.question;
          return MockTestQuestionReview(
            question: question,
            correctOption: item.correctOption!,
            selectedOption: answers[question.questionId],
            explanation: item.explanation,
          );
        })
        .toList(growable: false);

    final answeredCount = answers.length;
    final computedCorrect = reviews.where((review) => review.isCorrect).length;
    final correct = correctCount ?? computedCorrect;
    final stats = partStats.isEmpty
        ? _derivePartStats(reviews)
        : partStats
              .map((item) {
                final answered = reviews
                    .where(
                      (review) =>
                          review.question.part == item.part &&
                          review.isAnswered,
                    )
                    .length;
                return MockTestPartSubmission(
                  part: item.part,
                  answeredCount: answered,
                  correctCount: item.correctCount,
                  totalQuestions: item.totalQuestions,
                );
              })
              .toList(growable: false);

    final listeningCorrect =
        correctListeningCount ??
        reviews
            .where((review) => review.question.part <= 4 && review.isCorrect)
            .length;
    final readingCorrect =
        correctReadingCount ??
        reviews
            .where((review) => review.question.part >= 5 && review.isCorrect)
            .length;

    return MockTestSubmission(
      attemptId: attemptId,
      testId: testId,
      testTitle: testTitle,
      mode: mode,
      parts: parts,
      answeredCount: answeredCount,
      correctCount: correct,
      totalQuestions: totalQuestions,
      submittedAt: completedAt ?? submittedAt ?? serverTime,
      expired: status == TestAttemptStatus.expired,
      partStats: List.unmodifiable(stats),
      questionReviews: List.unmodifiable(reviews),
      groups: groups,
      listeningCorrectCount: mode == TestAttemptMode.full
          ? listeningCorrect
          : null,
      readingCorrectCount: mode == TestAttemptMode.full ? readingCorrect : null,
      listeningScore: mode == TestAttemptMode.full ? scoreListening : null,
      readingScore: mode == TestAttemptMode.full ? scoreReading : null,
      scoreDisclaimer: mode == TestAttemptMode.full ? scoreDisclaimer : null,
      scoreTableVersion: mode == TestAttemptMode.full
          ? scoreTableVersion
          : null,
      scoreOfficial: mode == TestAttemptMode.full ? scoreOfficial : null,
    );
  }

  List<MockTestPartSubmission> _derivePartStats(
    List<MockTestQuestionReview> reviews,
  ) {
    return parts
        .map((part) {
          final items = reviews.where((review) => review.question.part == part);
          final values = items.toList(growable: false);
          return MockTestPartSubmission(
            part: part,
            answeredCount: values.where((review) => review.isAnswered).length,
            correctCount: values.where((review) => review.isCorrect).length,
            totalQuestions: values.length,
          );
        })
        .toList(growable: false);
  }
}

class ExamQuestionSnapshotDto {
  const ExamQuestionSnapshotDto({
    required this.question,
    this.correctOption,
    this.explanation,
  });

  final TestAttemptQuestion question;
  final String? correctOption;
  final String? explanation;
}

TestAttemptGroup _parseGroup(Object? value) {
  final json = examJsonMap(value, context: 'Attempt group');
  final rawAssets = json['assets'];
  if (rawAssets != null && rawAssets is! List) {
    throw const FormatException('Group assets phải là danh sách.');
  }
  final assets = (rawAssets as List? ?? const [])
      .map((raw) {
        final asset = examJsonMap(raw, context: 'Attempt group asset');
        return TestAttemptGroupAsset(
          assetId: _requiredString(asset, 'assetId'),
          kind: _requiredString(asset, 'kind'),
          orderNo: _requiredInt(asset['orderNo'], 'orderNo'),
          content: _optionalString(asset, 'content'),
          publicUrl: _optionalString(asset, 'publicUrl'),
        );
      })
      .toList(growable: false);

  return TestAttemptGroup(
    groupId: _uuid(json, 'groupId'),
    part: _requiredInt(json['part'], 'part'),
    orderNo: _requiredInt(json['orderNo'], 'orderNo'),
    type: _requiredString(json, 'type'),
    instruction: _optionalString(json, 'instruction'),
    audioUrl: _optionalString(json, 'audioUrl'),
    transcript: _optionalString(json, 'transcript'),
    passageText: _optionalString(json, 'passageText'),
    assets: List.unmodifiable(assets),
  );
}

ExamQuestionSnapshotDto _parseQuestion(Object? value) {
  final json = examJsonMap(value, context: 'Attempt question');
  final rawOptions = json['options'];
  if (rawOptions is! List || rawOptions.isEmpty) {
    throw const FormatException('Question options bị thiếu.');
  }
  final options = rawOptions
      .map((raw) {
        final option = examJsonMap(raw, context: 'Question option');
        final code = _requiredString(option, 'optionCode');
        if (!const ['A', 'B', 'C', 'D'].contains(code)) {
          throw const FormatException('Question optionCode không hợp lệ.');
        }
        return TestAttemptOption(
          optionCode: code,
          optionText: _requiredText(option, 'optionText'),
        );
      })
      .toList(growable: false);
  if (options.map((item) => item.optionCode).toSet().length != options.length) {
    throw const FormatException('Question có optionCode trùng.');
  }

  final groupIdRaw = json['groupId'];
  if (groupIdRaw != null && groupIdRaw is! String) {
    throw const FormatException('Question groupId không hợp lệ.');
  }
  final groupId = groupIdRaw == null
      ? null
      : _uuid({'groupId': groupIdRaw}, 'groupId');
  final positionInGroup = _optionalInt(
    json['positionInGroup'],
    'positionInGroup',
  );
  final correctOption = _optionalString(json, 'correctOption');
  if (correctOption != null &&
      !options.any((item) => item.optionCode == correctOption)) {
    throw const FormatException('correctOption không tồn tại trong options.');
  }

  return ExamQuestionSnapshotDto(
    question: TestAttemptQuestion(
      questionId: _uuid(json, 'questionId'),
      part: _requiredInt(json['part'], 'part'),
      orderNo: _requiredInt(json['orderNo'], 'orderNo'),
      type: _requiredString(json, 'type'),
      questionText: _requiredText(json, 'questionText'),
      options: List.unmodifiable(options),
      groupId: groupId,
      positionInGroup: positionInGroup,
      audioUrl: _optionalString(json, 'audioUrl'),
      imageUrl: _optionalString(json, 'imageUrl'),
      imageDescription: _optionalString(json, 'imageDescription'),
      transcript: _optionalString(json, 'transcript'),
    ),
    correctOption: correctOption,
    explanation: _optionalString(json, 'explanation'),
  );
}

class ExamHistoryPageDto {
  const ExamHistoryPageDto({required this.page, required this.totalPages});

  final TestHistoryPage page;
  final int totalPages;

  factory ExamHistoryPageDto.fromObject(Object? value) {
    final page = ExamPageDto<TestHistoryItem>.fromObject(
      value,
      parseItem: (raw) {
        final json = examJsonMap(raw, context: 'Attempt history item');
        final mode = _requiredString(json, 'mode').toUpperCase();
        final status = _requiredString(json, 'status').toUpperCase();
        return TestHistoryItem(
          attemptId: _uuid(json, 'attemptId'),
          testId: _uuid(json, 'testId'),
          testTitle: _requiredString(json, 'testTitle'),
          mode: switch (mode) {
            'FULL' => TestAttemptMode.full,
            'PART' => TestAttemptMode.part,
            _ => throw const FormatException('History mode không hợp lệ.'),
          },
          status: switch (status) {
            'IN_PROGRESS' => TestAttemptStatus.inProgress,
            'SUBMITTED' => TestAttemptStatus.submitted,
            'EXPIRED' => TestAttemptStatus.expired,
            _ => throw const FormatException('History status không hợp lệ.'),
          },
          parts: (json['parts'] as List? ?? const [])
              .map((item) => _requiredInt(item, 'parts[]'))
              .toList(growable: false),
          durationSeconds: _requiredInt(
            json['durationSeconds'],
            'durationSeconds',
          ),
          startedAt: _requiredDate(json['startedAt'], 'startedAt'),
          completedAt: _optionalDate(json['completedAt'], 'completedAt'),
          score: _optionalInt(json['score'], 'score'),
          scoreListening: _optionalInt(
            json['scoreListening'],
            'scoreListening',
          ),
          scoreReading: _optionalInt(json['scoreReading'], 'scoreReading'),
          accuracy: _optionalDouble(json['accuracy'], 'accuracy'),
          correctCount: _optionalInt(json['correctCount'], 'correctCount'),
          totalQuestions: _optionalInt(
            json['totalQuestions'],
            'totalQuestions',
          ),
          deadlineAt: _optionalDate(json['deadlineAt'], 'deadlineAt'),
        );
      },
    );
    return ExamHistoryPageDto(
      page: TestHistoryPage(
        items: page.items,
        total: page.total,
        page: page.page,
        size: page.size,
        totalPages: page.totalPages,
      ),
      totalPages: page.totalPages,
    );
  }
}
