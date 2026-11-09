import 'analytics_models.dart';

Map<String, dynamic> analyticsJsonMap(Object? value, {required String context}) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  throw FormatException('$context phải là JSON object.');
}

int _requiredInt(Object? value, String field) {
  if (value is int) return value;
  if (value is double && value.isFinite && value == value.roundToDouble()) {
    return value.toInt();
  }
  throw FormatException('Trường $field phải là số nguyên.');
}

int? _optionalInt(Object? value, String field) =>
    value == null ? null : _requiredInt(value, field);

double _requiredDouble(Object? value, String field) {
  if (value is num && value.isFinite) return value.toDouble();
  throw FormatException('Trường $field phải là số.');
}

double? _optionalDouble(Object? value, String field) =>
    value == null ? null : _requiredDouble(value, field);

String _requiredString(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('Trường $field bị thiếu hoặc không hợp lệ.');
  }
  return value.trim();
}

String? _optionalString(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value == null) return null;
  if (value is! String) throw FormatException('Trường $field phải là chuỗi.');
  return value.trim().isEmpty ? null : value.trim();
}

DateTime _requiredDate(Object? value, String field) {
  if (value is! String) throw FormatException('Trường $field phải là ISO date.');
  final date = DateTime.tryParse(value);
  if (date == null) throw FormatException('Trường $field không phải date hợp lệ.');
  return date.toUtc();
}

DateTime? _optionalDate(Object? value, String field) =>
    value == null ? null : _requiredDate(value, field);

bool _optionalBool(Object? value, String field, {bool defaultValue = false}) {
  if (value == null) return defaultValue;
  if (value is bool) return value;
  throw FormatException('Trường $field phải là boolean.');
}

AnalyticsCounters _counters(Object? value, String label) {
  final json = analyticsJsonMap(value, context: label);
  return AnalyticsCounters(
    vocabulariesLearned: _requiredInt(json['vocabulariesLearned'], 'vocabulariesLearned'),
    reviewCount: _requiredInt(json['reviewCount'], 'reviewCount'),
    grammarLessonsCompleted: _requiredInt(
      json['grammarLessonsCompleted'],
      'grammarLessonsCompleted',
    ),
    mockTestCount: _requiredInt(json['mockTestCount'], 'mockTestCount'),
    practiceCount: _requiredInt(json['practiceCount'], 'practiceCount'),
    studyDays: _requiredInt(json['studyDays'], 'studyDays'),
  );
}

AnalyticsScoreTrendPoint _scoreTrendPoint(Object? value) {
  final json = analyticsJsonMap(value, context: 'Analytics score trend item');
  final scoring = json['scoring'];
  return AnalyticsScoreTrendPoint(
    attemptId: _requiredString(json, 'attemptId'),
    completedAt: _requiredDate(json['completedAt'], 'completedAt'),
    scoreListening: _requiredInt(json['scoreListening'], 'scoreListening'),
    scoreReading: _requiredInt(json['scoreReading'], 'scoreReading'),
    totalScore: _requiredInt(json['totalScore'], 'totalScore'),
    scoring: scoring == null
        ? null
        : analyticsJsonMap(scoring, context: 'Analytics scoring'),
  );
}

AnalyticsWeakArea _weakArea(Object? value) {
  final json = analyticsJsonMap(value, context: 'Analytics weak area');
  final status = _requiredString(json, 'status');
  if (status != 'AVAILABLE' && status != 'INSUFFICIENT_DATA') {
    throw const FormatException('Trạng thái weak area không hợp lệ.');
  }
  final part = _requiredInt(json['part'], 'part');
  final correct = _requiredInt(json['correct'], 'correct');
  final total = _requiredInt(json['total'], 'total');
  if (part < 1 || part > 7 || correct < 0 || total < correct) {
    throw const FormatException('Số liệu weak area không hợp lệ.');
  }
  final weaknessScore = _optionalDouble(json['weaknessScore'], 'weaknessScore');
  if (weaknessScore != null && (weaknessScore < 0 || weaknessScore > 1)) {
    throw const FormatException('weaknessScore phải nằm trong khoảng 0–1.');
  }
  return AnalyticsWeakArea(
    part: part,
    status: status,
    correct: correct,
    total: total,
    weaknessScore: weaknessScore,
    isWeak: json['isWeak'] == null
        ? null
        : _optionalBool(json['isWeak'], 'isWeak'),
    calculatedAt: _optionalDate(json['calculatedAt'], 'calculatedAt'),
  );
}

