import 'package:flutter/foundation.dart';

enum WordMastery { chuaThuoc, moHo, daThuoc }

class ReviewWord {
  ReviewWord({required this.id, required this.word, required this.meaning, required this.mastery, this.selected = false});
  final String id;
  final String word;
  final String meaning;
  final WordMastery mastery;
  bool selected;
}

enum ReviewSelectStatus { idle, loading, loaded, error }

class ReviewSelectWordsProvider extends ChangeNotifier {
  ReviewSelectStatus status = ReviewSelectStatus.idle;
  List<ReviewWord> words = [];

  List<String> get selectedIds => words.where((w) => w.selected).map((w) => w.id).toList();

  Future<void> loadDueWords(String topicId) async {
    status = ReviewSelectStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 500));
    // TODO: repository.getReviewToday(topicId)
    words = [
      ReviewWord(id: 'v1', word: 'negotiate', meaning: 'thương lượng', mastery: WordMastery.moHo, selected: true),
      ReviewWord(id: 'v2', word: 'invoice', meaning: 'hóa đơn', mastery: WordMastery.chuaThuoc, selected: true),
    ];
    status = ReviewSelectStatus.loaded;
    notifyListeners();
  }

  void toggle(String id) {
    final w = words.firstWhere((w) => w.id == id);
    w.selected = !w.selected;
    notifyListeners();
  }

  void selectAll() {
    for (final w in words) {
      w.selected = true;
    }
    notifyListeners();
  }
}
