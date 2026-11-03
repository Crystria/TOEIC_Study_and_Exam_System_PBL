import 'package:flutter/foundation.dart';

enum TestFilter { all, fullTest, byPart }

class MockTestListItem {
  const MockTestListItem({required this.id, required this.tag, required this.done, required this.title, required this.meta, this.bestScore});
  final String id;
  final String tag;
  final bool done;
  final String title;
  final String meta;
  final int? bestScore;
}

enum TestSelectStatus { idle, loading, loaded }

class MockTestSelectProvider extends ChangeNotifier {
  TestSelectStatus status = TestSelectStatus.idle;
  List<MockTestListItem> _allTests = [];
  TestFilter filter = TestFilter.all;

  List<MockTestListItem> get filteredTests {
    switch (filter) {
      case TestFilter.all:
        return _allTests;
      case TestFilter.fullTest:
        return _allTests.where((t) => t.tag == 'Đề đầy đủ').toList();
      case TestFilter.byPart:
        return _allTests.where((t) => t.tag == 'Luyện theo Part').toList();
    }
  }

  Future<void> loadTests() async {
    status = TestSelectStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 500));
    // TODO: repository.getTests()
    _allTests = const [
      MockTestListItem(id: 'ets-2026-05', tag: 'Đề đầy đủ', done: true, title: 'ETS-2026-05 · Đề đầy đủ', meta: '200 câu · 120 phút', bestScore: 735),
    ];
    status = TestSelectStatus.loaded;
    notifyListeners();
  }

  void changeFilter(TestFilter f) {
    filter = f;
    notifyListeners();
  }
}