class AnalyticsProgressDto {
  const AnalyticsProgressDto({required this.value});
  final AnalyticsProgress value;

  factory AnalyticsProgressDto.fromObject(Object? value) {
    final json = analyticsJsonMap(value, context: 'Analytics progress');
    final rangeRaw = _requiredString(json, 'timeRange');
    final range = AnalyticsTimeRange.values.firstWhere(
      (item) => item.apiValue == rangeRaw,
      orElse: () => throw const FormatException('timeRange không được hỗ trợ.'),
    );
    final trendRaw = json['scoreTrend'];
    final weakRaw = json['weakAreas'];
    final activityRaw = json['dailyActivity'];
    if (trendRaw is! List || weakRaw is! List || activityRaw is! List) {
      throw const FormatException('Danh sách Analytics trả về không hợp lệ.');
    }
    final activity = activityRaw.map((item) {
      final itemJson = analyticsJsonMap(item, context: 'Daily activity');
      final date = _requiredDate(
        '${_requiredString(itemJson, 'date')}T00:00:00.000Z',
        'dailyActivity.date',
      );
      final count = _requiredInt(itemJson['count'], 'dailyActivity.count');
      if (count < 0) throw const FormatException('activity count không được âm.');
      return AnalyticsDailyActivity(date: date, count: count);
    }).toList(growable: false);
    return AnalyticsProgressDto(
      value: AnalyticsProgress(
        timeRange: range,
        timezone: _requiredString(json, 'timezone'),
        asOf: _requiredDate(json['asOf'], 'asOf'),
        from: _optionalDate(json['from'], 'from'),
        lifetime: _counters(json['lifetime'], 'Analytics lifetime counters'),
        inRange: _counters(json['inRange'], 'Analytics range counters'),
        learningStreakDays: _requiredInt(json['learningStreakDays'], 'learningStreakDays'),
        longestStreak: _requiredInt(json['longestStreak'], 'longestStreak'),
        scoreTrend: trendRaw.map(_scoreTrendPoint).toList(growable: false),
        scoreTrendNextCursor: _optionalString(json, 'scoreTrendNextCursor'),
        predictedToeicScore: _optionalInt(json['predictedToeicScore'], 'predictedToeicScore'),
        weakAreas: weakRaw.map(_weakArea).toList(growable: false),
        dailyActivity: activity,
        updatedAt: _optionalDate(json['updatedAt'], 'updatedAt'),
        dailyActivityTruncated: _optionalBool(
          json['dailyActivityTruncated'],
          'dailyActivityTruncated',
        ),
      ),
    );
  }
}

class AnalyticsStreakDto {
  const AnalyticsStreakDto(this.value);
  final AnalyticsStreak value;

  factory AnalyticsStreakDto.fromObject(Object? value) {
    final json = analyticsJsonMap(value, context: 'Analytics streak');
    final last = json['lastActivityDate'];
    return AnalyticsStreakDto(
      AnalyticsStreak(
        learningStreakDays: _requiredInt(json['learningStreakDays'], 'learningStreakDays'),
        longestStreak: _requiredInt(json['longestStreak'], 'longestStreak'),
        timezone: _requiredString(json, 'timezone'),
        asOf: _requiredDate(json['asOf'], 'asOf'),
        lastActivityDate: _optionalDate(
          last is String && last.length == 10 ? '${last}T00:00:00.000Z' : last,
          'lastActivityDate',
        ),
      ),
    );
  }
}

class AnalyticsPredictionDto {
  const AnalyticsPredictionDto(this.value);
  final AnalyticsPrediction value;

  factory AnalyticsPredictionDto.fromObject(Object? value) {
    final json = analyticsJsonMap(value, context: 'Analytics prediction');
    final rawIds = json['usedAttemptIds'];
    if (rawIds is! List || rawIds.any((item) => item is! String)) {
      throw const FormatException('usedAttemptIds không hợp lệ.');
    }
    return AnalyticsPredictionDto(
      AnalyticsPrediction(
        predictedToeicScore: _optionalInt(json['predictedToeicScore'], 'predictedToeicScore'),
        eligibleFullCount: _requiredInt(json['eligibleFullCount'], 'eligibleFullCount'),
        usedAttemptIds: rawIds.cast<String>(),
        reason: _optionalString(json, 'reason'),
        method: _requiredString(json, 'method'),
        windowDays: _requiredInt(json['windowDays'], 'windowDays'),
        asOf: _requiredDate(json['asOf'], 'asOf'),
      ),
    );
  }
}

