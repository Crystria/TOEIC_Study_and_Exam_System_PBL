import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/analytics/models/analytics_models.dart';
import 'package:toeic_mobile/features/analytics/repositories/analytics_repository.dart';
import 'package:toeic_mobile/features/home/repositories/analytics_home_repository.dart';
import 'package:toeic_mobile/features/learning/models/learning_models.dart';
import 'package:toeic_mobile/features/learning/repositories/learning_repository.dart';

void main() {
  test(
    'aggregates injected feature repositories into dashboard data',
    () async {
      final analyticsRepository = _AnalyticsRepository(
        _analyticsProgress(isIllustrative: true),
      );
      final learningRepository = _LearningRepository(
        const LearningProgressSummary(
          reviewedVocabularies: 12,
          vocabulariesLearned: 40,
          dueVocabularies: 7,
          grammarLessonsCompleted: 5,
          sessionsCompleted: 3,
        ),
      );
      final repository = AnalyticsHomeRepository(
        analyticsRepository: analyticsRepository,
        learningRepository: learningRepository,
        currentUserName: () => 'Learner',
      );

      final dashboard = await repository.loadDashboard();

      expect(analyticsRepository.requestedRange, AnalyticsTimeRange.last30Days);
      expect(learningRepository.summaryRequestCount, 1);
      expect(dashboard.userName, 'Learner');
      expect(dashboard.predictedScore, 720);
      expect(dashboard.streakDays, 6);
      expect(dashboard.vocabLearned, 40);
      expect(dashboard.lessonsDone, 8);
      expect(dashboard.mockTestCount, 2);
      expect(dashboard.dueFlashcards, 7);
      expect(dashboard.weakAreas, hasLength(1));
      expect(dashboard.weakAreas.single.part, 5);
      expect(dashboard.weakAreas.single.accuracy, 68);
      expect(dashboard.todayActivityCount, 4);
      expect(dashboard.isIllustrative, isTrue);
    },
  );

  test(
    'keeps Analytics dashboard available when optional Learning summary fails',
    () async {
      final repository = AnalyticsHomeRepository(
        analyticsRepository: _AnalyticsRepository(
          _analyticsProgress(isIllustrative: false),
        ),
        learningRepository: _LearningRepository(
          null,
          failure: StateError('offline'),
        ),
        currentUserName: () => null,
      );

      final dashboard = await repository.loadDashboard();

      expect(dashboard.userName, 'bạn');
      expect(dashboard.predictedScore, 720);
      expect(dashboard.dueFlashcards, isNull);
      expect(dashboard.isIllustrative, isFalse);
    },
  );
}

AnalyticsProgress _analyticsProgress({required bool isIllustrative}) {
  final now = DateTime.now().toUtc();
  final localToday = now.add(const Duration(hours: 7));
  final todayDate = DateTime.utc(
    localToday.year,
    localToday.month,
    localToday.day,
    12,
  );
  const counters = AnalyticsCounters(
    vocabulariesLearned: 40,
    reviewCount: 12,
    grammarLessonsCompleted: 8,
    mockTestCount: 2,
    practiceCount: 3,
    studyDays: 6,
  );
  return AnalyticsProgress(
    timeRange: AnalyticsTimeRange.last30Days,
    timezone: 'Asia/Ho_Chi_Minh',
    asOf: now,
    lifetime: counters,
    inRange: counters,
    learningStreakDays: 6,
    longestStreak: 9,
    scoreTrend: const [],
    predictedToeicScore: 720,
    weakAreas: [
      AnalyticsWeakArea(
        part: 5,
        status: 'AVAILABLE',
        correct: 17,
        total: 25,
        weaknessScore: 0.32,
        isWeak: true,
        calculatedAt: now,
      ),
    ],
    dailyActivity: [AnalyticsDailyActivity(date: todayDate, count: 4)],
    isIllustrative: isIllustrative,
  );
}

class _AnalyticsRepository implements AnalyticsRepository {
  _AnalyticsRepository(this.progress);

  final AnalyticsProgress progress;
  AnalyticsTimeRange? requestedRange;

  @override
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range) async {
    requestedRange = range;
    return progress;
  }

  @override
  void resetForUserScopeChange() {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _LearningRepository implements LearningRepository {
  _LearningRepository(this.summary, {this.failure});

  final LearningProgressSummary? summary;
  final Object? failure;
  int summaryRequestCount = 0;

  @override
  Future<LearningProgressSummary> getProgressSummary() async {
    summaryRequestCount++;
    if (failure != null) throw failure!;
    return summary!;
  }

  @override
  void resetForUserScopeChange() {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
