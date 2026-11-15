import '../../../core/errors/app_exception.dart';
import '../data_sources/local/learning_local_data_source.dart';
import '../models/learning_progress.dart';

/// Owns device-persisted Learning state that is not exposed as a complete
/// read/write resource by the current Backend contract.
///
/// This repository is shared by API and Test Data modes. It deliberately does
/// not depend on a LearningRepository implementation.
abstract interface class LearningLocalStateRepository {
  Future<LearningVocabularyProgress> getVocabularyProgress();

  Future<bool> hasUnassignedLegacyProgress();

  Future<LearningVocabularyProgress> importUnassignedLegacyProgress({
    required bool confirmOwnership,
  });

  Future<LearningVocabularyProgress> recordStudiedVocabulary({
    required String wordId,
    required String word,
    required String phonetic,
    required String definition,
    required String example,
    required String audioUrl,
    required String topicId,
    required String topicName,
    required int grade,
    String? serverRevision,
  });

  Future<LearningVocabularyProgress> saveDailyGoal(int goal);

  Future<LearningVocabularyProgress> saveReviewSettings({
    required int dailyGoal,
    required bool remindEnabled,
  });

  Future<LearningGrammarProgress> getGrammarProgress(String userId);

  Future<void> markGrammarLessonStarted(String userId, String lessonId);

  Future<void> markGrammarLessonCompleted(
    String userId,
    String lessonId, {
    String? revision,
  });

  Future<String> getGrammarLessonRevision(String userId, String lessonId);

  /// Invalidates in-flight operations after an account transition.
  /// Persisted records are not deleted.
  void resetForUserScopeChange();
}

class ScopedLearningLocalStateRepository
    implements LearningLocalStateRepository {
  ScopedLearningLocalStateRepository({
    required LearningLocalDataSource localDataSource,
    required String? Function() currentUserId,
  }) : _local = localDataSource,
       _currentUserId = currentUserId;

  final LearningLocalDataSource _local;
  final String? Function() _currentUserId;

  int _scopeRevision = 0;

  @override
  void resetForUserScopeChange() {
    _scopeRevision++;
  }

  @override
  Future<LearningVocabularyProgress> getVocabularyProgress() async {
    // Preserve the existing pre-authentication behavior: the vocabulary
    // storage returns an empty snapshot while it is unbound to a user.
    final scope = _captureScope(allowAnonymous: true);
    final progress = await _local.loadVocabularyProgress();
    _ensureScope(scope);
    return progress;
  }

  @override
  Future<bool> hasUnassignedLegacyProgress() async {
    final scope = _captureScope();
    final result = await _local.hasUnassignedLegacyProgress();
    _ensureScope(scope);
    return result;
  }

  @override
  Future<LearningVocabularyProgress> importUnassignedLegacyProgress({
    required bool confirmOwnership,
  }) async {
    final scope = _captureScope();
    final result = await _local.importUnassignedLegacyProgress(
      confirmOwnership: confirmOwnership,
    );
    _ensureScope(scope);
    return result;
  }

  @override
  Future<LearningVocabularyProgress> recordStudiedVocabulary({
    required String wordId,
    required String word,
    required String phonetic,
    required String definition,
    required String example,
    required String audioUrl,
    required String topicId,
    required String topicName,
    required int grade,
    String? serverRevision,
  }) async {
    final scope = _captureScope();
    final result = await _local.recordStudiedWord(
      wordId: wordId,
      word: word,
      phonetic: phonetic,
      definition: definition,
      example: example,
      audioUrl: audioUrl,
      topicId: topicId,
      topicName: topicName,
      grade: grade,
      serverRevision: serverRevision,
    );
    _ensureScope(scope);
    return result;
  }

  @override
  Future<LearningVocabularyProgress> saveDailyGoal(int goal) async {
    final scope = _captureScope();
    final result = await _local.saveDailyGoal(goal);
    _ensureScope(scope);
    return result;
  }

  @override
  Future<LearningVocabularyProgress> saveReviewSettings({
    required int dailyGoal,
    required bool remindEnabled,
  }) async {
    final scope = _captureScope();
    final result = await _local.saveReviewSettings(
      dailyGoal: dailyGoal,
      remindEnabled: remindEnabled,
    );
    _ensureScope(scope);
    return result;
  }

  @override
  Future<LearningGrammarProgress> getGrammarProgress(String userId) async {
    final scope = _captureScope();
    _ensureRequestedUser(scope, userId);
    final result = await _local.loadGrammarProgress(scope.userId);
    _ensureScope(scope);
    return result;
  }

  @override
  Future<void> markGrammarLessonStarted(String userId, String lessonId) async {
    final scope = _captureScope();
    _ensureRequestedUser(scope, userId);
    await _local.markGrammarLessonStarted(scope.userId, lessonId);
    _ensureScope(scope);
  }

  @override
  Future<void> markGrammarLessonCompleted(
    String userId,
    String lessonId, {
    String? revision,
  }) async {
    final scope = _captureScope();
    _ensureRequestedUser(scope, userId);
    await _local.markGrammarLessonCompleted(
      scope.userId,
      lessonId,
      revision: revision,
    );
    _ensureScope(scope);
  }

  @override
  Future<String> getGrammarLessonRevision(
    String userId,
    String lessonId,
  ) async {
    final scope = _captureScope();
    _ensureRequestedUser(scope, userId);
    final result = await _local.grammarLessonRevision(scope.userId, lessonId);
    _ensureScope(scope);
    return result;
  }

  _LocalLearningScope _captureScope({bool allowAnonymous = false}) {
    final userId = _currentUserId()?.trim();
    if (!allowAnonymous && (userId == null || userId.isEmpty)) {
      throw const AppException.unauthorized(
        message: 'Bạn cần đăng nhập để sử dụng dữ liệu học tập.',
      );
    }
    return _LocalLearningScope(
      userId: userId == null || userId.isEmpty ? null : userId,
      revision: _scopeRevision,
    );
  }

  void _ensureRequestedUser(_LocalLearningScope scope, String requestedUserId) {
    if (scope.userId == null || scope.userId != requestedUserId.trim()) {
      throw const AppException.cancelled(
        message: 'Không thể truy cập tiến trình của tài khoản khác.',
      );
    }
    _ensureScope(scope);
  }

  void _ensureScope(_LocalLearningScope scope) {
    final currentUserId = _currentUserId()?.trim();
    final normalizedCurrentUserId =
        currentUserId == null || currentUserId.isEmpty ? null : currentUserId;
    if (scope.revision != _scopeRevision ||
        normalizedCurrentUserId != scope.userId) {
      throw const AppException.cancelled(
        message: 'Yêu cầu học tập đã bị hủy do tài khoản thay đổi.',
      );
    }
  }
}

class _LocalLearningScope {
  const _LocalLearningScope({required this.userId, required this.revision});

  final String? userId;
  final int revision;
}