class AnalyticsWeakAreasDto {
  const AnalyticsWeakAreasDto(this.value);
  final AnalyticsWeakAreaSummary value;

  factory AnalyticsWeakAreasDto.fromObject(Object? value) {
    final json = analyticsJsonMap(value, context: 'Analytics weak areas');
    final rawItems = json['items'];
    if (rawItems is! List) throw const FormatException('items weak areas không hợp lệ.');
    return AnalyticsWeakAreasDto(
      AnalyticsWeakAreaSummary(
        items: rawItems.map(_weakArea).toList(growable: false),
        asOf: _requiredDate(json['asOf'], 'asOf'),
        windowDays: _requiredInt(json['windowDays'], 'windowDays'),
        minimumQuestions: _requiredInt(json['minimumQuestions'], 'minimumQuestions'),
        threshold: _requiredDouble(json['threshold'], 'threshold'),
        timezone: _requiredString(json, 'timezone'),
      ),
    );
  }
}

AnalyticsPartStat _partStat(Object? value) {
  final json = analyticsJsonMap(value, context: 'Analytics part stat');
  final part = _requiredInt(json['part'], 'part');
  final correct = _requiredInt(json['correct'], 'correct');
  final total = _requiredInt(json['total'], 'total');
  if (part < 1 || part > 7 || correct < 0 || total < correct) {
    throw const FormatException('Analytics part stat không hợp lệ.');
  }
  return AnalyticsPartStat(part: part, correct: correct, total: total);
}

class AnalyticsHistoryItemDto {
  const AnalyticsHistoryItemDto(this.value);
  final AnalyticsHistoryItem value;

  factory AnalyticsHistoryItemDto.fromObject(Object? value) {
    final json = analyticsJsonMap(value, context: 'Analytics history item');
    final modeRaw = _requiredString(json, 'mode').toUpperCase();
    final mode = switch (modeRaw) {
      'FULL' => AnalyticsAttemptMode.full,
      'PART' => AnalyticsAttemptMode.part,
      _ => throw const FormatException('Analytics attempt mode không hợp lệ.'),
    };
    final rawStats = json['partStats'];
    final stats = rawStats is List
        ? rawStats.map(_partStat).toList(growable: false)
        : const <AnalyticsPartStat>[];
    final scoring = json['scoring'];
    return AnalyticsHistoryItemDto(
      AnalyticsHistoryItem(
        attemptId: _requiredString(json, 'attemptId'),
        testId: _optionalString(json, 'testId'),
        mode: mode,
        completedAt: _requiredDate(json['completedAt'], 'completedAt'),
        partStats: stats,
        scoreListening: _optionalInt(json['scoreListening'], 'scoreListening'),
        scoreReading: _optionalInt(json['scoreReading'], 'scoreReading'),
        totalScore: _optionalInt(json['totalScore'], 'totalScore'),
        correctCount: _optionalInt(json['correctCount'], 'correctCount'),
        totalQuestions: _optionalInt(json['totalQuestions'], 'totalQuestions'),
        accuracy: _optionalDouble(json['accuracy'], 'accuracy'),
        scoring: scoring == null
            ? null
            : analyticsJsonMap(scoring, context: 'Analytics history scoring'),
      ),
    );
  }
}

class AnalyticsHistoryPageDto {
  const AnalyticsHistoryPageDto(this.value);
  final AnalyticsHistoryPage value;

  factory AnalyticsHistoryPageDto.fromObject(Object? value) {
    final json = analyticsJsonMap(value, context: 'Analytics history page');
    final rawItems = json['items'];
    if (rawItems is! List) throw const FormatException('items lịch sử không hợp lệ.');
    final total = _requiredInt(json['total'], 'total');
    final page = _requiredInt(json['page'], 'page');
    final size = _requiredInt(json['size'], 'size');
    final totalPages = _requiredInt(json['totalPages'], 'totalPages');
    if (total < 0 || page < 1 || size < 1 || size > 50 || totalPages < 0 ||
        totalPages != (total == 0 ? 0 : (total / size).ceil()) || rawItems.length > size) {
      throw const FormatException('Metadata phân trang Analytics không hợp lệ.');
    }
    return AnalyticsHistoryPageDto(
      AnalyticsHistoryPage(
        items: rawItems
            .map(AnalyticsHistoryItemDto.fromObject)
            .map((item) => item.value)
            .toList(growable: false),
        total: total,
        page: page,
        size: size,
        totalPages: totalPages,
      ),
    );
  }
}
