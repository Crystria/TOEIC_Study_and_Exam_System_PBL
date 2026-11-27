import '../../models/analytics_models.dart';
import '../../services/analytics_api_service.dart';
import '../analytics_data_source.dart';

/// API implementation of the Analytics data-source contract.
/// It has no Test Data fallback or local fixture dependency.
class ApiAnalyticsDataSource implements AnalyticsDataSource {
  ApiAnalyticsDataSource({required AnalyticsApiService service})
    : _service = service;

  final AnalyticsApiService _service;

  @override
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range) async =>
      (await _service.getProgress(timeRange: range.apiValue)).value;

  @override
  Future<AnalyticsHistoryPage> getScores({int page = 1, int size = 20}) async =>
      (await _service.getScores(page: page, size: size)).value;

  @override
  Future<AnalyticsHistoryPage> getPractices({
    int page = 1,
    int size = 20,
  }) async => (await _service.getPractices(page: page, size: size)).value;

  @override
  Future<AnalyticsStreak> getStreak() async =>
      (await _service.getStreak()).value;

  @override
  Future<AnalyticsPrediction> getPrediction() async =>
      (await _service.getPrediction()).value;

  @override
  Future<AnalyticsWeakAreaSummary> getWeakAreas() async =>
      (await _service.getWeakAreas()).value;
}
