import 'package:flutter/foundation.dart';

enum LessonStatus { done, inProgress, notStarted }

class GrammarLessonSummary {
  const GrammarLessonSummary({required this.id, required this.title, required this.category, required this.status});
  final String id;
  final String title;
  final String category;
  final LessonStatus status;
}

enum GrammarListFetchStatus { idle, loading, loaded }

class GrammarListProvider extends ChangeNotifier {
  GrammarListFetchStatus status = GrammarListFetchStatus.idle;
  List<GrammarLessonSummary> lessons = [];

  Future<void> loadLessons() async {
    status = GrammarListFetchStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 500));
    // TODO: repository.getLessons()
    lessons = const [
      GrammarLessonSummary(id: 'g1', title: 'Thì của động từ', category: 'Động từ', status: LessonStatus.done),
    ];
    status = GrammarListFetchStatus.loaded;
    notifyListeners();
  }
}
