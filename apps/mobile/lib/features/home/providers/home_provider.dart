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

  Future<void> loadDashboard() async {
    if (status == HomeStatus.loading) return;
    final revision = _requestRevision;
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
    status = HomeStatus.idle;
    data = null;
    errorMessage = null;
    notifyListeners();
  }
}
