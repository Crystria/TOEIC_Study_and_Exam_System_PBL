import 'package:flutter/foundation.dart';

import 'review_select_words_provider.dart';

enum ReviewFlashcardStatus { idle, loading, loaded, finished }

class ReviewResultTally {
  int daThuoc = 0;
  int moHo = 0;
  int chuaThuoc = 0;

  int get total => daThuoc + moHo + chuaThuoc;

  void reset() {
    daThuoc = 0;
    moHo = 0;
    chuaThuoc = 0;
  }
}

class ReviewFlashcardProvider extends ChangeNotifier {
  ReviewFlashcardStatus status = ReviewFlashcardStatus.idle;
  List<ReviewWord> queue = [];
  int currentIndex = 0;
  bool isGrading = false;
  final ReviewResultTally tally = ReviewResultTally();

  ReviewWord? get currentWord =>
      currentIndex >= 0 && currentIndex < queue.length
      ? queue[currentIndex]
      : null;
  int get totalCards => queue.length;
  double get progress => totalCards == 0 ? 0 : (currentIndex + 1) / totalCards;

  Future<void> loadQueue(List<ReviewWord> words) async {
    status = ReviewFlashcardStatus.loading;
    notifyListeners();
    await Future<void>.delayed(const Duration(milliseconds: 200));
    queue = List<ReviewWord>.of(words);
    currentIndex = 0;
    isGrading = false;
    tally.reset();
    status = queue.isEmpty
        ? ReviewFlashcardStatus.finished
        : ReviewFlashcardStatus.loaded;
    notifyListeners();
  }

  Future<void> grade(int quality) async {
    if (status != ReviewFlashcardStatus.loaded ||
        isGrading ||
        currentWord == null) {
      return;
    }
    isGrading = true;
    notifyListeners();
    await Future<void>.delayed(const Duration(milliseconds: 200));

    if (quality <= 2) {
      tally.chuaThuoc++;
    } else if (quality <= 3) {
      tally.moHo++;
    } else {
      tally.daThuoc++;
    }

    if (currentIndex + 1 < queue.length) {
      currentIndex++;
      isGrading = false;
    } else {
      status = ReviewFlashcardStatus.finished;
      isGrading = false;
    }
    notifyListeners();
  }

  void reset() {
    status = ReviewFlashcardStatus.idle;
    queue = [];
    currentIndex = 0;
    isGrading = false;
    tally.reset();
    notifyListeners();
  }
}
