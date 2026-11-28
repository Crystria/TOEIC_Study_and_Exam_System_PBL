import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/features/learning/data_sources/learning_session_data_source.dart';
import 'package:toeic_mobile/features/learning/models/learning_dtos.dart';
import 'package:toeic_mobile/features/learning/models/vocabulary_session_dtos.dart';
import 'package:toeic_mobile/features/learning/requests/learning_session_requests.dart';
import 'package:toeic_mobile/features/learning/repositories/api_learning_session_repository.dart';
import 'package:toeic_mobile/features/learning/repositories/learning_session_journal.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test('creates, journals and resumes an active Backend Session', () async {
    final remote = _FakeSessionDataSource();
    final repository = ApiLearningSessionRepository(
      remoteDataSource: remote,
      currentUserId: () => 'user-a',
      journal: remote.journal,
    );

    final created = await repository.createVocabularySession(
      topicId: _uuid(100),
      mode: VocabularySessionMode.review,
    );
    expect(created.sessionId, remote.session.sessionId);
    expect(remote.createCalls, 1);
    expect(remote.lastIdempotencyKey, isNotEmpty);

    final resumed = await repository.resumeActiveVocabularySession();
    expect(resumed?.sessionId, created.sessionId);
    expect(remote.getCalls, 1);

    final state = await remote.journal.read('user-a');
    expect(state.pendingCreate, isNull);
    expect(state.activeSession?.sessionId, created.sessionId);
  });

  test(
    'retries failed submit with the same operation ID and request payload',
    () async {
      final remote = _FakeSessionDataSource()..failFirstSubmit = true;
      final repository = ApiLearningSessionRepository(
        remoteDataSource: remote,
        currentUserId: () => 'user-a',
        journal: remote.journal,
      );
      final session = await repository.createVocabularySession(
        topicId: _uuid(100),
        mode: VocabularySessionMode.review,
      );
      final reviews = List<VocabularySessionReviewRequestDto>.generate(
        5,
        (index) => VocabularySessionReviewRequestDto(
          vocabularyId: _uuid(index + 1),
          quality: index,
        ),
      );
      final answers = List<VocabularySessionAnswerRequestDto>.generate(
        5,
        (index) => VocabularySessionAnswerRequestDto(
          questionId: _uuid(index + 11),
          selectedOption: 'ABCD'[index % 4],
        ),
      );

      await expectLater(
        repository.submitVocabularySession(
          sessionId: session.sessionId,
          reviews: reviews,
          answers: answers,
        ),
        throwsStateError,
      );

      final pending = await repository.getPendingSubmitRequest(
        session.sessionId,
      );
      expect(pending, isNotNull);
      final firstOperationId = pending!.operationId;
      final firstPayload = pending.toJson();

      final result = await repository.submitVocabularySession(
        sessionId: session.sessionId,
        reviews: reviews,
        answers: answers,
      );
      expect(result.operationId, firstOperationId);
      expect(remote.submitOperationIds, [firstOperationId, firstOperationId]);
      expect(remote.submitPayloads.first, firstPayload);
      expect(remote.submitPayloads.last, firstPayload);
      expect(result.quizScore, 4);

      await repository.acknowledgeCompletedSession(session.sessionId);
      expect((await remote.journal.read('user-a')).activeSession, isNull);
    },
  );

  test(
    'invalidates an in-flight session operation after account switch',
    () async {
      final remote = _FakeSessionDataSource()..holdCreate = true;
      var currentUserId = 'user-a';
      final repository = ApiLearningSessionRepository(
        remoteDataSource: remote,
        currentUserId: () => currentUserId,
        journal: remote.journal,
      );

      final pending = repository.createVocabularySession(
        topicId: _uuid(100),
        mode: VocabularySessionMode.review,
      );
      await remote.createStarted.future;
      currentUserId = 'user-b';
      repository.resetForUserScopeChange();
      remote.releaseCreate.complete();

      await expectLater(pending, throwsA(isA<Exception>()));
      final journalState = await remote.journal.read('user-a');
      expect(journalState.activeSession, isNull);
      expect(journalState.pendingCreate, isNotNull);
    },
  );
}

class _FakeSessionDataSource implements LearningSessionDataSource {
  _FakeSessionDataSource() : journal = LearningSessionJournal() {
    session = _buildSession(status: VocabularySessionStatus.inProgress);
    completedSession = _buildSession(
      status: VocabularySessionStatus.completed,
      result: _buildResult(),
    );
  }

