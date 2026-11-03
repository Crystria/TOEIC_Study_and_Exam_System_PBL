import 'package:flutter/foundation.dart';

enum TestHistoryFilter { all, fullTest, byPart }

class TestHistoryItem {
  const TestHistoryItem({required this.id, required this.title, required this.dateLabel, required this.score, required this.tag});
  final String id;
  final String title;
  final String dateLabel;
  final int score;
  final String tag;
}

enum TestHistoryFetchStatus { idle, loading, loaded }

class TestHistoryProvider extends ChangeNotifier {
  TestHistoryFetchStatus status = TestHistoryFetchStatus.idle;
  List<TestHistoryItem> _items = [];
  TestHistoryFilter filter = TestHistoryFilter.all;

  List<TestHistoryItem> get filteredItems {
    switch (filter) {
      case TestHistoryFilter.all:
        return _items;
      case TestHistoryFilter.fullTest:
        return _items.where((i) => i.tag == 'Đề đầy đủ').toList();
      case TestHistoryFilter.byPart:
        return _items.where((i) => i.tag == 'Luyện theo Part').toList();
    }
  }

  Future<void> loadHistory() async {
    status = TestHistoryFetchStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 500));
    // TODO: repository.getAttemptHistory()
    _items = const [
      TestHistoryItem(id: 'a1', title: 'ETS-2026-05 · Đề đầy đủ', dateLabel: '15/10/2026', score: 735, tag: 'Đề đầy đủ'),
    ];
    status = TestHistoryFetchStatus.loaded;
    notifyListeners();
  }

  void changeFilter(TestHistoryFilter f) {
    filter = f;
    notifyListeners();
  }
}
