import '../../../core/errors/app_exception.dart';
import '../data_sources/local/learning_local_data_source.dart';
import '../data_sources/learning_content_data_source.dart';
import '../models/grammar_lesson.dart';
import '../models/learning_dtos.dart';
import '../models/learning_models.dart';
import '../models/learning_progress.dart';
import '../mappers/learning_dto_mapper.dart';
import '../requests/learning_request_dtos.dart';
import 'learning_repository.dart';

/// Development implementation of [LearningRepository]. Catalog content is
/// read from fixtures; mutable progress is always persisted by Local Data
/// Source and is never written back into the bundled JSON assets.
class TestDataLearningRepository implements LearningRepository {
  TestDataLearningRepository({
    required LearningContentDataSource testDataSource,
    required LearningLocalDataSource localDataSource,
    required String? Function() currentUserId,
  }) : _testData = testDataSource,
       _local = localDataSource,
       _currentUserId = currentUserId;

  static const int _pageSize = 50;
  final LearningContentDataSource _testData;
  final LearningLocalDataSource _local;
  final String? Function() _currentUserId;
  int _scopeRevision = 0;
  int _operationSequence = 0;
  final Set<String> _pendingOperations = {};
  List<LearningTopic>? _topicCache;
  final Map<String, List<LearningVocabulary>> _vocabularyCache = {};
  List<LearningVocabulary>? _allVocabularyCache;
  List<GrammarLesson>? _grammarCache;

  @override
  void resetForUserScopeChange() {
    _scopeRevision++;
    _pendingOperations.clear();
    _topicCache = null;
    _vocabularyCache.clear();
    _allVocabularyCache = null;
    _grammarCache = null;
  }

  @override
  Future<List<LearningTopic>> getTopics() async {
    final scope = _captureScope();
    final cached = _topicCache;
    if (cached != null) {
      _ensureScope(scope);
      return List.unmodifiable(cached);
    }
    final items = await _collectPages<LearningTopicDto>(
      (page) => _testData.listTopics(
        query: LearningPageQueryDto(page: page, size: _pageSize),
      ),
      scope,
    );
    final result = items.map(LearningDtoMapper.topic).toList(growable: false);
    _topicCache = result;
    return List.unmodifiable(result);
  }

  @override
  Future<LearningTopic> getTopic(String topicId) async {
    final scope = _captureScope();
    final result = LearningDtoMapper.topic(await _testData.getTopic(topicId));
    _ensureScope(scope);
    return result;
  }

  @override
  Future<List<LearningVocabulary>> getVocabularies({String? topicId}) async {
    final scope = _captureScope();
    final key = topicId?.trim() ?? '';
    final cached = key.isEmpty ? _allVocabularyCache : _vocabularyCache[key];
    if (cached != null) {
      _ensureScope(scope);
      return List.unmodifiable(cached);
    }

    final dtos = await _collectPages<LearningVocabularyDto>(
      (page) => _testData.listVocabularies(
        query: LearningPageQueryDto(
          page: page,
          size: _pageSize,
          topicId: key.isEmpty ? null : key,
        ),
      ),
      scope,
    );
    final topics = await getTopics();
    _ensureScope(scope);
    final topicNames = {for (final topic in topics) topic.id: topic.name};
    final result = dtos
        .map(
          (dto) => LearningDtoMapper.vocabulary(
            dto,
            topicName: topicNames[dto.topicId] ?? '',
          ),
        )
        .toList(growable: false);
    if (key.isEmpty) {
      _allVocabularyCache = result;
    } else {
      _vocabularyCache[key] = result;
    }
    return List.unmodifiable(result);
  }

  @override
  Future<LearningVocabulary> getVocabulary(String vocabularyId) async {
    final scope = _captureScope();
    final dto = await _testData.getVocabulary(vocabularyId);
    final topics = await getTopics();
    _ensureScope(scope);
    var topicName = '';
    for (final topic in topics) {
      if (topic.id == dto.topicId) {
        topicName = topic.name;
        break;
      }
    }
    return LearningDtoMapper.vocabulary(dto, topicName: topicName);
  }

  @override
  Future<List<GrammarLesson>> getGrammarLessons({String? category}) async {
    final scope = _captureScope();
    if (category == null || category.trim().isEmpty) {
      final cached = _grammarCache;
      if (cached != null) {
        _ensureScope(scope);
        return List.unmodifiable(cached);
      }
    }
    final dtos = await _collectPages<LearningGrammarLessonDto>(
      (page) => _testData.listGrammarLessons(
        query: LearningPageQueryDto(
          page: page,
          size: _pageSize,
          category: category,
        ),
      ),
      scope,
    );
    final result = dtos
        .map(LearningDtoMapper.grammarLesson)
        .toList(growable: false);
    if (category == null || category.trim().isEmpty) _grammarCache = result;
    return List.unmodifiable(result);
  }

