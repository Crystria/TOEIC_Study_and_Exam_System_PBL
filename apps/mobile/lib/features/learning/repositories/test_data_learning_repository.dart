import '../../../core/errors/app_exception.dart';
import '../data_sources/learning_content_data_source.dart';
import '../models/grammar_lesson.dart';
import '../models/learning_dtos.dart';
import '../models/learning_models.dart';
import '../mappers/learning_dto_mapper.dart';
import '../requests/learning_request_dtos.dart';
import 'learning_repository.dart';

/// Development implementation of [LearningRepository]. It serves content and
/// simulated Backend mutation receipts from approved fixtures. User-owned
/// progress and preferences are handled separately by
/// LearningLocalStateRepository.
class TestDataLearningRepository implements LearningRepository {
  TestDataLearningRepository({
    required LearningContentDataSource testDataSource,
    required String? Function() currentUserId,
  }) : _testData = testDataSource,
       _currentUserId = currentUserId;

  static const int _pageSize = 50;
  final LearningContentDataSource _testData;
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
    _ensureScope(scope);
    return List.unmodifiable(
      dtos.map(LearningDtoMapper.reviewProgress).toList(growable: false),
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
    _ensureScope(scope);
    return LearningDtoMapper.progressSummary(fixtureSummary);
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
