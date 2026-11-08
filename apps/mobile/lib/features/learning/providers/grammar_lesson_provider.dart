import 'package:flutter/foundation.dart';

import '../mock_data/grammar_catalog.dart';
import '../models/grammar_lesson.dart';

enum GrammarLessonFetchStatus { idle, loading, loaded, markingDone, error }

class GrammarLessonProvider extends ChangeNotifier {
  GrammarLessonFetchStatus status = GrammarLessonFetchStatus.idle;
  GrammarLesson? lesson;
  String? errorMessage;
  String? completionErrorMessage;
  int _loadRequestToken = 0;

  Future<void> loadLesson(String id) async {
    if (status == GrammarLessonFetchStatus.loading && lesson?.id == id) {
      return;
    }

    final requestToken = ++_loadRequestToken;
    status = GrammarLessonFetchStatus.loading;
    lesson = null;
    errorMessage = null;
    notifyListeners();

    try {
      // Mock loading. Replace this source with GrammarRepository later.
      await Future.delayed(const Duration(milliseconds: 250));
      if (requestToken != _loadRequestToken) return;
      final loadedLesson = GrammarCatalog.findById(id);
      if (loadedLesson == null) {
        throw StateError('Grammar lesson not found: $id');
      }
      lesson = loadedLesson;
      completionErrorMessage = null;
      status = GrammarLessonFetchStatus.loaded;
    } catch (_) {
      if (requestToken != _loadRequestToken) return;
      errorMessage =
          'Không tìm thấy nội dung bài học hoặc đã xảy ra lỗi tải dữ liệu.';
      status = GrammarLessonFetchStatus.error;
    }

    notifyListeners();
  }

  Future<bool> markDone() async {
    if (status != GrammarLessonFetchStatus.loaded || lesson == null) {
      return false;
    }

    status = GrammarLessonFetchStatus.markingDone;
    completionErrorMessage = null;
    notifyListeners();

    var completed = false;
    try {
      // Mock completion. Replace with GrammarRepository.completeLesson later.
      await Future.delayed(const Duration(milliseconds: 200));
      completed = true;
    } catch (_) {
      completionErrorMessage =
          'Không thể cập nhật trạng thái bài học. Vui lòng thử lại.';
    } finally {
      status = GrammarLessonFetchStatus.loaded;
      notifyListeners();
    }

    return completed;
  }
}
