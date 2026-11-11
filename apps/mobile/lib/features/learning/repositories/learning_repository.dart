// ignore_for_file: prefer_initializing_formals
import '../../../core/errors/app_exception.dart';
import '../models/grammar_lesson.dart';
import '../models/learning_dtos.dart';
import '../models/learning_models.dart';
import '../requests/learning_request_dtos.dart';
import '../services/learning_api_service.dart';
import 'learning_sync_journal.dart';

abstract interface class LearningRepository {
  Future<List<LearningTopic>> getTopics();
  Future<LearningTopic> getTopic(String topicId);
  Future<List<LearningVocabulary>> getVocabularies({String? topicId});
  Future<LearningVocabulary> getVocabulary(String vocabularyId);
  Future<List<GrammarLesson>> getGrammarLessons({String? category});
  Future<GrammarLesson> getGrammarLesson(String lessonId);
  Future<List<LearningReviewProgress>> getDueProgress({String? topicId});
  Future<List<DueLearningVocabulary>> getDueVocabulary({String? topicId});
  Future<List<DueLearningVocabulary>> getDueVocabularyPreview({
    String? topicId,
    int limit = 2,
  });
  Future<LearningProgressSummary> getProgressSummary();
  Future<LearningMutationReceipt> reviewFlashcard({
    required String vocabularyId,
    required int quality,
    required String baseEntityRevision,
  });
  Future<LearningMutationReceipt> completeGrammarLesson({
    required String lessonId,
    required String baseEntityRevision,
  });
  Future<void> acknowledgeMutation({
    required String userId,
    required String operationId,
  });
  void resetForUserScopeChange();
}

/// API implementation shared by Vocabulary, Review and Grammar Providers.
///
/// Repository policy:
/// - paginates the Backend's maximum size of 50;
/// - joins due-review snapshots with vocabulary content;
/// - keeps write operation IDs in a user-scoped durable journal;
/// - never retries a non-idempotent write with a new operation ID after a
///   network failure;
/// - invalidates in-flight reads when the account scope changes.
class ApiLearningRepository implements LearningRepository {
  ApiLearningRepository({
    required LearningApiService api,
    required String? Function() currentUserId,
    LearningSyncJournal? syncJournal,
  }) : _api = api,
       _currentUserId = currentUserId,
       _syncJournal = syncJournal ?? LearningSyncJournal();

  static const int _pageSize = 50;
  static const int _maximumPages = 500;

  final LearningApiService _api;
  final String? Function() _currentUserId;
  final LearningSyncJournal _syncJournal;

  int _scopeRevision = 0;
  List<LearningTopic>? _topicsCache;
  final Map<String, List<LearningVocabulary>> _vocabularyCache = {};
  final Map<String, LearningVocabulary> _vocabularyByIdCache = {};
  List<LearningVocabulary>? _allVocabularyCache;
  List<GrammarLesson>? _grammarCache;

  @override
  void resetForUserScopeChange() {
    _scopeRevision++;
    _topicsCache = null;
    _vocabularyCache.clear();
    _vocabularyByIdCache.clear();
    _allVocabularyCache = null;
    _grammarCache = null;
  }

  @override
  Future<List<LearningTopic>> getTopics() async {
    final scope = _captureScope();
    return _getTopicsForScope(scope);
  }

  Future<List<LearningTopic>> _getTopicsForScope(_LearningScope scope) async {
    _ensureScope(scope);
    final cached = _topicsCache;
    if (cached != null) return List.unmodifiable(cached);

    final dtos = await _collectPages<LearningTopicDto>(
      scope: scope,
      loadPage: (page) => _api.listTopics(
        query: LearningPageQueryDto(page: page, size: _pageSize),
      ),
    );
    _ensureScope(scope);
    final topics = dtos.map((item) => item.toDomain()).toList(growable: false);
    _topicsCache = topics;
    return List.unmodifiable(topics);
  }

  @override
  Future<LearningTopic> getTopic(String topicId) async {
    final normalizedId = topicId.trim();
    if (normalizedId.isEmpty) {
      throw ArgumentError.value(topicId, 'topicId');
    }

    final scope = _captureScope();
    final dto = await _api.getTopic(normalizedId);
    _ensureScope(scope);
    if (dto.topicId != normalizedId) {
      throw const FormatException(
        'Learning topic detail trả về ID không khớp yêu cầu.',
      );
    }
    final topic = dto.toDomain();

    final cachedTopics = _topicsCache;
    if (cachedTopics != null) {
      final updated = List<LearningTopic>.of(cachedTopics);
      final index = updated.indexWhere((item) => item.id == topic.id);
      if (index >= 0) {
        updated[index] = topic;
      } else {
        updated.add(topic);
      }
      _topicsCache = List<LearningTopic>.unmodifiable(updated);
    }
    return topic;
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
      scope: scope,
      loadPage: (page) => _api.listVocabularies(
        query: LearningPageQueryDto(
          page: page,
          size: _pageSize,
          topicId: key.isEmpty ? null : key,
        ),
      ),
    );
    _ensureScope(scope);

