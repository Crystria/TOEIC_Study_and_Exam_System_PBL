import '../../../core/errors/app_exception.dart';
import '../data_sources/learning_session_data_source.dart';
import '../models/vocabulary_session_dtos.dart';
import '../requests/learning_session_requests.dart';
import 'learning_session_journal.dart';
import 'learning_session_repository.dart';

class ApiLearningSessionRepository implements LearningSessionRepository {
  ApiLearningSessionRepository({
    required LearningSessionDataSource remoteDataSource,
    required String? Function() currentUserId,
    LearningSessionJournal? journal,
  }) : _remote = remoteDataSource,
       _currentUserId = currentUserId,
       _journal = journal ?? LearningSessionJournal();

  final LearningSessionDataSource _remote;
  final String? Function() _currentUserId;
  final LearningSessionJournal _journal;
  int _scopeRevision = 0;

  @override
  bool get isAvailable => true;

  @override
  void resetForUserScopeChange() {
    // Do not delete persisted records. Each user's journal has its own key.
    // Incrementing the revision invalidates operations started in the old scope.
    _scopeRevision++;
  }

  _SessionScope _captureScope() {
    final userId = _currentUserId()?.trim();
    if (userId == null || userId.isEmpty) {
      throw const AppException.unauthorized(
        message: 'Bạn cần đăng nhập để sử dụng Vocabulary Session.',
      );
    }
    return _SessionScope(userId: userId, revision: _scopeRevision);
  }

  void _ensureScope(_SessionScope scope) {
    if (scope.revision != _scopeRevision ||
        _currentUserId()?.trim() != scope.userId) {
      throw const AppException.cancelled(
        message: 'Vocabulary Session đã bị hủy do tài khoản thay đổi.',
      );
    }
  }

  @override
  Future<VocabularySessionDto> createVocabularySession({
    required String topicId,
    required VocabularySessionMode mode,
  }) async {
    final scope = _captureScope();
    final intent = await _journal.getOrCreatePendingCreate(
      userId: scope.userId,
      topicId: topicId,
      mode: mode,
    );
    _ensureScope(scope);
    return _createFromIntent(scope, intent);
  }

  Future<VocabularySessionDto> _createFromIntent(
    _SessionScope scope,
    LearningSessionCreateIntent intent,
  ) async {
    _ensureScope(scope);
    final session = await _remote.createVocabularySession(
      request: CreateVocabularySessionRequestDto(
        topicId: intent.topicId,
        mode: intent.mode,
      ),
      idempotencyKey: intent.idempotencyKey,
    );
    _ensureScope(scope);

    if (session.topicId != intent.topicId || session.mode != intent.mode) {
      throw const FormatException(
        'Backend returned a Session that does not match the pending create.',
      );
    }

    await _journal.attachCreatedSession(
      userId: scope.userId,
      idempotencyKey: intent.idempotencyKey,
      session: session,
    );
    _ensureScope(scope);
    await _reconcileTerminalSession(scope, session);
    return session;
  }

  @override
  Future<VocabularySessionDto?> resumeActiveVocabularySession() async {
    final scope = _captureScope();
    final state = await _journal.read(scope.userId);
    _ensureScope(scope);

    final active = state.activeSession;
    if (active != null) {
      final session = await _remote.getVocabularySession(active.sessionId);
      _ensureScope(scope);
      await _reconcileTerminalSession(
        scope,
        session,
        pendingSubmit: state.pendingSubmit,
      );
      return session;
    }

    final pendingCreate = state.pendingCreate;
    if (pendingCreate == null) return null;

    // Retrying the same idempotency key is safe if Backend created the Session
    // but the client lost the response before persisting sessionId.
    return _createFromIntent(scope, pendingCreate);
  }

  @override
  Future<VocabularySessionDto> getVocabularySession(String sessionId) async {
    final scope = _captureScope();
    final state = await _journal.read(scope.userId);
    _ensureScope(scope);
    if (state.activeSession?.sessionId != sessionId) {
      throw StateError('Session không khớp với active Session đang lưu.');
    }

    final session = await _remote.getVocabularySession(sessionId);
    _ensureScope(scope);
    await _reconcileTerminalSession(
      scope,
      session,
      pendingSubmit: state.pendingSubmit,
    );
    return session;
  }

  @override
  Future<SubmitVocabularySessionRequestDto?> getPendingSubmitRequest(
    String sessionId,
  ) async {
    final scope = _captureScope();
    final state = await _journal.read(scope.userId);
    _ensureScope(scope);
    if (state.activeSession?.sessionId != sessionId) return null;
    return state.pendingSubmit?.toRequest();
  }

