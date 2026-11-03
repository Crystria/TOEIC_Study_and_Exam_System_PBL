import 'package:flutter/foundation.dart';

enum TodayReviewStatus { idle, loading, loaded }

class TodayReviewProvider extends ChangeNotifier {
  TodayReviewStatus status = TodayReviewStatus.idle;
  int goal = 20, reviewCount = 0, newCount = 0, estimateMinutes = 0;
  List<Map<String, String>> preview = [];

  Future<void> loadTodayReview() async {
    status = TodayReviewStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 500)); // TODO: repository.getReviewToday()
    reviewCount = 15;
    newCount = 5;
    estimateMinutes = 12;
    preview = [
      {'word': 'negotiate', 'meaning': 'thương lượng'},
    ];
    status = TodayReviewStatus.loaded;
    notifyListeners();
  }
}
