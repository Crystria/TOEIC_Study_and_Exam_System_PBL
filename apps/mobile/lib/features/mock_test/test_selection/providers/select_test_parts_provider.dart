import 'package:flutter/foundation.dart';

class TestPartOption {
  TestPartOption({required this.part, required this.title, required this.questionCount, this.selected = true});
  final int part;
  final String title;
  final int questionCount;
  bool selected;
}

enum SelectPartsStatus { idle, loading, loaded, starting }

class SelectTestPartsProvider extends ChangeNotifier {
  SelectPartsStatus status = SelectPartsStatus.idle;
  List<TestPartOption> parts = [];
  static const timeOptions = ['Không tính giờ', '15 phút', '30 phút', '1 giờ', '1 giờ 30', '2 giờ'];
  String selectedTime = '2 giờ';
  String? createdAttemptId;

  bool get allSelected => parts.every((p) => p.selected);
  int get totalQuestions => parts.where((p) => p.selected).fold(0, (s, p) => s + p.questionCount);

  Future<void> loadStructure(String testId) async {
    status = SelectPartsStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 400));
    // TODO: repository.getTestStructure(testId)
    parts = [
      TestPartOption(part: 1, title: 'Mô tả hình ảnh', questionCount: 6),
      TestPartOption(part: 5, title: 'Điền vào câu', questionCount: 30),
    ];
    status = SelectPartsStatus.loaded;
    notifyListeners();
  }

  void toggleAll() {
    final next = !allSelected;
    for (final p in parts) {
      p.selected = next;
    }
    notifyListeners();
  }

  void togglePart(TestPartOption p) {
    p.selected = !p.selected;
    notifyListeners();
  }

  void selectTime(String t) {
    selectedTime = t;
    notifyListeners();
  }

  Future<void> startAttempt(String testId) async {
    status = SelectPartsStatus.starting;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 500));
    // TODO: repository.createAttempt(testId, selectedParts, selectedTime) -> trả attemptId
    createdAttemptId = 'mock-attempt-id';
    status = SelectPartsStatus.loaded; // screen điều hướng sang MockTestTakingScreen(attemptId: createdAttemptId)
    notifyListeners();
  }
}