  @override
  Future<GrammarLesson> getGrammarLesson(String lessonId) async {
    final scope = _captureScope();
    final result = LearningDtoMapper.grammarLesson(
      await _testData.getGrammarLesson(lessonId),
    );
    _ensureScope(scope);
    return result;
  }

  @override
  Future<List<LearningReviewProgress>> getDueProgress({String? topicId}) async {
    final scope = _captureScope();
    final dtos = await _collectPages<LearningReviewProgressDto>(
      (page) => _testData.listDueReviews(
        query: LearningPageQueryDto(
          page: page,
          size: _pageSize,
          topicId: topicId,
        ),
      ),
      scope,
    );
    final localProgress = await _local.loadVocabularyProgress();
    _ensureScope(scope);

    // A fixture defines the initial review queue. Once a learner grades a
    // flashcard, the user-owned local record overrides fixture mastery and
    // revision so subsequent reads reflect the mutation.
    return List.unmodifiable(
      dtos.map((dto) {
        final saved = localProgress.words[dto.entityId];
        final fixtureProgress = LearningDtoMapper.reviewProgress(dto);
        return LearningReviewProgress(
          entityId: fixtureProgress.entityId,
          revision: saved?.serverRevision ?? fixtureProgress.revision,
          quality: saved?.grade ?? fixtureProgress.quality,
          nextReviewDate: fixtureProgress.nextReviewDate,
        );
      }),
    );
  }

  @override
  Future<List<DueLearningVocabulary>> getDueVocabulary({
    String? topicId,
  }) async {
    final scope = _captureScope();
    final progress = await getDueProgress(topicId: topicId);
    final vocabularies = await getVocabularies(topicId: topicId);
    _ensureScope(scope);
    final byId = {for (final item in vocabularies) item.id: item};
    return List.unmodifiable(
      progress
          .where((item) => byId.containsKey(item.entityId))
          .map(
            (item) => DueLearningVocabulary(
              vocabulary: byId[item.entityId]!,
              revision: item.revision,
              quality: item.quality,
              nextReviewDate: item.nextReviewDate,
            ),
          ),
    );
  }

  @override
  Future<List<DueLearningVocabulary>> getDueVocabularyPreview({
    String? topicId,
    int limit = 2,
  }) async {
    if (limit < 1 || limit > _pageSize) {
      throw ArgumentError.value(limit, 'limit');
    }
    final due = await getDueVocabulary(topicId: topicId);
    return List.unmodifiable(due.take(limit));
  }

  @override
  Future<LearningProgressSummary> getProgressSummary() async {
    final scope = _captureScope();
    final fixtureSummary = await _testData.getProgressSummary();
    final vocabularyProgress = await _local.loadVocabularyProgress();
    final grammarProgress = scope.userId == null
        ? LearningGrammarProgress.empty()
        : await _local.loadGrammarProgress(scope.userId!);
    final due = await getDueProgress();
    _ensureScope(scope);
    return LearningProgressSummary(
      reviewedVocabularies: vocabularyProgress.totalLearnedWords,
      vocabulariesLearned: vocabularyProgress.totalLearnedWords,
      dueVocabularies: due.length,
      grammarLessonsCompleted: grammarProgress.completedLessonIds.length,
      sessionsCompleted: fixtureSummary.sessionsCompleted,
      updatedAt: fixtureSummary.updatedAt,
    );
  }

  @override
  Future<LearningMutationReceipt> reviewFlashcard({
    required String vocabularyId,
    required int quality,
    required String baseEntityRevision,
  }) async {
    if (quality < 0 || quality > 5) {
      throw ArgumentError.value(quality, 'quality');
    }
    final scope = _captureScope();
    final operationId = _newOperationId(
      scope.userId,
      'vocabulary',
      vocabularyId,
    );
    final dto = await _testData.reviewFlashcard(
      vocabularyId: vocabularyId,
      request: ReviewFlashcardRequestDto(
        operationId: operationId,
        quality: quality,
        baseEntityRevision: baseEntityRevision,
      ),
    );
    _ensureScope(scope);
    if (dto.operationId != operationId || dto.entityId != vocabularyId) {
      throw const FormatException(
        'Test Data returned a mismatched vocabulary mutation receipt.',
      );
    }
    _pendingOperations.add(operationId);
    return LearningDtoMapper.mutationReceipt(dto);
  }

