import 'package:flutter/foundation.dart';

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

  List<MockTest> get tests => _tests;
  bool get isLoading => status == TestSelectStatus.loading;

  Future<void> loadTests() async {
    status = TestSelectStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      _tests = await _repository.getTests();
      status = TestSelectStatus.loaded;
    } catch (error) {
      errorMessage = 'Không thể tải danh sách đề thi: $error';
      status = TestSelectStatus.error;
    }
    notifyListeners();
  }

  void changeFilter(TestFilter value) {
    if (filter == value) return;
    filter = value;
    notifyListeners();
  }
}