  @override
  Future<void> saveVocabularySessionReviews({
    required String sessionId,
    required SaveVocabularySessionReviewsRequestDto request,
  }) async {
    final scope = _captureScope();
    await _requireActiveSession(scope, sessionId);
    await _remote.saveVocabularySessionReviews(
      sessionId: sessionId,
      request: request,
    );
    _ensureScope(scope);
  }

  @override
  Future<VocabularySessionResultDto> submitVocabularySession({
    required String sessionId,
    required List<VocabularySessionReviewRequestDto> reviews,
    required List<VocabularySessionAnswerRequestDto> answers,
  }) async {
    final scope = _captureScope();
    await _requireActiveSession(scope, sessionId);

    final pending = await _journal.getOrCreatePendingSubmit(
      userId: scope.userId,
      sessionId: sessionId,
      reviews: reviews,
      answers: answers,
    );
    _ensureScope(scope);

    // A retry uses the same Operation ID and immutable request payload.
    final result = await _remote.submitVocabularySession(
      sessionId: sessionId,
      request: pending.toRequest(),
    );
    _ensureScope(scope);

    if (result.sessionId != sessionId ||
        result.operationId != pending.operationId) {
      throw const FormatException(
        'Submit response does not match the pending Session transaction.',
      );
    }

    await _journal.clearPendingSubmit(
      userId: scope.userId,
      operationId: pending.operationId,
    );
    _ensureScope(scope);
    return result;
  }

  @override
  Future<void> cancelVocabularySession(String sessionId) async {
    final scope = _captureScope();
    final state = await _journal.read(scope.userId);
    _ensureScope(scope);
    if (state.activeSession?.sessionId != sessionId) {
      throw StateError('Session không khớp với active Session đang lưu.');
    }
    if (state.pendingSubmit != null) {
      throw StateError(
        'Không thể hủy Session khi đang có một yêu cầu submit cần khôi phục.',
      );
    }

    await _remote.cancelVocabularySession(sessionId);
    _ensureScope(scope);
    // Keep the journal pointer if Backend rejects or the request times out.
    await _journal.clearSession(userId: scope.userId, sessionId: sessionId);
    _ensureScope(scope);
  }

  @override
  Future<void> acknowledgeCompletedSession(String sessionId) async {
    final scope = _captureScope();
    await _requireActiveSession(scope, sessionId);

    final session = await _remote.getVocabularySession(sessionId);
    _ensureScope(scope);
    if (session.status != VocabularySessionStatus.completed ||
        session.result == null) {
      throw StateError('Chỉ có thể acknowledge một Session đã hoàn tất.');
    }

    final state = await _journal.read(scope.userId);
    _ensureScope(scope);
    final pending = state.pendingSubmit;
    if (pending != null) {
      if (pending.operationId != session.result!.operationId) {
        throw const FormatException(
          'Completed Session does not match the pending submit Operation ID.',
        );
      }
      await _journal.clearPendingSubmit(
        userId: scope.userId,
        operationId: pending.operationId,
      );
      _ensureScope(scope);
    }

    await _journal.clearSession(userId: scope.userId, sessionId: sessionId);
    _ensureScope(scope);
  }

  Future<void> _requireActiveSession(
    _SessionScope scope,
    String sessionId,
  ) async {
    final state = await _journal.read(scope.userId);
    _ensureScope(scope);
    if (state.activeSession?.sessionId != sessionId) {
      throw StateError('Session không khớp với active Session đang lưu.');
    }
  }

  Future<void> _reconcileTerminalSession(
    _SessionScope scope,
    VocabularySessionDto session, {
    LearningPendingSessionSubmit? pendingSubmit,
  }) async {
    if (session.status == VocabularySessionStatus.completed) {
      final result = session.result;
      if (result == null) {
        throw const FormatException('Completed Session is missing its result.');
      }
      if (pendingSubmit != null) {
        if (pendingSubmit.operationId != result.operationId) {
          throw const FormatException(
            'Completed Session Operation ID does not match Journal.',
          );
        }
        await _journal.clearPendingSubmit(
          userId: scope.userId,
          operationId: pendingSubmit.operationId,
        );
        _ensureScope(scope);
      }
    }

    if (session.status == VocabularySessionStatus.canceled ||
        session.status == VocabularySessionStatus.expired) {
      await _journal.clearSession(
        userId: scope.userId,
        sessionId: session.sessionId,
      );
      _ensureScope(scope);
    }
  }
}

class _SessionScope {
  const _SessionScope({required this.userId, required this.revision});

  final String userId;
  final int revision;
}
