// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/storage/grammar_progress_storage.dart';
import '../mock_data/grammar_catalog.dart';
import '../models/grammar_lesson.dart';
import '../models/learning_models.dart';
import '../repositories/learning_repository.dart';

enum GrammarLessonFetchStatus { idle, loading, loaded, markingDone, error }

class GrammarLessonProvider extends ChangeNotifier {
  GrammarLessonProvider({
    LearningRepository? repository,
    GrammarProgressStorage? progressStorage,
    String? Function()? currentUserId,
  }) : _repository = repository,
       _progressStorage = progressStorage ?? GrammarProgressStorage(),
       _currentUserId = currentUserId ?? _noUser;

  static String? _noUser() => null;

  final LearningRepository? _repository;
  final GrammarProgressStorage _progressStorage;
  final String? Function() _currentUserId;

  GrammarLessonFetchStatus status = GrammarLessonFetchStatus.idle;
  GrammarLesson? lesson;
  String? errorMessage;
  String? completionErrorMessage;
  int _loadRequestToken = 0;
  int _scopeRevision = 0;

  void resetForUserScopeChange() {
    _scopeRevision++;
    _loadRequestToken++;
    status = GrammarLessonFetchStatus.idle;
    lesson = null;
    errorMessage = null;
    completionErrorMessage = null;
    notifyListeners();
  }

  Future<void> loadLesson(String id) async {
    if (status == GrammarLessonFetchStatus.loading && lesson?.id == id) {
      return;
    }

    final scopeRevision = _scopeRevision;
    final requestToken = ++_loadRequestToken;
    final userIdAtStart = _currentUserId();
    status = GrammarLessonFetchStatus.loading;
    lesson = null;
    errorMessage = null;
    notifyListeners();

    try {
      final loadedLesson = _repository == null
          ? await _loadMockLesson(id)
          : await _repository.getGrammarLesson(id);
      if (!_isCurrent(scopeRevision, requestToken, userIdAtStart)) return;
      lesson = loadedLesson;
      completionErrorMessage = null;
      status = GrammarLessonFetchStatus.loaded;
    } catch (error) {
      if (!_isCurrent(scopeRevision, requestToken, userIdAtStart)) return;
      errorMessage = error is AppException
          ? error.message
          : 'Không tìm thấy nội dung bài học hoặc đã xảy ra lỗi tải dữ liệu.';
      status = GrammarLessonFetchStatus.error;
    }

    if (_isCurrent(scopeRevision, requestToken, userIdAtStart)) {
      notifyListeners();
    }
  }

  Future<GrammarLesson> _loadMockLesson(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    final loadedLesson = GrammarCatalog.findById(id);
    if (loadedLesson == null) {
      throw StateError('Grammar lesson not found: $id');
    }
    return loadedLesson;
  }

  bool _isCurrent(int scopeRevision, int requestToken, String? userId) =>
      scopeRevision == _scopeRevision &&
      requestToken == _loadRequestToken &&
      _currentUserId() == userId;

  Future<bool> markDone() async {
    final currentLesson = lesson;
    if (status != GrammarLessonFetchStatus.loaded || currentLesson == null) {
      return false;
    }

    final scopeRevision = _scopeRevision;
    final requestToken = _loadRequestToken;
    final userId = _currentUserId();
    status = GrammarLessonFetchStatus.markingDone;
    completionErrorMessage = null;
    notifyListeners();

    try {
      LearningMutationReceipt? receipt;
      if (_repository != null) {
        if (userId == null || userId.trim().isEmpty) {
          throw const AppException.unauthorized(
            message: 'Bạn cần đăng nhập để lưu tiến trình Grammar.',
          );
        }
        final baseRevision = await _progressStorage.revisionFor(
          userId,
          currentLesson.id,
        );
        if (!_isCurrent(scopeRevision, requestToken, userId)) return false;
        receipt = await _repository.completeGrammarLesson(
          lessonId: currentLesson.id,
          baseEntityRevision: baseRevision,
        );
        if (!_isCurrent(scopeRevision, requestToken, userId)) return false;
      } else {
        await Future<void>.delayed(const Duration(milliseconds: 200));
        if (!_isCurrent(scopeRevision, requestToken, userId)) return false;
      }

      if (userId != null && userId.trim().isNotEmpty) {
        await _progressStorage.markCompleted(
          userId,
          currentLesson.id,
          revision: receipt?.revision ?? '1',
        );
        if (!_isCurrent(scopeRevision, requestToken, userId)) return false;
      }

      if (receipt != null && userId != null) {
        await _repository!.acknowledgeMutation(
          userId: userId,
          operationId: receipt.operationId,
        );
        if (!_isCurrent(scopeRevision, requestToken, userId)) return false;
      }
      return true;
    } catch (error) {
      if (!_isCurrent(scopeRevision, requestToken, userId)) return false;
      completionErrorMessage = error is AppException
          ? error.message
          : 'Không thể cập nhật trạng thái bài học. Vui lòng thử lại.';
      return false;
    } finally {
      if (_isCurrent(scopeRevision, requestToken, userId)) {
        status = GrammarLessonFetchStatus.loaded;
        notifyListeners();
      }
    }
  }
}
