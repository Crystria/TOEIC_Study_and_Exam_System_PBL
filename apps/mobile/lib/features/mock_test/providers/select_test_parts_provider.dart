import 'package:flutter/foundation.dart';

import '../models/mock_test.dart';
import '../models/test_attempt.dart';
import '../models/test_part.dart';
import '../repositories/mock_test_attempt_repository.dart';
import '../repositories/mock_test_repository.dart';

enum SelectPartsStatus { idle, loading, loaded, starting, error }

class SelectTestPartsProvider extends ChangeNotifier {
  SelectTestPartsProvider({
    required MockTestRepository testRepository,
    required MockTestAttemptRepository attemptRepository,
  }) : _testRepository = testRepository,
       _attemptRepository = attemptRepository;

  final MockTestRepository _testRepository;
  final MockTestAttemptRepository _attemptRepository;

  static const int fullDurationSeconds = 7200;
  static const int minPartDurationSeconds = 300;
  static const int maxPartDurationSeconds = 10800;
  static const int defaultPartDurationSeconds = 1800;

  static const Map<int, String> durationLabels = {
    300: '5 phút',
    900: '15 phút',
    1800: '30 phút',
    3600: '1 giờ',
    5400: '1 giờ 30 phút',
    7200: '2 giờ',
    10800: '3 giờ',
  };

  SelectPartsStatus status = SelectPartsStatus.idle;
  TestAttemptMode _mode = TestAttemptMode.full;
  MockTest? test;
  List<TestPart> parts = const [];
  final Set<int> _selectedParts = {};
  int selectedDurationSeconds = defaultPartDurationSeconds;
  String? errorMessage;
  String? createdAttemptId;

  TestAttemptMode get mode => _mode;
  Set<int> get selectedParts => Set<int>.unmodifiable(_selectedParts);
  List<TestPart> get availableParts =>
      parts.where((part) => part.available).toList(growable: false);
  int get totalQuestions => parts
      .where((part) => _selectedParts.contains(part.part) && part.available)
      .fold(0, (total, part) => total + part.totalQuestions);
  bool get allSelected =>
      availableParts.isNotEmpty &&
      availableParts.every((part) => _selectedParts.contains(part.part));
  bool get canStart =>
      status == SelectPartsStatus.loaded &&
      (_mode == TestAttemptMode.full
          ? test != null &&
                test!.totalQuestions == 200 &&
                parts.length == 7 &&
                parts.every((part) => part.available) &&
                parts.fold<int>(
                      0,
                      (total, part) => total + part.totalQuestions,
                    ) ==
                    200
          : _selectedParts.isNotEmpty &&
                selectedDurationSeconds >= minPartDurationSeconds &&
                selectedDurationSeconds <= maxPartDurationSeconds);

  Future<void> loadStructure(
    String testId, {
    TestAttemptMode initialMode = TestAttemptMode.full,
  }) async {
    status = SelectPartsStatus.loading;
    errorMessage = null;
    test = null;
    parts = const [];
    _selectedParts.clear();
    _mode = initialMode;
    selectedDurationSeconds = defaultPartDurationSeconds;
    createdAttemptId = null;
    notifyListeners();

    try {
      final results = await Future.wait<Object>([
        _testRepository.getTest(testId),
        _testRepository.getTestParts(testId),
      ]);
      test = results[0] as MockTest;
      parts = results[1] as List<TestPart>;
      status = SelectPartsStatus.loaded;
    } catch (error) {
      errorMessage = 'Không thể tải cấu trúc đề thi: $error';
      status = SelectPartsStatus.error;
    }
    notifyListeners();
  }

  void setMode(TestAttemptMode value) {
    if (_mode == value || status != SelectPartsStatus.loaded) return;
    _mode = value;
    errorMessage = null;
    notifyListeners();
  }

  void togglePart(int partNumber) {
    TestPart? part;
    for (final item in parts) {
      if (item.part == partNumber) {
        part = item;
        break;
      }
    }
    if (part == null || !part.available || status != SelectPartsStatus.loaded) {
      return;
    }
    if (_selectedParts.contains(partNumber)) {
      _selectedParts.remove(partNumber);
    } else {
      _selectedParts.add(partNumber);
    }
    errorMessage = null;
    notifyListeners();
  }

  void toggleAllParts() {
    if (status != SelectPartsStatus.loaded) return;
    if (allSelected) {
      _selectedParts.clear();
    } else {
      _selectedParts
        ..clear()
        ..addAll(availableParts.map((part) => part.part));
    }
    errorMessage = null;
    notifyListeners();
  }

  void selectDuration(int seconds) {
    if (status != SelectPartsStatus.loaded ||
        !durationLabels.containsKey(seconds))
      return;
    selectedDurationSeconds = seconds;
    errorMessage = null;
    notifyListeners();
  }

  Future<TestAttempt?> startAttempt(String testId) async {
    if (!canStart) {
      errorMessage = _mode == TestAttemptMode.part && _selectedParts.isEmpty
          ? 'Vui lòng chọn ít nhất một Part.'
          : 'Thông tin lựa chọn chưa hợp lệ.';
      notifyListeners();
      return null;
    }

    status = SelectPartsStatus.starting;
    errorMessage = null;
    notifyListeners();

    try {
      final attempt = _mode == TestAttemptMode.full
          ? await _attemptRepository.startFullAttempt(testId)
          : await _attemptRepository.startPartAttempt(
              testId: testId,
              parts: _selectedParts.toList()..sort(),
              durationSeconds: selectedDurationSeconds,
            );
      createdAttemptId = attempt.attemptId;
      status = SelectPartsStatus.loaded;
      notifyListeners();
      return attempt;
    } catch (error) {
      errorMessage = 'Không thể tạo phiên thi: $error';
      status = SelectPartsStatus.loaded;
      notifyListeners();
      return null;
    }
  }
}
