import 'package:flutter/foundation.dart';

import '../mock_data/grammar_catalog.dart';
import '../models/grammar_lesson.dart';

enum GrammarListFetchStatus { idle, loading, loaded, error }

class GrammarListProvider extends ChangeNotifier {
  GrammarListFetchStatus status = GrammarListFetchStatus.idle;
  List<GrammarLesson> _lessons = const [];
  final Set<String> _startedLessonIds = {};
  final Set<String> _completedLessonIds = {};
  String? errorMessage;

  List<GrammarLesson> get lessons => List.unmodifiable(_lessons);

  int get completedCount => _completedLessonIds.length;

  int get totalCount => _lessons.length;

  double get completionRate =>
      totalCount == 0 ? 0 : completedCount / totalCount;

  GrammarProgressStatus lessonStatus(String lessonId) {
    if (_completedLessonIds.contains(lessonId)) {
      return GrammarProgressStatus.completed;
    }
    if (_startedLessonIds.contains(lessonId)) {
      return GrammarProgressStatus.inProgress;
    }
    return GrammarProgressStatus.notStarted;
  }

  bool isLessonCompleted(String lessonId) =>
      _completedLessonIds.contains(lessonId);

  Future<void> loadLessons({bool forceRefresh = false}) async {
    if (status == GrammarListFetchStatus.loading) return;
    if (status == GrammarListFetchStatus.loaded && !forceRefresh) return;

    status = GrammarListFetchStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      // Mock loading. Replace this source with GrammarRepository later.
      await Future.delayed(const Duration(milliseconds: 300));
      _lessons = GrammarCatalog.lessons;
      status = GrammarListFetchStatus.loaded;
    } catch (_) {
      errorMessage = 'Không thể tải danh sách bài học. Vui lòng thử lại.';
      status = GrammarListFetchStatus.error;
    }

    notifyListeners();
  }

  void markLessonStarted(String lessonId) {
    if (_completedLessonIds.contains(lessonId) ||
        !_lessons.any((lesson) => lesson.id == lessonId)) {
      return;
    }
    if (_startedLessonIds.add(lessonId)) notifyListeners();
  }

  void markLessonDone(String lessonId) {
    if (!_lessons.any((lesson) => lesson.id == lessonId)) return;
    _startedLessonIds.remove(lessonId);
    if (_completedLessonIds.add(lessonId)) notifyListeners();
  }
}
