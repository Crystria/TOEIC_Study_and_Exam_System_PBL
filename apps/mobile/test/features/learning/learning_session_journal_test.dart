import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/features/learning/models/learning_dtos.dart';
import 'package:toeic_mobile/features/learning/models/vocabulary_session_dtos.dart';
import 'package:toeic_mobile/features/learning/requests/learning_session_requests.dart';
import 'package:toeic_mobile/features/learning/repositories/learning_session_journal.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test('reuses a pending create intent for the same user/topic/mode', () async {
    final journal = LearningSessionJournal();
    final first = await journal.getOrCreatePendingCreate(
      userId: 'user-a',
      topicId: _uuid(100),
      mode: VocabularySessionMode.newWords,
    );
    final retry = await journal.getOrCreatePendingCreate(
      userId: 'user-a',
      topicId: _uuid(100),
      mode: VocabularySessionMode.newWords,
    );

    expect(retry.idempotencyKey, first.idempotencyKey);
    expect(retry.topicId, first.topicId);
    expect(retry.mode, first.mode);
    expect((await journal.read('user-a')).pendingCreate, isNotNull);
    expect((await journal.read('user-b')).pendingCreate, isNull);

    await expectLater(
      journal.getOrCreatePendingCreate(
        userId: 'user-a',
        topicId: _uuid(101),
        mode: VocabularySessionMode.review,
      ),
      throwsStateError,
    );
  });

  test(
    'attaches created Session and persists an immutable submit payload',
    () async {
      final journal = LearningSessionJournal();
      const userId = 'user-a';
      final topicId = _uuid(100);
      final intent = await journal.getOrCreatePendingCreate(
        userId: userId,
        topicId: topicId,
        mode: VocabularySessionMode.review,
      );
      final session = _session(topicId: topicId);

      await journal.attachCreatedSession(
        userId: userId,
        idempotencyKey: intent.idempotencyKey,
        session: session,
      );

      var state = await journal.read(userId);
      expect(state.pendingCreate, isNull);
      expect(state.activeSession?.sessionId, session.sessionId);
      expect(state.activeSession?.mode, VocabularySessionMode.review);

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

      final pending = await journal.getOrCreatePendingSubmit(
        userId: userId,
        sessionId: session.sessionId,
        reviews: reviews,
        answers: answers,
      );
      final retry = await journal.getOrCreatePendingSubmit(
        userId: userId,
        sessionId: session.sessionId,
        reviews: reviews,
        answers: answers,
      );
      expect(retry.operationId, pending.operationId);
      expect(retry.toRequest().toJson(), pending.toRequest().toJson());

      await expectLater(
        journal.getOrCreatePendingSubmit(
          userId: userId,
          sessionId: session.sessionId,
          reviews: reviews,
          answers: answers.reversed.toList(),
        ),
        throwsStateError,
      );

      state = await journal.read(userId);
      expect(state.pendingSubmit?.operationId, pending.operationId);
      expect(state.pendingSubmit?.answers, hasLength(5));

      await journal.clearPendingSubmit(
        userId: userId,
        operationId: pending.operationId,
      );
      state = await journal.read(userId);
      expect(state.pendingSubmit, isNull);
      expect(state.activeSession?.sessionId, session.sessionId);

      await journal.clearSession(userId: userId, sessionId: session.sessionId);
      expect((await journal.read(userId)).activeSession, isNull);
    },
  );

  test(
    'rejects attaching a Session that does not match the create intent',
    () async {
      final journal = LearningSessionJournal();
      final intent = await journal.getOrCreatePendingCreate(
        userId: 'user-a',
        topicId: _uuid(100),
        mode: VocabularySessionMode.newWords,
      );

      await expectLater(
        journal.attachCreatedSession(
          userId: 'user-a',
          idempotencyKey: intent.idempotencyKey,
          session: _session(
            topicId: _uuid(101),
            mode: VocabularySessionMode.newWords,
          ),
        ),
        throwsStateError,
      );
    },
  );
}

VocabularySessionDto _session({
  required String topicId,
  VocabularySessionMode mode = VocabularySessionMode.review,
}) {
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
    mode: mode,
    status: VocabularySessionStatus.inProgress,
    startedAt: DateTime.utc(2026, 11, 15),
    expiresAt: DateTime.utc(2026, 11, 16),
    vocabularies: vocabularies,
    quiz: questions,
    reviews: const [],
  );
}

String _uuid(int suffix) =>
    '00000000-0000-4000-8000-${suffix.toString().padLeft(12, '0')}';
