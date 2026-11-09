// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';

import '../models/test_attempt.dart';
import '../models/test_history_item.dart';
import '../repositories/mock_test_attempt_repository.dart';

enum TestHistoryFilter { all, fullTest, byPart }

enum TestHistoryStatus { idle, loading, loaded, loadingMore, error }

/// Loads and filters the actual in-memory Attempt history.
class TestHistoryProvider extends ChangeNotifier {
  TestHistoryProvider({required MockTestAttemptRepository repository})
    : _repository = repository;

  static const int pageSize = 20;

  final MockTestAttemptRepository _repository;
  final List<TestHistoryItem> _items = [];

  TestHistoryFilter filter = TestHistoryFilter.all;
  TestHistoryStatus status = TestHistoryStatus.idle;
  String? errorMessage;
  String? loadMoreErrorMessage;
  int totalItems = 0;
  int _page = 0;
  int _requestId = 0;

  List<TestHistoryItem> get items => List.unmodifiable(_items);
  bool get hasItems => _items.isNotEmpty;
  bool get hasMore => _page > 0 && _items.length < totalItems;
  bool get isLoading => status == TestHistoryStatus.loading;
  bool get isLoadingMore => status == TestHistoryStatus.loadingMore;

  TestAttemptMode? get _selectedMode {
    switch (filter) {
      case TestHistoryFilter.all:
        return null;
      case TestHistoryFilter.fullTest:
        return TestAttemptMode.full;
      case TestHistoryFilter.byPart:
        return TestAttemptMode.part;
    }
  }

  Future<void> loadHistory() async {
    final requestId = ++_requestId;
    status = TestHistoryStatus.loading;
    errorMessage = null;
    loadMoreErrorMessage = null;
    _items.clear();
    totalItems = 0;
    _page = 0;
    notifyListeners();

    try {
      final result = await _repository.getAttemptHistory(
        page: 1,
        size: pageSize,
        mode: _selectedMode,
      );
      if (requestId != _requestId) return;
      _items.addAll(result.items);
      totalItems = result.total;
      _page = result.page;
      status = TestHistoryStatus.loaded;
    } catch (error) {
      if (requestId != _requestId) return;
      errorMessage = error is AppException
          ? error.message
          : 'Không thể tải lịch sử làm bài. Vui lòng thử lại.';
      status = TestHistoryStatus.error;
    }
    notifyListeners();
  }

  Future<void> loadMore() async {
    if (!hasMore || isLoading || isLoadingMore) return;

    final requestId = _requestId;
    status = TestHistoryStatus.loadingMore;
    loadMoreErrorMessage = null;
    notifyListeners();

    try {
      final result = await _repository.getAttemptHistory(
        page: _page + 1,
        size: pageSize,
        mode: _selectedMode,
      );
      if (requestId != _requestId) return;
      _items.addAll(result.items);
      totalItems = result.total;
      _page = result.page;
      status = TestHistoryStatus.loaded;
    } catch (error) {
      if (requestId != _requestId) return;
      loadMoreErrorMessage = error is AppException
          ? error.message
          : 'Không thể tải thêm lịch sử. Vui lòng thử lại.';
      status = TestHistoryStatus.loaded;
    }
    notifyListeners();
  }

  Future<void> changeFilter(TestHistoryFilter nextFilter) async {
    if (filter == nextFilter) return;
    filter = nextFilter;
    await loadHistory();
  }

  @override
  void dispose() {
    // Invalidate asynchronous work before ChangeNotifier releases its listeners.
    _requestId++;
    super.dispose();
  }
}