    final topics = await _getTopicsForScope(scope);
    _ensureScope(scope);
    final topicNames = <String, String>{
      for (final topic in topics) topic.id: topic.name,
    };
    final vocabularies = dtos
        .map((dto) => dto.toDomain(topicName: topicNames[dto.topicId] ?? ''))
        .toList(growable: false);

    for (final vocabulary in vocabularies) {
      _vocabularyByIdCache[vocabulary.id] = vocabulary;
    }
    if (key.isEmpty) {
      _allVocabularyCache = vocabularies;
    } else {
      _vocabularyCache[key] = vocabularies;
    }
    return List.unmodifiable(vocabularies);
  }

  @override
  Future<LearningVocabulary> getVocabulary(String vocabularyId) async {
    final scope = _captureScope();
    return _getVocabularyForScope(vocabularyId, scope);
  }

  Future<LearningVocabulary> _getVocabularyForScope(
    String vocabularyId,
    _LearningScope scope,
  ) async {
    _ensureScope(scope);
    final cached = _vocabularyByIdCache[vocabularyId];
    if (cached != null) return cached;

    final dto = await _api.getVocabulary(vocabularyId);
    _ensureScope(scope);
    final topics = await _getTopicsForScope(scope);
    _ensureScope(scope);
    String topicName = '';
    for (final item in topics) {
      if (item.id == dto.topicId) {
        topicName = item.name;
        break;
      }
    }
    final vocabulary = dto.toDomain(topicName: topicName);
    _vocabularyByIdCache[vocabulary.id] = vocabulary;
    return vocabulary;
  }

  @override
  Future<List<GrammarLesson>> getGrammarLessons({String? category}) async {
    final scope = _captureScope();
    if (category == null || category.trim().isEmpty) {
      final cached = _grammarCache;
      if (cached != null) return List.unmodifiable(cached);
    }

    final dtos = await _collectPages<LearningGrammarLessonDto>(
      scope: scope,
      loadPage: (page) => _api.listGrammarLessons(
        query: LearningPageQueryDto(
          page: page,
          size: _pageSize,
          category: category,
        ),
      ),
    );
    _ensureScope(scope);
    final lessons = dtos.map((item) => item.toDomain()).toList(growable: false);
    if (category == null || category.trim().isEmpty) {
      _grammarCache = lessons;
    }
    return List.unmodifiable(lessons);
  }

  @override
  Future<GrammarLesson> getGrammarLesson(String lessonId) async {
    final scope = _captureScope();
    final dto = await _api.getGrammarLesson(lessonId);
    _ensureScope(scope);
    return dto.toDomain();
  }

  @override
  Future<List<LearningReviewProgress>> getDueProgress({String? topicId}) async {
    final scope = _captureScope();
    final dueDtos = await _collectPages<LearningReviewProgressDto>(
      scope: scope,
      loadPage: (page) => _api.listDueReviews(
        query: LearningPageQueryDto(
          page: page,
          size: _pageSize,
          topicId: topicId,
        ),
      ),
    );
    _ensureScope(scope);
    return List.unmodifiable(
      dueDtos.map((item) => item.toDomain()).toList(growable: false),
    );
  }

  @override
  Future<List<DueLearningVocabulary>> getDueVocabulary({
    String? topicId,
  }) async {
    final scope = _captureScope();
    final dueDtos = await _collectPages<LearningReviewProgressDto>(
      scope: scope,
      loadPage: (page) => _api.listDueReviews(
        query: LearningPageQueryDto(
          page: page,
          size: _pageSize,
          topicId: topicId,
        ),
      ),
    );
    _ensureScope(scope);
    return _joinDueContent(dueDtos, scope);
  }

  @override
  Future<List<DueLearningVocabulary>> getDueVocabularyPreview({
    String? topicId,
    int limit = 2,
  }) async {
    if (limit < 1 || limit > _pageSize) {
      throw ArgumentError.value(
        limit,
        'limit',
        'Preview limit must be between 1 and $_pageSize.',
      );
    }

    final scope = _captureScope();
    final page = await _api.listDueReviews(
      query: LearningPageQueryDto(page: 1, size: limit, topicId: topicId),
    );
    _ensureScope(scope);
    return _joinDueContent(page.items, scope);
  }

  Future<List<DueLearningVocabulary>> _joinDueContent(
    List<LearningReviewProgressDto> dueDtos,
    _LearningScope scope,
  ) async {
    if (dueDtos.isEmpty) return const <DueLearningVocabulary>[];

    // The Backend has no bulk content endpoint by vocabulary IDs. Fetch only
    // due IDs and cap concurrency so a large review queue does not fan out
    // into hundreds of simultaneous HTTP requests.
    final vocabularyById = <String, LearningVocabulary>{};
    final dueIds = dueDtos.map((item) => item.entityId).toSet().toList();
    for (var offset = 0; offset < dueIds.length; offset += 8) {
      final batch = dueIds.skip(offset).take(8);
      final loaded = await Future.wait(
        batch.map((id) => _getVocabularyForScope(id, scope)),
      );
      _ensureScope(scope);
      for (final vocabulary in loaded) {
        vocabularyById[vocabulary.id] = vocabulary;
      }
    }

    final result = <DueLearningVocabulary>[];
    for (final due in dueDtos) {
      final vocabulary = vocabularyById[due.entityId];
      if (vocabulary == null) continue;
      result.add(
        DueLearningVocabulary(
          vocabulary: vocabulary,
          revision: due.revision,
          quality: due.quality,
          nextReviewDate: due.nextReviewDate,
        ),
      );
    }
    return List.unmodifiable(result);
  }

  @override
  Future<LearningProgressSummary> getProgressSummary() async {
    final scope = _captureScope();
    final result = await _api.getProgressSummary();
    _ensureScope(scope);
    return result.toDomain();
  }

  @override
  Future<LearningMutationReceipt> reviewFlashcard({
    required String vocabularyId,
    required int quality,
    required String baseEntityRevision,
  }) async {
    if (quality < 0 || quality > 5) {
      throw ArgumentError.value(quality, 'quality', 'Quality must be 0–5.');
    }
    final scope = _captureScope();
    final operation = await _syncJournal.getOrCreate(
      userId: scope.userId,
      kind: LearningOperationKind.reviewFlashcard,
      entityId: vocabularyId,
      baseEntityRevision: baseEntityRevision,
      quality: quality,
    );

    try {
      _ensureScope(scope);
      final result = await _api.reviewFlashcard(
        vocabularyId: vocabularyId,
        request: ReviewFlashcardRequestDto(
          operationId: operation.operationId,
          quality: quality,
          baseEntityRevision: operation.baseEntityRevision,
        ),
      );
      _ensureScope(scope);
      return result.toDomain();
    } on AppException catch (error) {
      final rebased = await _preserveAfterFailure(
        scope: scope,
        operation: operation,
        error: error,
      );
      if (rebased == null) rethrow;

      // ENTITY_REVISION_CONFLICT is a definitive rejection, so it is safe to
      // issue one new operation using the authoritative revision returned by
      // Backend. Network failures never enter this branch and keep the same ID.
      _ensureScope(scope);
      try {
        final retry = await _api.reviewFlashcard(
          vocabularyId: vocabularyId,
          request: ReviewFlashcardRequestDto(
            operationId: rebased.operationId,
            quality: quality,
            baseEntityRevision: rebased.baseEntityRevision,
          ),
        );
        _ensureScope(scope);
        return retry.toDomain();
      } on AppException catch (retryError) {
        await _preserveAfterFailure(
          scope: scope,
          operation: rebased,
          error: retryError,
        );
        rethrow;
      }
    }
  }

  @override
  Future<LearningMutationReceipt> completeGrammarLesson({
    required String lessonId,
    required String baseEntityRevision,
  }) async {
    final scope = _captureScope();
    final operation = await _syncJournal.getOrCreate(
      userId: scope.userId,
      kind: LearningOperationKind.completeLesson,
      entityId: lessonId,
      baseEntityRevision: baseEntityRevision,
    );

    try {
      _ensureScope(scope);
      final result = await _api.completeGrammarLesson(
        lessonId: lessonId,
        request: CompleteGrammarLessonRequestDto(
          operationId: operation.operationId,
          baseEntityRevision: operation.baseEntityRevision,
        ),
      );
      _ensureScope(scope);
      return result.toDomain();
    } on AppException catch (error) {
      final rebased = await _preserveAfterFailure(
        scope: scope,
        operation: operation,
        error: error,
      );
      if (rebased == null) rethrow;

      _ensureScope(scope);
      try {
        final retry = await _api.completeGrammarLesson(
          lessonId: lessonId,
          request: CompleteGrammarLessonRequestDto(
            operationId: rebased.operationId,
            baseEntityRevision: rebased.baseEntityRevision,
          ),
        );
        _ensureScope(scope);
        return retry.toDomain();
      } on AppException catch (retryError) {
        await _preserveAfterFailure(
          scope: scope,
          operation: rebased,
          error: retryError,
        );
        rethrow;
      }
    }
  }

  @override
  Future<void> acknowledgeMutation({
    required String userId,
    required String operationId,
  }) async {
    final scope = _captureScope();
    if (scope.userId != userId.trim()) {
      throw const AppException.cancelled(
        message: 'Không thể xác nhận thao tác của tài khoản khác.',
      );
    }
    await _syncJournal.remove(userId: scope.userId, operationId: operationId);
    _ensureScope(scope);
  }

  Future<LearningPendingOperation?> _preserveAfterFailure({
    required _LearningScope scope,
    required LearningPendingOperation operation,
    required AppException error,
  }) async {
    if (error.type != AppExceptionType.conflict ||
        error.code != 'ENTITY_REVISION_CONFLICT') {
      return null;
    }

    final revision = _extractCurrentRevision(error.details, operation.entityId);
    if (revision == null) {
      // A different 409 (for example IDEMPOTENCY_CONFLICT) does not contain an
      // authoritative entity revision. Discard the rejected local entry so a
      // later reload can create a new operation from fresh server state.
      await _syncJournal.remove(
        userId: scope.userId,
        operationId: operation.operationId,
      );
      return null;
    }

    // The previous operation may be recorded as REJECTED by Backend's
    // operation ledger. Use a fresh operationId only after obtaining the
    // server's current revision. A later explicit retry reuses this new entry.
    return _syncJournal.replaceAfterConflict(
      userId: scope.userId,
      operationId: operation.operationId,
      currentRevision: revision,
    );
  }

  String? _extractCurrentRevision(Object? details, String entityId) {
    final detailsMap = details is Map
        ? Map<String, dynamic>.from(details)
        : null;
    final rawProgress = details is List
        ? details
        : detailsMap?['currentProgress'];
    if (rawProgress is! List) return null;
    for (final item in rawProgress) {
      if (item is! Map) continue;
      if (item['entityId'] == entityId && item['revision'] is String) {
        final revision = (item['revision'] as String).trim();
        if (revision.isNotEmpty) return revision;
      }
    }
    return null;
  }

  Future<List<T>> _collectPages<T>({
    required _LearningScope scope,
    required Future<LearningPageDto<T>> Function(int page) loadPage,
  }) async {
    final result = <T>[];
    var pageNumber = 1;
    var totalPages = 1;

    while (pageNumber <= totalPages) {
      _ensureScope(scope);
      if (pageNumber > _maximumPages) {
        throw const FormatException(
          'Learning API pagination exceeded the safety limit.',
        );
      }
      final page = await loadPage(pageNumber);
      _ensureScope(scope);
      if (page.page != pageNumber) {
        throw FormatException(
          'Learning API returned page ${page.page} for requested page $pageNumber.',
        );
      }
      if (pageNumber > 1 && page.totalPages != totalPages) {
        throw const FormatException(
          'Learning content changed while pagination was in progress. Please reload.',
        );
      }
      result.addAll(page.items);
      totalPages = page.totalPages;
      pageNumber++;
    }
    return result;
  }

  _LearningScope _captureScope() {
    final userId = _currentUserId()?.trim();
    if (userId == null || userId.isEmpty) {
      throw const AppException.unauthorized(
        message: 'Bạn cần đăng nhập để sử dụng dữ liệu học tập.',
      );
    }
    return _LearningScope(userId: userId, revision: _scopeRevision);
  }

  void _ensureScope(_LearningScope scope) {
    if (scope.revision != _scopeRevision ||
        _currentUserId()?.trim() != scope.userId) {
      throw const AppException.cancelled(
        message: 'Yêu cầu học tập đã bị hủy do tài khoản thay đổi.',
      );
    }
  }
}

class _LearningScope {
  const _LearningScope({required this.userId, required this.revision});

  final String userId;
  final int revision;
}
