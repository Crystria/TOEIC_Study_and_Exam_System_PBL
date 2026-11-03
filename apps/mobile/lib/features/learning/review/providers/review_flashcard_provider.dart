import 'package:flutter/foundation.dart';

enum ReviewFlashcardStatus { idle, loading, loaded, finished }

class ReviewResultTally {
  int daThuoc = 0;
  int moHo = 0;
  int chuaThuoc = 0;
}

class ReviewFlashcardProvider extends ChangeNotifier {
  ReviewFlashcardStatus status = ReviewFlashcardStatus.idle;
  List<Map<String, String>> queue = [];
  int currentIndex = 0;
  final tally = ReviewResultTally();

  Future<void> loadQueue(List<String> wordIds) async {
    status = ReviewFlashcardStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 400));
    // TODO: repository.getWordsByIds(wordIds)
    queue = [
      {'id': 'v1', 'word': 'negotiate', 'definition': 'thương lượng'},
    ];
    currentIndex = 0;
    status = ReviewFlashcardStatus.loaded;
    notifyListeners();
  }

  Future<void> grade(int quality) async {
    await Future.delayed(const Duration(milliseconds: 300)); // TODO: repository.reviewFlashcard(...)
    if (quality <= 2) {
      tally.chuaThuoc++;
    } else if (quality <= 3) {
      tally.moHo++;
    } else {
      tally.daThuoc++;
    }

    if (currentIndex + 1 < queue.length) {
      currentIndex++;
    } else {
      status = ReviewFlashcardStatus.finished; // screen điều hướng sang ReviewResultScreen(tally: tally)
    }
    notifyListeners();
  }
}
