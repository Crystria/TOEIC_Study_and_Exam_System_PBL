// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../models/dashboard_data.dart';
import '../repositories/home_repository.dart';

enum HomeStatus { idle, loading, loaded, error }

/// Owns Dashboard presentation state and delegates data aggregation to the
/// HomeRepository contract. It has no direct dependency on Analytics or
/// Learning feature repositories.
class HomeProvider extends ChangeNotifier {
  HomeProvider({required HomeRepository repository}) : _repository = repository;

  final HomeRepository _repository;

  HomeStatus status = HomeStatus.idle;
  DashboardData? data;
  String? errorMessage;
  int _requestRevision = 0;
  Future<void>? _activeLoad;

  /// Concurrent initial-load and pull-to-refresh calls share one request.
  /// Returning the active Future keeps RefreshIndicator open until the
  /// request actually completes instead of stopping immediately.
  Future<void> loadDashboard() {
    final activeLoad = _activeLoad;
    if (activeLoad != null) return activeLoad;

    final revision = ++_requestRevision;
    late final Future<void> request;
    request = _loadDashboard(revision).whenComplete(() {
      if (revision == _requestRevision && identical(_activeLoad, request)) {
        _activeLoad = null;
      }
    });
    _activeLoad = request;
    return request;
  }

  Future<void> _loadDashboard(int revision) async {
    status = HomeStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      final loadedData = await _repository.loadDashboard();
      if (revision != _requestRevision) return;
      data = loadedData;
      status = HomeStatus.loaded;
    } catch (_) {
      if (revision != _requestRevision) return;
      errorMessage = 'Không tải được dữ liệu. Vui lòng thử lại.';
      status = HomeStatus.error;
    }
    if (revision == _requestRevision) notifyListeners();
  }

  void resetForUserScopeChange() {
    _requestRevision++;
    _activeLoad = null;
    status = HomeStatus.idle;
    data = null;
    errorMessage = null;
    notifyListeners();
  }
}
