// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';

import '../models/mock_test.dart';
import '../repositories/mock_test_repository.dart';

enum TestFilter { all, fullTest, byPart }

enum TestSelectStatus { idle, loading, loaded, error }

class MockTestSelectProvider extends ChangeNotifier {
  MockTestSelectProvider({required MockTestRepository repository})
    : _repository = repository;

  final MockTestRepository _repository;

  TestSelectStatus status = TestSelectStatus.idle;
  TestFilter filter = TestFilter.all;
  List<MockTest> _tests = const [];
  String? errorMessage;
  int _requestId = 0;
  bool _isDisposed = false;

  List<MockTest> get tests => _tests;
  bool get isLoading => status == TestSelectStatus.loading;

  Future<void> loadTests() async {
    if (_isDisposed) return;

    final requestId = ++_requestId;
    status = TestSelectStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      final loaded = await _repository.getTests();
      if (_isDisposed || requestId != _requestId) return;
      _tests = loaded;
      status = TestSelectStatus.loaded;
    } catch (error) {
      if (_isDisposed || requestId != _requestId) return;
      errorMessage = error is AppException
          ? error.message
          : 'Không thể tải danh sách đề thi. Vui lòng thử lại.';
      status = TestSelectStatus.error;
    }
    if (!_isDisposed && requestId == _requestId) notifyListeners();
  }

  void changeFilter(TestFilter value) {
    if (_isDisposed || filter == value) return;
    filter = value;
    notifyListeners();
  }

  @override
  void dispose() {
    if (_isDisposed) return;

    _isDisposed = true;
    _requestId++;
    super.dispose();
  }
}
