import '../../../core/errors/app_exception.dart';
import '../data_sources/analytics_data_source.dart';
import '../models/analytics_models.dart';

/// Analytics feature contract consumed by Providers and other features.
abstract interface class AnalyticsRepository {
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range);
  Future<AnalyticsHistoryPage> getScores({int page = 1, int size = 20});
  Future<AnalyticsHistoryPage> getPractices({int page = 1, int size = 20});
  Future<AnalyticsStreak> getStreak();
  Future<AnalyticsPrediction> getPrediction();
  Future<AnalyticsWeakAreaSummary> getWeakAreas();
  void resetForUserScopeChange();
}

/// Backend-backed repository. User identity is bound to the authenticated
/// session and is never sent as a query parameter; the Backend derives it from
/// the JWT subject.
class ApiAnalyticsRepository implements AnalyticsRepository {
  ApiAnalyticsRepository({
    required AnalyticsDataSource remoteDataSource,
    required String? Function() currentUserId,
  }) : _remote = remoteDataSource,
       _currentUserId = currentUserId;

  final AnalyticsDataSource _remote;
  final String? Function() _currentUserId;
  int _scopeRevision = 0;

  @override
  void resetForUserScopeChange() => _scopeRevision++;

  @override
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range) =>
      _runScoped(() => _remote.getProgress(range));

  @override
  Future<AnalyticsHistoryPage> getScores({int page = 1, int size = 20}) async {
    _validatePage(page, size);
    return _runScoped(() => _remote.getScores(page: page, size: size));
  }

  @override
  Future<AnalyticsHistoryPage> getPractices({
    int page = 1,
    int size = 20,
  }) async {
    _validatePage(page, size);
    return _runScoped(() => _remote.getPractices(page: page, size: size));
  }

  @override
  Future<AnalyticsStreak> getStreak() => _runScoped(_remote.getStreak);

  @override
  Future<AnalyticsPrediction> getPrediction() =>
      _runScoped(_remote.getPrediction);

  @override
  Future<AnalyticsWeakAreaSummary> getWeakAreas() =>
      _runScoped(_remote.getWeakAreas);

  Future<T> _runScoped<T>(Future<T> Function() operation) async {
    final scope = _captureScope();
    final value = await operation();
    _ensureScope(scope);
    return value;
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
