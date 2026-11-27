import '../models/analytics_models.dart';

/// Read-only data contract shared by the API and Test Data implementations.
/// Data sources return domain models; HTTP/JSON concerns stay in the API
/// adapter and fixture concerns stay in the Test Data adapter.
abstract interface class AnalyticsDataSource {
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range);
  Future<AnalyticsHistoryPage> getScores({int page = 1, int size = 20});
  Future<AnalyticsHistoryPage> getPractices({int page = 1, int size = 20});
  Future<AnalyticsStreak> getStreak();
  Future<AnalyticsPrediction> getPrediction();
  Future<AnalyticsWeakAreaSummary> getWeakAreas();
}
