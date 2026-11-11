import 'package:flutter/foundation.dart';

enum AnalyticsTimeRange {
  last7Days('LAST_7_DAYS', '7 ngày'),
  last30Days('LAST_30_DAYS', '30 ngày'),
  allTime('ALL_TIME', 'Tất cả');

  const AnalyticsTimeRange(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

enum AnalyticsAttemptMode { full, part }

@immutable
class AnalyticsCounters {
  const AnalyticsCounters({
    required this.vocabulariesLearned,
    required this.reviewCount,
    required this.grammarLessonsCompleted,
    required this.mockTestCount,
    required this.practiceCount,
    required this.studyDays,
  });

  final int vocabulariesLearned;
  final int reviewCount;
  final int grammarLessonsCompleted;
  final int mockTestCount;
  final int practiceCount;
  final int studyDays;
}

@immutable
class AnalyticsDailyActivity {
  const AnalyticsDailyActivity({required this.date, required this.count});
  final DateTime date;
  final int count;
}

@immutable
class AnalyticsScoreTrendPoint {
  const AnalyticsScoreTrendPoint({
    required this.attemptId,
    required this.completedAt,
    required this.scoreListening,
    required this.scoreReading,
    required this.totalScore,
    this.scoring,
  });

  final String attemptId;
  final DateTime completedAt;
  final int scoreListening;
  final int scoreReading;
  final int totalScore;
  final Map<String, dynamic>? scoring;
}

@immutable
class AnalyticsWeakArea {
  const AnalyticsWeakArea({
    required this.part,
    required this.status,
    required this.correct,
    required this.total,
    required this.weaknessScore,
    required this.isWeak,
    required this.calculatedAt,
  });

  final int part;
  final String status;
  final int correct;
  final int total;
  final double? weaknessScore;
  final bool? isWeak;
  final DateTime? calculatedAt;

  bool get isAvailable => status == 'AVAILABLE';
  int? get accuracyPercent => total == 0 || !isAvailable
      ? null
      : ((correct / total) * 100).round().clamp(0, 100).toInt();
  int? get weaknessPercent => weaknessScore == null
      ? null
      : (weaknessScore! * 100).round().clamp(0, 100).toInt();
}

@immutable
class AnalyticsProgress {
  const AnalyticsProgress({
    required this.timeRange,
    required this.timezone,
    required this.asOf,
    required this.lifetime,
    required this.inRange,
    required this.learningStreakDays,
    required this.longestStreak,
    required this.scoreTrend,
    required this.predictedToeicScore,
    required this.weakAreas,
    required this.dailyActivity,
    this.from,
    this.scoreTrendNextCursor,
    this.updatedAt,
    this.dailyActivityTruncated = false,
  });

  final AnalyticsTimeRange timeRange;
  final String timezone;
  final DateTime asOf;
  final DateTime? from;
  final AnalyticsCounters lifetime;
  final AnalyticsCounters inRange;
  final int learningStreakDays;
  final int longestStreak;
  final List<AnalyticsScoreTrendPoint> scoreTrend;
  final String? scoreTrendNextCursor;
  final int? predictedToeicScore;
  final List<AnalyticsWeakArea> weakAreas;
  final List<AnalyticsDailyActivity> dailyActivity;
  final DateTime? updatedAt;
  final bool dailyActivityTruncated;
}

@immutable
class AnalyticsStreak {
  const AnalyticsStreak({
    required this.learningStreakDays,
    required this.longestStreak,
    required this.timezone,
    required this.asOf,
    this.lastActivityDate,
  });

  final int learningStreakDays;
  final int longestStreak;
  final String timezone;
  final DateTime asOf;
  final DateTime? lastActivityDate;
}

@immutable
class AnalyticsPrediction {
  const AnalyticsPrediction({
    required this.predictedToeicScore,
    required this.eligibleFullCount,
    required this.usedAttemptIds,
    required this.method,
    required this.windowDays,
    required this.asOf,
    this.reason,
  });

  final int? predictedToeicScore;
  final int eligibleFullCount;
  final List<String> usedAttemptIds;
  final String method;
  final int windowDays;
  final DateTime asOf;
  final String? reason;
}

@immutable
class AnalyticsWeakAreaSummary {
  const AnalyticsWeakAreaSummary({
    required this.items,
    required this.asOf,
    required this.windowDays,
    required this.minimumQuestions,
    required this.threshold,
    required this.timezone,
  });

  final List<AnalyticsWeakArea> items;
  final DateTime asOf;
  final int windowDays;
  final int minimumQuestions;
  final double threshold;
  final String timezone;
}

@immutable
class AnalyticsPartStat {
  const AnalyticsPartStat({
    required this.part,
    required this.correct,
    required this.total,
  });

  final int part;
  final int correct;
  final int total;
}

@immutable
class AnalyticsHistoryItem {
  const AnalyticsHistoryItem({
    required this.attemptId,
    required this.mode,
    required this.completedAt,
    required this.partStats,
    this.testId,
    this.scoreListening,
    this.scoreReading,
    this.totalScore,
    this.correctCount,
    this.totalQuestions,
    this.accuracy,
    this.scoring,
  });

  final String attemptId;
  final String? testId;
  final AnalyticsAttemptMode mode;
  final DateTime completedAt;
  final List<AnalyticsPartStat> partStats;
  final int? scoreListening;
  final int? scoreReading;
  final int? totalScore;
  final int? correctCount;
  final int? totalQuestions;
  final double? accuracy;
  final Map<String, dynamic>? scoring;

  List<int> get parts =>
      partStats.map((item) => item.part).toList(growable: false);
  bool get isFull => mode == AnalyticsAttemptMode.full;
}

@immutable
class AnalyticsHistoryPage {
  const AnalyticsHistoryPage({
    required this.items,
    required this.total,
    required this.page,
    required this.size,
    required this.totalPages,
  });

  final List<AnalyticsHistoryItem> items;
  final int total;
  final int page;
  final int size;
  final int totalPages;

  bool get hasNext => page < totalPages;
}