  @override
  Future<LearningMutationReceipt> completeGrammarLesson({
    required String lessonId,
    required String baseEntityRevision,
  }) async {
    final scope = _captureScope();
    final operationId = _newOperationId(scope.userId, 'grammar', lessonId);
    final dto = await _testData.completeGrammarLesson(
      lessonId: lessonId,
      request: CompleteGrammarLessonRequestDto(
        operationId: operationId,
        baseEntityRevision: baseEntityRevision,
      ),
    );
    _ensureScope(scope);
    if (dto.operationId != operationId || dto.entityId != lessonId) {
      throw const FormatException(
        'Test Data returned a mismatched Grammar mutation receipt.',
      );
    }
    _pendingOperations.add(operationId);
    return LearningDtoMapper.mutationReceipt(dto);
  }

  @override
  Future<void> acknowledgeMutation({
    required String userId,
    required String operationId,
  }) async {
    final scope = _captureScope();
    if (scope.userId != userId.trim() ||
        !_pendingOperations.contains(operationId)) {
      throw const AppException.cancelled(
        message: 'Không thể xác nhận thao tác của tài khoản khác.',
      );
    }
    _pendingOperations.remove(operationId);
    _ensureScope(scope);
  }

  @override
  Future<LearningVocabularyProgress> getVocabularyProgress() =>
      _local.loadVocabularyProgress();

  @override
  Future<bool> hasUnassignedLegacyProgress() async {
    final scope = _captureScope();
    final hasLegacyData = await _local.hasUnassignedLegacyProgress();
    _ensureScope(scope);
    return hasLegacyData;
  }

  @override
  Future<LearningVocabularyProgress> importUnassignedLegacyProgress({
    required bool confirmOwnership,
  }) async {
    final scope = _captureScope();
    final progress = await _local.importUnassignedLegacyProgress(
      confirmOwnership: confirmOwnership,
    );
    _ensureScope(scope);
    return progress;
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
  }) => _local.recordStudiedWord(
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

  @override
  Future<LearningVocabularyProgress> saveDailyGoal(int goal) =>
      _local.saveDailyGoal(goal);

  @override
  Future<LearningVocabularyProgress> saveReviewSettings({
    required int dailyGoal,
    required bool remindEnabled,
  }) => _local.saveReviewSettings(
    dailyGoal: dailyGoal,
    remindEnabled: remindEnabled,
  );

  @override
  Future<LearningGrammarProgress> getGrammarProgress(String userId) async {
    final scope = _captureScope();
    _ensureRequestedUser(scope, userId);
    final progress = await _local.loadGrammarProgress(userId);
    _ensureScope(scope);
    return progress;
  }

  @override
  Future<void> markGrammarLessonStarted(String userId, String lessonId) async {
    final scope = _captureScope();
    _ensureRequestedUser(scope, userId);
    await _local.markGrammarLessonStarted(userId, lessonId);
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
      userId,
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
    final revision = await _local.grammarLessonRevision(userId, lessonId);
    _ensureScope(scope);
    return revision;
  }

  Future<List<T>> _collectPages<T>(
    Future<LearningPageDto<T>> Function(int page) loadPage,
    _TestDataScope scope,
  ) async {
    final result = <T>[];
    var page = 1;
    var totalPages = 1;
    while (page <= totalPages) {
      _ensureScope(scope);
      final response = await loadPage(page);
      _ensureScope(scope);
      if (response.page != page) {
        throw const FormatException(
          'Test Data pagination returned an unexpected page.',
        );
      }
      if (page > 1 && response.totalPages != totalPages) {
        throw const FormatException('Test Data changed during pagination.');
      }
      result.addAll(response.items);
      totalPages = response.totalPages;
      page++;
      if (page > 500)
        throw const FormatException('Test Data pagination limit exceeded.');
    }
    return result;
  }

  _TestDataScope _captureScope() => _TestDataScope(
    userId: _currentUserId()?.trim(),
    revision: _scopeRevision,
  );

  void _ensureRequestedUser(_TestDataScope scope, String userId) {
    final activeUserId = scope.userId;
    if (activeUserId == null || activeUserId.isEmpty) {
      throw const AppException.unauthorized(
        message: 'Bạn cần đăng nhập để truy cập tiến trình Grammar.',
      );
    }
    if (activeUserId != userId.trim()) {
      throw const AppException.cancelled(
        message: 'Không thể truy cập tiến trình Grammar của tài khoản khác.',
      );
    }
    _ensureScope(scope);
  }

  void _ensureScope(_TestDataScope scope) {
    if (scope.revision != _scopeRevision ||
        _currentUserId()?.trim() != scope.userId) {
      throw const AppException.cancelled(
        message: 'Yêu cầu học tập đã bị hủy do tài khoản thay đổi.',
      );
    }
  }

  String _newOperationId(String? userId, String type, String entityId) =>
      'test-${Uri.encodeComponent(userId ?? 'anonymous')}-$type-${Uri.encodeComponent(entityId)}-${++_operationSequence}';
}

class _TestDataScope {
  const _TestDataScope({required this.userId, required this.revision});

  final String? userId;
  final int revision;
}
