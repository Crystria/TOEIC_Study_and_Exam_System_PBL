// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../models/analytics_models.dart';
import '../repositories/analytics_repository.dart';

enum AnalyticsStatus { idle, loading, loaded, error }

class AnalyticsProvider extends ChangeNotifier {
  AnalyticsProvider({required AnalyticsRepository repository})
    : _repository = repository;

  final AnalyticsRepository _repository;
  AnalyticsStatus status = AnalyticsStatus.idle;
  AnalyticsProgress? progress;
  AnalyticsHistoryPage? scores;
  AnalyticsHistoryPage? practices;
  String? errorMessage;
  bool isLoadingMoreScores = false;
  bool isLoadingMorePractices = false;
  int _requestRevision = 0;

  bool get isDemoData => _repository.isDemoData;

  Future<void> load({
    AnalyticsTimeRange range = AnalyticsTimeRange.last30Days,
  }) async {
    final revision = ++_requestRevision;
    status = AnalyticsStatus.loading;
    errorMessage = null;
    // A range refresh invalidates any in-flight pagination request. Clear its
    // flags here because the stale request's finally block intentionally will
    // not notify or mutate state after its revision becomes obsolete.
    isLoadingMoreScores = false;
    isLoadingMorePractices = false;
    notifyListeners();
    try {
      final results = await Future.wait<Object>([
        _repository.getProgress(range),
        _repository.getScores(page: 1, size: 10),
        _repository.getPractices(page: 1, size: 10),
      ]);
      if (revision != _requestRevision) return;
      progress = results[0] as AnalyticsProgress;
      scores = results[1] as AnalyticsHistoryPage;
      practices = results[2] as AnalyticsHistoryPage;
      status = AnalyticsStatus.loaded;
    } catch (_) {
      if (revision != _requestRevision) return;
      errorMessage =
          'Không thể tải thống kê. Vui lòng kiểm tra kết nối và thử lại.';
      status = AnalyticsStatus.error;
    }
    if (revision == _requestRevision) notifyListeners();
  }

  Future<void> loadMoreScores() async {
    final current = scores;
    if (current == null || !current.hasNext || isLoadingMoreScores) return;
    final revision = _requestRevision;
    isLoadingMoreScores = true;
    notifyListeners();
    try {
      final next = await _repository.getScores(
        page: current.page + 1,
        size: current.size,
      );
      if (revision != _requestRevision) return;
      scores = AnalyticsHistoryPage(
        items: [...current.items, ...next.items],
        total: next.total,
        page: next.page,
        size: next.size,
        totalPages: next.totalPages,
      );
    } catch (_) {
      if (revision == _requestRevision) {
        errorMessage = 'Không thể tải thêm lịch sử bài thi.';
      }
    } finally {
      if (revision == _requestRevision) {
        isLoadingMoreScores = false;
        notifyListeners();
      }
    }
  }

  Future<void> loadMorePractices() async {
    final current = practices;
    if (current == null || !current.hasNext || isLoadingMorePractices) return;
    final revision = _requestRevision;
    isLoadingMorePractices = true;
    notifyListeners();
    try {
      final next = await _repository.getPractices(
        page: current.page + 1,
        size: current.size,
      );
      if (revision != _requestRevision) return;
      practices = AnalyticsHistoryPage(
        items: [...current.items, ...next.items],
        total: next.total,
        page: next.page,
        size: next.size,
        totalPages: next.totalPages,
      );
    } catch (_) {
      if (revision == _requestRevision) {
        errorMessage = 'Không thể tải thêm lịch sử luyện tập.';
      }
    } finally {
      if (revision == _requestRevision) {
        isLoadingMorePractices = false;
        notifyListeners();
      }
    }
  }

  void resetForUserScopeChange() {
    _requestRevision++;
    status = AnalyticsStatus.idle;
    progress = null;
    scores = null;
    practices = null;
    errorMessage = null;
    isLoadingMoreScores = false;
    isLoadingMorePractices = false;
    notifyListeners();
  }
}
