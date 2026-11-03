import 'package:flutter/foundation.dart';

enum GrammarLessonFetchStatus { idle, loading, loaded, markingDone }

class GrammarLessonProvider extends ChangeNotifier {
  GrammarLessonFetchStatus status = GrammarLessonFetchStatus.idle;
  String? title, category, contentMarkdown;
  bool isDone = false;

  Future<void> loadLesson(String lessonId) async {
    status = GrammarLessonFetchStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 400));
    // TODO: repository.getLesson(lessonId)
    title = 'Giới từ chỉ thời gian: in, on, at, by';
    category = 'Giới từ';
    status = GrammarLessonFetchStatus.loaded;
    notifyListeners();
  }

  Future<void> markDone() async {
    status = GrammarLessonFetchStatus.markingDone;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 300)); // TODO: repository.completeLesson(lessonId)
    isDone = true;
    status = GrammarLessonFetchStatus.loaded;
    notifyListeners();
  }
}