  final LearningSessionJournal journal;
  late final VocabularySessionDto session;
  late final VocabularySessionDto completedSession;
  int createCalls = 0;
  int getCalls = 0;
  bool failFirstSubmit = false;
  bool holdCreate = false;
  final Completer<void> createStarted = Completer<void>();
  final Completer<void> releaseCreate = Completer<void>();
  final List<String> submitOperationIds = [];
  final List<Map<String, dynamic>> submitPayloads = [];

  @override
  Future<VocabularySessionDto> createVocabularySession({
    required CreateVocabularySessionRequestDto request,
    required String idempotencyKey,
  }) async {
    createCalls++;
    lastIdempotencyKey = idempotencyKey;
    if (holdCreate) {
      if (!createStarted.isCompleted) createStarted.complete();
      await releaseCreate.future;
    }
    return session;
  }

  String lastIdempotencyKey = '';

  @override
  Future<VocabularySessionDto> getVocabularySession(String sessionId) async {
    getCalls++;
    return _submitted ? completedSession : session;
  }

  @override
  Future<void> saveVocabularySessionReviews({
    required String sessionId,
    required SaveVocabularySessionReviewsRequestDto request,
  }) async {}

  bool _submitted = false;

  @override
  Future<VocabularySessionResultDto> submitVocabularySession({
    required String sessionId,
    required SubmitVocabularySessionRequestDto request,
  }) async {
    submitOperationIds.add(request.operationId);
    submitPayloads.add(request.toJson());
    if (failFirstSubmit) {
      failFirstSubmit = false;
      throw StateError('Simulated network interruption.');
    }
    _submitted = true;
    return _buildResult(operationId: request.operationId);
  }

  @override
  Future<void> cancelVocabularySession(String sessionId) async {}
}

VocabularySessionDto _buildSession({
  required VocabularySessionStatus status,
  VocabularySessionResultDto? result,
}) {
  const topicId = '00000000-0000-4000-8000-000000000100';
  final vocabularies = List<LearningVocabularyDto>.generate(
    5,
    (index) => LearningVocabularyDto(
      vocabularyId: _uuid(index + 1),
      topicId: topicId,
      word: 'word-$index',
      phonetic: '/wɜːd/',
      definition: 'meaning-$index',
      example: 'Example $index',
      audioUrl: '',
      imageUrl: '',
    ),
  );
  final questions = List<VocabularySessionQuestionDto>.generate(
    5,
    (index) => VocabularySessionQuestionDto(
      questionId: _uuid(index + 11),
      vocabularyId: _uuid(index + 1),
      prompt: 'word-$index',
      direction: VocabularyQuizDirection.wordToMeaning,
      options: const [
        VocabularySessionOptionDto(code: 'A', text: 'A'),
        VocabularySessionOptionDto(code: 'B', text: 'B'),
        VocabularySessionOptionDto(code: 'C', text: 'C'),
        VocabularySessionOptionDto(code: 'D', text: 'D'),
      ],
    ),
  );
  return VocabularySessionDto(
    sessionId: _uuid(200),
    topicId: topicId,
    mode: VocabularySessionMode.review,
    status: status,
    startedAt: DateTime.utc(2026, 11, 15),
    expiresAt: DateTime.utc(2026, 11, 16),
    vocabularies: vocabularies,
    quiz: questions,
    reviews: const [],
    result: result,
  );
}

VocabularySessionResultDto _buildResult({String operationId = _uuidOperation}) {
  return VocabularySessionResultDto(
    sessionId: _uuid(200),
    operationId: operationId,
    quizScore: 4,
    quizTotal: 5,
    completedAt: DateTime.utc(2026, 11, 15),
    answers: List<VocabularySessionAnswerResultDto>.generate(
      5,
      (index) => VocabularySessionAnswerResultDto(
        questionId: _uuid(index + 11),
        selectedOption: 'ABCD'[index % 4],
        correctOption: index == 4 ? 'B' : 'ABCD'[index % 4],
        isCorrect: index != 4,
      ),
    ),
    progress: List<VocabularySessionProgressSnapshotDto>.generate(
      5,
      (index) => VocabularySessionProgressSnapshotDto(
        entityId: _uuid(index + 1),
        revision: '1',
        state: const <String, dynamic>{'quality': 3},
      ),
    ),
  );
}

const String _uuidOperation = '00000000-0000-4000-8000-000000000999';
String _uuid(int suffix) =>
    '00000000-0000-4000-8000-${suffix.toString().padLeft(12, '0')}';
