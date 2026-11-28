// ignore_for_file: prefer_initializing_formals
import '../../../core/network/api_client.dart';
import '../../../core/network/endpoints.dart';
import '../models/analytics_dtos.dart';

/// Thin transport adapter for the read-only Analytics API.
/// It performs HTTP and JSON-to-DTO mapping only.
class AnalyticsApiService {
  AnalyticsApiService({required ApiClient client}) : _client = client;

  final ApiClient _client;

  Future<AnalyticsProgressDto> getProgress({
    required String timeRange,
    int limit = 50,
    String? cursor,
  }) async {
    final response = await _client.get<Object?>(
      Endpoints.analytics.progress,
      queryParameters: {
        'timeRange': timeRange,
        'limit': limit,
        if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
      },
    );
    return AnalyticsProgressDto.fromObject(response.data);
  }

  Future<AnalyticsHistoryPageDto> getScores({
    int page = 1,
    int size = 20,
  }) async {
    final response = await _client.get<Object?>(
      Endpoints.analytics.scores,
      queryParameters: {'page': page, 'size': size},
    );
    return AnalyticsHistoryPageDto.fromObject(response.data);
  }

  Future<AnalyticsHistoryPageDto> getPractices({
    int page = 1,
    int size = 20,
  }) async {
    final response = await _client.get<Object?>(
      Endpoints.analytics.practices,
      queryParameters: {'page': page, 'size': size},
    );
    return AnalyticsHistoryPageDto.fromObject(response.data);
  }

  Future<AnalyticsStreakDto> getStreak() async {
    final response = await _client.get<Object?>(Endpoints.analytics.streak);
    return AnalyticsStreakDto.fromObject(response.data);
  }

  Future<AnalyticsPredictionDto> getPrediction() async {
    final response = await _client.get<Object?>(Endpoints.analytics.prediction);
    return AnalyticsPredictionDto.fromObject(response.data);
  }

  Future<AnalyticsWeakAreasDto> getWeakAreas() async {
    final response = await _client.get<Object?>(Endpoints.analytics.weakAreas);
    return AnalyticsWeakAreasDto.fromObject(response.data);
  }
}
