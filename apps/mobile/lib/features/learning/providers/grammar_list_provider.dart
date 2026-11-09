// ignore_for_file: prefer_initializing_formals
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';

import '../../../core/storage/grammar_progress_storage.dart';
import '../mock_data/grammar_catalog.dart';
import '../models/grammar_lesson.dart';
import '../repositories/learning_repository.dart';

enum GrammarListFetchStatus { idle, loading, loaded, error }

class GrammarListProvider extends ChangeNotifier {
  GrammarListProvider({
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

  GrammarListFetchStatus status = GrammarListFetchStatus.idle;
  List<GrammarLesson> _lessons = const [];
  final Set<String> _startedLessonIds = {};
  final Set<String> _completedLessonIds = {};
  String? errorMessage;
  String? persistenceError;
  int _scopeRevision = 0;

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
    final revision = _scopeRevision;
    final userIdAtStart = _currentUserId()?.trim();
    if (status == GrammarListFetchStatus.loading) return;
    if (status == GrammarListFetchStatus.loaded && !forceRefresh) return;

    status = GrammarListFetchStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      final loadedLessons = _repository == null
          ? await _loadMockLessons()
          : await _repository.getGrammarLessons();
      if (!_isCurrent(revision, userIdAtStart)) return;

      GrammarProgressSnapshot? progress;
      if (userIdAtStart != null && userIdAtStart.isNotEmpty) {
        progress = await _progressStorage.load(userIdAtStart);
        if (!_isCurrent(revision, userIdAtStart)) return;
      }

      _lessons = loadedLessons;
      _startedLessonIds
        ..clear()
        ..addAll(progress?.startedLessonIds ?? const <String>{});
      _completedLessonIds
        ..clear()
        ..addAll(progress?.completedLessonIds ?? const <String>{});
      status = GrammarListFetchStatus.loaded;
    } catch (error) {
      if (!_isCurrent(revision, userIdAtStart)) return;
      errorMessage = error is AppException
          ? error.message
          : 'Không thể tải danh sách bài học. Vui lòng thử lại.';
      status = GrammarListFetchStatus.error;
    }

    if (_isCurrent(revision, userIdAtStart)) notifyListeners();
  }

  Future<List<GrammarLesson>> _loadMockLessons() async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return GrammarCatalog.lessons;
  }

  bool _isCurrent(int revision, String? userId) =>
      revision == _scopeRevision && _currentUserId()?.trim() == userId;

  /// Resets all per-account state. The lesson content itself is public, but
  /// it is reloaded after an account transition to restore that user's progress.
  void resetForUserScopeChange() {
    _scopeRevision++;
    _lessons = const [];
    _startedLessonIds.clear();
    _completedLessonIds.clear();
    errorMessage = null;
    persistenceError = null;
    status = GrammarListFetchStatus.idle;
    notifyListeners();
  }

  void markLessonStarted(String lessonId) {
    if (_completedLessonIds.contains(lessonId) ||
        !_lessons.any((lesson) => lesson.id == lessonId)) {
      return;
    }
    if (_startedLessonIds.add(lessonId)) {
      final userId = _currentUserId()?.trim();
      if (userId != null && userId.isNotEmpty) {
        unawaited(_persistLessonStarted(userId, lessonId, _scopeRevision));
      }
      notifyListeners();
    }
  }

  Future<void> _persistLessonStarted(
    String userId,
    String lessonId,
    int revision,
  ) async {
    try {
      await _progressStorage.markStarted(userId, lessonId);
    } catch (_) {
      if (_isCurrent(revision, userId)) {
        persistenceError = 'Không thể lưu trạng thái đang học của bài Grammar.';
        notifyListeners();
      }
    }
  }

  void markLessonDone(String lessonId) {
    if (!_lessons.any((lesson) => lesson.id == lessonId)) return;
    _startedLessonIds.remove(lessonId);
    if (_completedLessonIds.add(lessonId)) notifyListeners();
  }
}
