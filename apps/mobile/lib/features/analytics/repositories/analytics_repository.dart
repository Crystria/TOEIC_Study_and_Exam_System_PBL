// ignore_for_file: prefer_initializing_formals
import '../../../core/errors/app_exception.dart';
import '../models/analytics_models.dart';
import '../services/analytics_api_service.dart';

abstract interface class AnalyticsRepository {
  bool get isDemoData;

  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range);
  Future<AnalyticsHistoryPage> getScores({int page = 1, int size = 20});
  Future<AnalyticsHistoryPage> getPractices({int page = 1, int size = 20});
  Future<AnalyticsStreak> getStreak();
  Future<AnalyticsPrediction> getPrediction();
  Future<AnalyticsWeakAreaSummary> getWeakAreas();
  void resetForUserScopeChange();
}

/// Backend-backed, read-only Analytics repository.
/// User identity is taken from the authenticated session; it is never sent as
/// a query parameter because the Backend derives it from the JWT subject.
class ApiAnalyticsRepository implements AnalyticsRepository {
  ApiAnalyticsRepository({
    required AnalyticsApiService api,
    required String? Function() currentUserId,
  }) : _api = api,
       _currentUserId = currentUserId;

  final AnalyticsApiService _api;
  final String? Function() _currentUserId;
  int _scopeRevision = 0;

  @override
  bool get isDemoData => false;

  @override
  void resetForUserScopeChange() {
    _scopeRevision++;
  }

  @override
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range) async {
    final scope = _captureScope();
    final dto = await _api.getProgress(timeRange: range.apiValue);
    _ensureScope(scope);
    return dto.value;
  }

  @override
  Future<AnalyticsHistoryPage> getScores({int page = 1, int size = 20}) async {
    _validatePage(page, size);
    final scope = _captureScope();
    final dto = await _api.getScores(page: page, size: size);
    _ensureScope(scope);
    return dto.value;
  }

  @override
  Future<AnalyticsHistoryPage> getPractices({
    int page = 1,
    int size = 20,
  }) async {
    _validatePage(page, size);
    final scope = _captureScope();
    final dto = await _api.getPractices(page: page, size: size);
    _ensureScope(scope);
    return dto.value;
  }

  @override
  Future<AnalyticsStreak> getStreak() async {
    final scope = _captureScope();
    final dto = await _api.getStreak();
    _ensureScope(scope);
    return dto.value;
  }

  @override
  Future<AnalyticsPrediction> getPrediction() async {
    final scope = _captureScope();
    final dto = await _api.getPrediction();
    _ensureScope(scope);
    return dto.value;
  }

  @override
  Future<AnalyticsWeakAreaSummary> getWeakAreas() async {
    final scope = _captureScope();
    final dto = await _api.getWeakAreas();
    _ensureScope(scope);
    return dto.value;
  }

  _AnalyticsScope _captureScope() {
    final userId = _currentUserId()?.trim();
    if (userId == null || userId.isEmpty) {
      throw const AppException.unauthorized(
        message: 'Bạn cần đăng nhập để xem thống kê học tập.',
      );
    }
    return _AnalyticsScope(userId: userId, revision: _scopeRevision);
  }

  void _ensureScope(_AnalyticsScope scope) {
    if (scope.revision != _scopeRevision ||
        _currentUserId()?.trim() != scope.userId) {
      throw const AppException.cancelled(
        message: 'Yêu cầu thống kê đã bị hủy do tài khoản thay đổi.',
      );
    }
  }

  static void _validatePage(int page, int size) {
    if (page < 1 || size < 1 || size > 50) {
      throw ArgumentError('Analytics yêu cầu page >= 1 và size từ 1 đến 50.');
    }
  }
}

class _AnalyticsScope {
  const _AnalyticsScope({required this.userId, required this.revision});
  final String userId;
  final int revision;
}

/// Deterministic demo fixture when the Analytics API feature is disabled.
/// Values are explicitly marked as demo by [isDemoData].
class MockAnalyticsRepository implements AnalyticsRepository {
  @override
  bool get isDemoData => true;

  DateTime get _now => DateTime.now();

  AnalyticsCounters _counters({
    required int vocabulariesLearned,
    required int reviewCount,
    required int grammarLessonsCompleted,
    required int mockTestCount,
    required int practiceCount,
    required int studyDays,
  }) => AnalyticsCounters(
    vocabulariesLearned: vocabulariesLearned,
    reviewCount: reviewCount,
    grammarLessonsCompleted: grammarLessonsCompleted,
    mockTestCount: mockTestCount,
    practiceCount: practiceCount,
    studyDays: studyDays,
  );

