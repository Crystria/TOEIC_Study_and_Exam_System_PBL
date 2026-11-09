import 'package:flutter/foundation.dart';

class ReviewGoalSettingsProvider extends ChangeNotifier {
  int dailyGoal = 20;
  bool remindEnabled = true;
  static const int minGoal = 5, maxGoal = 100, step = 5;

  Future<void> loadCurrentGoal() async {
    await Future.delayed(
      const Duration(milliseconds: 300),
    ); // TODO: repository.getReviewSettings()
    notifyListeners();
  }

  void decrease() {
    dailyGoal = (dailyGoal - step).clamp(minGoal, maxGoal);
    notifyListeners();
  }

  void increase() {
    dailyGoal = (dailyGoal + step).clamp(minGoal, maxGoal);
    notifyListeners();
  }

  void toggleRemind(bool value) {
    remindEnabled = value;
    notifyListeners();
  }

  Future<bool> save() async {
    await Future.delayed(
      const Duration(milliseconds: 400),
    ); // TODO: repository.updateReviewSettings(...)
    return true; // screen điều hướng quay lại khi true
  }
}
