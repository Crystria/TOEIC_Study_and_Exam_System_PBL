import '../../../../core/errors/app_exception.dart';
import '../../data_sources/analytics_data_source.dart';
import '../../models/analytics_models.dart';
import '../analytics_repository.dart';

/// Development-only repository. It reads fixed demo fixtures from an explicit
/// Test Data Data Source and never falls through to the Backend.
class TestDataAnalyticsRepository implements AnalyticsRepository {
  TestDataAnalyticsRepository({
    required AnalyticsDataSource testDataSource,
    String? Function()? currentUserId,
  }) : _testData = testDataSource,
       _currentUserId = currentUserId;

  final AnalyticsDataSource _testData;
  final String? Function()? _currentUserId;
  int _scopeRevision = 0;

  @override
  void resetForUserScopeChange() => _scopeRevision++;

  @override
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range) =>
      _runScoped(() => _testData.getProgress(range));

  @override
  Future<AnalyticsHistoryPage> getScores({int page = 1, int size = 20}) {
    _validatePage(page, size);
    return _runScoped(() => _testData.getScores(page: page, size: size));
  }

  @override
  Future<AnalyticsHistoryPage> getPractices({int page = 1, int size = 20}) {
    _validatePage(page, size);
    return _runScoped(() => _testData.getPractices(page: page, size: size));
  }

  @override
  Future<AnalyticsStreak> getStreak() => _runScoped(_testData.getStreak);

  @override
  Future<AnalyticsPrediction> getPrediction() =>
      _runScoped(_testData.getPrediction);

  @override
  Future<AnalyticsWeakAreaSummary> getWeakAreas() =>
      _runScoped(_testData.getWeakAreas);

  Future<T> _runScoped<T>(Future<T> Function() operation) async {
    final scope = _captureScope();
    final value = await operation();
    _ensureScope(scope);
    return value;
  }

  _TestAnalyticsScope _captureScope() => _TestAnalyticsScope(
    userId: _currentUserId?.call()?.trim(),
    revision: _scopeRevision,
  );

  void _ensureScope(_TestAnalyticsScope scope) {
    if (scope.revision != _scopeRevision ||
        (scope.userId != null &&
            _currentUserId?.call()?.trim() != scope.userId)) {
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

class _TestAnalyticsScope {
  const _TestAnalyticsScope({required this.userId, required this.revision});
  final String? userId;
  final int revision;
}