  @override
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range) async {
    final now = _now;
    final today = DateTime(now.year, now.month, now.day);
    final lifetime = _counters(
      vocabulariesLearned: 248,
      reviewCount: 420,
      grammarLessonsCompleted: 14,
      mockTestCount: 5,
      practiceCount: 12,
      studyDays: 34,
    );
    final inRange = switch (range) {
      AnalyticsTimeRange.last7Days => _counters(
        vocabulariesLearned: 18,
        reviewCount: 64,
        grammarLessonsCompleted: 2,
        mockTestCount: 1,
        practiceCount: 4,
        studyDays: 6,
      ),
      AnalyticsTimeRange.last30Days => _counters(
        vocabulariesLearned: 52,
        reviewCount: 166,
        grammarLessonsCompleted: 5,
        mockTestCount: 3,
        practiceCount: 8,
        studyDays: 18,
      ),
      AnalyticsTimeRange.allTime => lifetime,
    };
    final rangeDays = switch (range) {
      AnalyticsTimeRange.last7Days => 7,
      AnalyticsTimeRange.last30Days => 30,
      AnalyticsTimeRange.allTime => 30,
    };
    final activity = List<AnalyticsDailyActivity>.generate(rangeDays, (index) {
      final date = today.subtract(Duration(days: rangeDays - index - 1));
      final values = const [1, 3, 0, 4, 2, 5, 1, 0, 3, 2, 4, 1, 2, 0, 3];
      final count = index == rangeDays - 1 ? 4 : values[index % values.length];
      return AnalyticsDailyActivity(
        date: DateTime.utc(date.year, date.month, date.day),
        count: count,
      );
    });
    final trends =
        [
              (days: 26, listening: 295, reading: 295, total: 590),
              (days: 20, listening: 305, reading: 310, total: 615),
              (days: 13, listening: 315, reading: 315, total: 630),
              (days: 7, listening: 320, reading: 330, total: 650),
              (days: 1, listening: 335, reading: 350, total: 685),
            ]
            .map(
              (item) => AnalyticsScoreTrendPoint(
                attemptId: 'demo-full-${item.days}',
                completedAt: now.subtract(Duration(days: item.days)),
                scoreListening: item.listening,
                scoreReading: item.reading,
                totalScore: item.total,
                scoring: const {'method': 'DEMO', 'official': false},
              ),
            )
            .toList(growable: false);

    return AnalyticsProgress(
      timeRange: range,
      timezone: 'Asia/Ho_Chi_Minh',
      asOf: now.toUtc(),
      from: range == AnalyticsTimeRange.allTime
          ? null
          : today.subtract(Duration(days: rangeDays - 1)).toUtc(),
      lifetime: lifetime,
      inRange: inRange,
      learningStreakDays: 12,
      longestStreak: 18,
      scoreTrend: range == AnalyticsTimeRange.last7Days
          ? trends
                .where(
                  (item) => item.completedAt.isAfter(
                    today.subtract(const Duration(days: 7)),
                  ),
                )
                .toList()
          : trends,
      predictedToeicScore: 685,
      weakAreas: const [
        AnalyticsWeakArea(
          part: 1,
          status: 'INSUFFICIENT_DATA',
          correct: 12,
          total: 18,
          weaknessScore: null,
          isWeak: null,
          calculatedAt: null,
        ),
        AnalyticsWeakArea(
          part: 2,
          status: 'AVAILABLE',
          correct: 42,
          total: 60,
          weaknessScore: 0.3,
          isWeak: true,
          calculatedAt: null,
        ),
        AnalyticsWeakArea(
          part: 3,
          status: 'AVAILABLE',
          correct: 68,
          total: 100,
          weaknessScore: 0.32,
          isWeak: true,
          calculatedAt: null,
        ),
        AnalyticsWeakArea(
          part: 4,
          status: 'INSUFFICIENT_DATA',
          correct: 14,
          total: 18,
          weaknessScore: null,
          isWeak: null,
          calculatedAt: null,
        ),
        AnalyticsWeakArea(
          part: 5,
          status: 'AVAILABLE',
          correct: 62,
          total: 100,
          weaknessScore: 0.38,
          isWeak: true,
          calculatedAt: null,
        ),
        AnalyticsWeakArea(
          part: 6,
          status: 'INSUFFICIENT_DATA',
          correct: 10,
          total: 18,
          weaknessScore: null,
          isWeak: null,
          calculatedAt: null,
        ),
        AnalyticsWeakArea(
          part: 7,
          status: 'AVAILABLE',
          correct: 71,
          total: 100,
          weaknessScore: 0.29,
          isWeak: false,
          calculatedAt: null,
        ),
      ],
      dailyActivity: activity,
      updatedAt: now.toUtc(),
    );
  }

  @override
  Future<AnalyticsStreak> getStreak() async => AnalyticsStreak(
    learningStreakDays: 12,
    longestStreak: 18,
    timezone: 'Asia/Ho_Chi_Minh',
    asOf: _now.toUtc(),
    lastActivityDate: _now,
  );

  @override
  Future<AnalyticsPrediction> getPrediction() async => AnalyticsPrediction(
    predictedToeicScore: 685,
    eligibleFullCount: 5,
    usedAttemptIds: const ['demo-full-1', 'demo-full-7', 'demo-full-13'],
    method: 'DEMO_WEIGHTED_LATEST_3',
    windowDays: 30,
    asOf: _now.toUtc(),
  );

  @override
  Future<AnalyticsWeakAreaSummary> getWeakAreas() async {
    final progress = await getProgress(AnalyticsTimeRange.last30Days);
    return AnalyticsWeakAreaSummary(
      items: progress.weakAreas,
      asOf: progress.asOf,
      windowDays: 30,
      minimumQuestions: 20,
      threshold: 0.3,
      timezone: 'Asia/Ho_Chi_Minh',
    );
  }

  List<AnalyticsHistoryItem> _scoreItems() {
    final now = _now;
    return [
      for (final item in const [
        (days: 1, listening: 335, reading: 350, total: 685),
        (days: 7, listening: 320, reading: 330, total: 650),
        (days: 13, listening: 315, reading: 315, total: 630),
        (days: 20, listening: 305, reading: 310, total: 615),
        (days: 26, listening: 295, reading: 295, total: 590),
      ])
        AnalyticsHistoryItem(
          attemptId: 'demo-score-${item.days}',
          mode: AnalyticsAttemptMode.full,
          completedAt: now.subtract(Duration(days: item.days)),
          partStats: const [],
          scoreListening: item.listening,
          scoreReading: item.reading,
          totalScore: item.total,
          scoring: const {'method': 'DEMO', 'official': false},
        ),
    ];
  }

  List<AnalyticsHistoryItem> _practiceItems() {
    final now = _now;
    return [
      for (final item in const [
        (days: 1, part: 5, correct: 18, total: 30),
        (days: 3, part: 3, correct: 21, total: 30),
        (days: 5, part: 7, correct: 22, total: 30),
        (days: 8, part: 2, correct: 20, total: 30),
        (days: 11, part: 6, correct: 17, total: 30),
      ])
        AnalyticsHistoryItem(
          attemptId: 'demo-practice-${item.days}',
          mode: AnalyticsAttemptMode.part,
          completedAt: now.subtract(Duration(days: item.days)),
          partStats: [
            AnalyticsPartStat(
              part: item.part,
              correct: item.correct,
              total: item.total,
            ),
          ],
          correctCount: item.correct,
          totalQuestions: item.total,
          accuracy: item.correct / item.total,
        ),
    ];
  }

  AnalyticsHistoryPage _page(
    List<AnalyticsHistoryItem> items, {
    required int page,
    required int size,
  }) {
    final start = (page - 1) * size;
    final end = (start + size).clamp(0, items.length).toInt();
    final pageItems = start >= items.length
        ? const <AnalyticsHistoryItem>[]
        : items.sublist(start, end);
    return AnalyticsHistoryPage(
      items: pageItems,
      total: items.length,
      page: page,
      size: size,
      totalPages: items.isEmpty ? 0 : (items.length + size - 1) ~/ size,
    );
  }

  @override
  Future<AnalyticsHistoryPage> getScores({int page = 1, int size = 20}) async {
    _validatePage(page, size);
    return _page(_scoreItems(), page: page, size: size);
  }

  @override
  Future<AnalyticsHistoryPage> getPractices({
    int page = 1,
    int size = 20,
  }) async {
    _validatePage(page, size);
    return _page(_practiceItems(), page: page, size: size);
  }

  static void _validatePage(int page, int size) {
    if (page < 1 || size < 1 || size > 50) {
      throw ArgumentError('Analytics yêu cầu page >= 1 và size từ 1 đến 50.');
    }
  }

  @override
  void resetForUserScopeChange() {}
}
