import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';
import '../models/vocabulary_session_dtos.dart';
import '../requests/learning_session_requests.dart';
import '../repositories/learning_session_repository.dart';

class QuizOption {
  const QuizOption({required this.code, required this.text});

  final String code;
  final String text;
}

class QuizQuestion {
  const QuizQuestion({
    required this.questionId,
    required this.wordId,
    required this.word,
    required this.phonetic,
    required this.definition,
    required this.prompt,
    required this.direction,
    required this.options,
  });

  final String questionId;
  final String wordId;
  final String word;
  final String phonetic;
  final String definition;
  final String prompt;
  final VocabularyQuizDirection direction;
  final List<QuizOption> options;
}

class QuizReviewWord {
  const QuizReviewWord({
    required this.id,
    required this.word,
    required this.phonetic,
    required this.definition,
  });

  final String id;
  final String word;
  final String phonetic;
  final String definition;
}

class QuizResultEntry {
  const QuizResultEntry({
    required this.question,
    required this.selectedAnswer,
    required this.correctAnswer,
    required this.isCorrect,
  });

  final QuizQuestion question;
  final String selectedAnswer;
  final String correctAnswer;
  final bool isCorrect;
}

enum QuizStatus {
  idle,
  loading,
  loaded,
  rating,
  submitting,
  finished,
  unavailable,
  error,
}

/// Orchestrates the Backend Vocabulary Session used by Quick Quiz.
///
/// The Backend owns question selection, answer grading, SM-2 mutation and
/// session idempotency. The learner separately supplies an explicit 0..5
/// recall-quality rating for each vocabulary item; this value is never inferred
/// from the multiple-choice result.
class QuickQuizProvider extends ChangeNotifier {
  QuickQuizProvider({required LearningSessionRepository sessionRepository})
    : _sessions = sessionRepository;

  static const int questionCount = 5;

  final LearningSessionRepository _sessions;
  int _scopeRevision = 0;
  String? _requestedTopicId;
  VocabularySessionMode? _requestedMode;
  String? sessionId;
  List<QuizQuestion> questions = const [];
  List<QuizReviewWord> reviewWords = const [];
  List<QuizResultEntry> resultEntries = const [];
  final Map<String, String> _selectedAnswers = <String, String>{};
  final Map<String, int> _reviewQualities = <String, int>{};
  Future<void> _reviewSaveQueue = Future<void>.value();

  int currentIndex = 0;
  String? selectedOption;
  int correctCount = 0;
  QuizStatus status = QuizStatus.idle;
  String? message;
  String? reviewPersistenceMessage;

  int get totalQuestions => questions.length;
  bool get isLastQuestion =>
      questions.isNotEmpty && currentIndex == questions.length - 1;
  bool get hasSelection => selectedOption != null;
  bool get hasActiveSession => sessionId != null;
  bool get canSubmit =>
      questions.length == questionCount &&
      _selectedAnswers.length == questionCount &&
      reviewWords.length == questionCount &&
      _reviewQualities.length == questionCount;
  int get ratedWordCount => _reviewQualities.length;
  VocabularySessionMode? get sessionMode => _requestedMode;
  String? get topicId => _requestedTopicId;
  List<QuizResultEntry> get wrongAnswers =>
      resultEntries.where((item) => !item.isCorrect).toList(growable: false);

  String? selectedOptionFor(String questionId) => _selectedAnswers[questionId];

  int? qualityFor(String vocabularyId) => _reviewQualities[vocabularyId];

  Future<void> startSession({
    required String topicId,
    required VocabularySessionMode mode,
    bool canCreate = true,
  }) async {
    final revision = ++_scopeRevision;
    _requestedTopicId = topicId;
    _requestedMode = mode;
    _clearAttempt(keepSessionId: false);

    if (!_sessions.isAvailable) {
      _setUnavailable(
        'Quick Quiz sử dụng Vocabulary Session từ Backend và hiện không khả dụng trong chế độ Test Data.',
      );
      return;
    }

    status = QuizStatus.loading;
    message = null;
    notifyListeners();

    try {
      var session = await _sessions.resumeActiveVocabularySession();
      if (!_isCurrent(revision)) return;

      if (session == null ||
          session.status == VocabularySessionStatus.canceled ||
          session.status == VocabularySessionStatus.expired) {
        if (!canCreate) {
          _setUnavailable(
            'Quiz chỉ được mở sau khi bạn hoàn thành mục tiêu từ vựng hôm nay.',
          );
          return;
        }
        session = await _sessions.createVocabularySession(
          topicId: topicId,
          mode: mode,
        );
        if (!_isCurrent(revision)) return;
      }

      await _applySession(session, revision);
    } catch (error) {
      if (!_isCurrent(revision)) return;
      _setError(_messageFor(error));
    }
  }

  Future<void> retry() async {
    final currentSessionId = sessionId;
    final revision = _scopeRevision;
    if (currentSessionId != null) {
      status = QuizStatus.loading;
      message = null;
      notifyListeners();
      try {
        final session = await _sessions.getVocabularySession(currentSessionId);
        if (!_isCurrent(revision)) return;
        await _applySession(session, revision);
        return;
      } catch (error) {
        if (!_isCurrent(revision)) return;
        try {
          final pending = await _sessions.getPendingSubmitRequest(
            currentSessionId,
          );
          if (!_isCurrent(revision)) return;
          if (pending != null) {
            await _retryPendingSubmit(pending, revision);
            return;
          }
        } catch (pendingError) {
          if (!_isCurrent(revision)) return;
          _setError(_messageFor(pendingError));
          return;
        }
        _setError(_messageFor(error));
        return;
      }
    }

    final requestedTopicId = _requestedTopicId;
    final requestedMode = _requestedMode;
    if (requestedTopicId == null || requestedMode == null) {
      _setError('Thiếu thông tin chủ đề hoặc chế độ Quiz.');
      return;
    }
    await startSession(topicId: requestedTopicId, mode: requestedMode);
  }

  Future<void> _applySession(VocabularySessionDto session, int revision) async {
    if (!_isCurrent(revision)) return;
    sessionId = session.sessionId;
    _requestedTopicId = session.topicId;
    _requestedMode = session.mode;

    if (session.status == VocabularySessionStatus.completed) {
      final result = session.result;
      if (result == null) {
        throw const FormatException(
          'Backend trả về Session COMPLETED nhưng không có kết quả.',
        );
      }
      _applyCompletedResult(session, result);
      notifyListeners();
      return;
    }

    if (session.status != VocabularySessionStatus.inProgress) {
      throw StateError('Vocabulary Session không còn ở trạng thái hoạt động.');
    }

    final vocabularyById = {
      for (final item in session.vocabularies) item.vocabularyId: item,
    };
    questions = List.unmodifiable(
      session.quiz.map((item) {
        final vocabulary = vocabularyById[item.vocabularyId];
        if (vocabulary == null) {
          throw const FormatException(
            'Quiz question không khớp vocabulary snapshot của Session.',
          );
        }
        return QuizQuestion(
          questionId: item.questionId,
          wordId: item.vocabularyId,
          word: vocabulary.word,
          phonetic: vocabulary.phonetic,
          definition: vocabulary.definition,
          prompt: item.prompt,
          direction: item.direction,
          options: List.unmodifiable(
            item.options.map(
              (option) => QuizOption(code: option.code, text: option.text),
            ),
          ),
        );
      }),
    );
    reviewWords = List.unmodifiable(
      session.vocabularies.map(
        (item) => QuizReviewWord(
          id: item.vocabularyId,
          word: item.word,
          phonetic: item.phonetic,
          definition: item.definition,
        ),
      ),
    );
    _selectedAnswers.clear();
    _reviewQualities
      ..clear()
      ..addEntries(
        session.reviews.map(
          (review) => MapEntry(review.vocabularyId, review.quality),
        ),
      );
    resultEntries = const [];
    currentIndex = 0;
    selectedOption = null;
    correctCount = 0;
    message = null;
    reviewPersistenceMessage = null;

    final pending = await _sessions.getPendingSubmitRequest(session.sessionId);
    if (!_isCurrent(revision)) return;
    if (pending != null) {
      status = QuizStatus.submitting;
      notifyListeners();
      await _retryPendingSubmit(pending, revision);
      return;
    }

    status = QuizStatus.loaded;
    notifyListeners();
  }

  void select(String optionCode) {
    if (status != QuizStatus.loaded || questions.isEmpty) return;
    final question = questions[currentIndex];
    if (!question.options.any((option) => option.code == optionCode)) return;
    selectedOption = optionCode;
    _selectedAnswers[question.questionId] = optionCode;
    notifyListeners();
  }

  void continueToNextQuestion() {
    if (status != QuizStatus.loaded ||
        selectedOption == null ||
        isLastQuestion) {
      return;
    }
    currentIndex++;
    selectedOption = _selectedAnswers[questions[currentIndex].questionId];
    notifyListeners();
  }

  void beginReviewRating() {
    if (status != QuizStatus.loaded ||
        questions.length != questionCount ||
        _selectedAnswers.length != questionCount) {
      return;
    }
    status = QuizStatus.rating;
    selectedOption = null;
    notifyListeners();
  }

  Future<void> setReviewQuality({
    required String vocabularyId,
    required int quality,
  }) async {
    if (status != QuizStatus.rating || quality < 0 || quality > 5) return;
    if (!reviewWords.any((word) => word.id == vocabularyId)) return;

    _reviewQualities[vocabularyId] = quality;
    reviewPersistenceMessage = null;
    notifyListeners();

    final currentSessionId = sessionId;
    if (currentSessionId == null) return;
    final revision = _scopeRevision;
    final draft = _reviewQualities.entries
        .map(
          (entry) => VocabularySessionReviewRequestDto(
            vocabularyId: entry.key,
            quality: entry.value,
          ),
        )
        .toList(growable: false);
    final request = SaveVocabularySessionReviewsRequestDto(reviews: draft);

    _reviewSaveQueue = _reviewSaveQueue
        .then<void>((_) {}, onError: (Object _) {})
        .then<void>((_) async {
          if (!_isCurrent(revision) || sessionId != currentSessionId) return;
          await _sessions.saveVocabularySessionReviews(
            sessionId: currentSessionId,
            request: request,
          );
        });

    try {
      await _reviewSaveQueue;
    } catch (error) {
      if (!_isCurrent(revision)) return;
      reviewPersistenceMessage = 'Chưa lưu được đánh giá lên Backend. Kết quả vẫn sẽ được gửi cùng lúc khi nộp Quiz.';
      notifyListeners();
    }
  }

  Future<bool> submitQuiz() async {
    if (!canSubmit ||
        sessionId == null ||
        (status != QuizStatus.rating && status != QuizStatus.error)) {
      return false;
    }

    final revision = _scopeRevision;
    final currentSessionId = sessionId!;
    final reviews = reviewWords
        .map(
          (word) => VocabularySessionReviewRequestDto(
            vocabularyId: word.id,
            quality: _reviewQualities[word.id]!,
          ),
        )
        .toList(growable: false);
    final answers = questions
        .map(
          (question) => VocabularySessionAnswerRequestDto(
            questionId: question.questionId,
            selectedOption: _selectedAnswers[question.questionId]!,
          ),
        )
        .toList(growable: false);

    status = QuizStatus.submitting;
    message = null;
    notifyListeners();

    try {
      await _reviewSaveQueue.then<void>((_) {}, onError: (Object _) {});
      final result = await _sessions.submitVocabularySession(
        sessionId: currentSessionId,
        reviews: reviews,
        answers: answers,
      );
      if (!_isCurrent(revision)) return false;
      _applyCompletedResultFromCurrentQuestions(result);
      status = QuizStatus.finished;
      notifyListeners();
      return true;
    } catch (error) {
      if (!_isCurrent(revision)) return false;
      _setError(_messageFor(error));
      return false;
    }
  }

  Future<void> _retryPendingSubmit(
    SubmitVocabularySessionRequestDto pending,
    int revision,
  ) async {
    final currentSessionId = sessionId;
    if (currentSessionId == null) return;
    try {
      final result = await _sessions.submitVocabularySession(
        sessionId: currentSessionId,
        reviews: pending.reviews,
        answers: pending.answers,
      );
      if (!_isCurrent(revision)) return;
      _applyCompletedResultFromCurrentQuestions(result);
      status = QuizStatus.finished;
      message = null;
      notifyListeners();
    } catch (error) {
      if (!_isCurrent(revision)) return;
      _setError(_messageFor(error));
    }
  }

  void _applyCompletedResult(
    VocabularySessionDto session,
    VocabularySessionResultDto result,
  ) {
    final vocabularyById = {
      for (final item in session.vocabularies) item.vocabularyId: item,
    };
    questions = List.unmodifiable(
      session.quiz.map((item) {
        final vocabulary = vocabularyById[item.vocabularyId];
        if (vocabulary == null) {
          throw const FormatException(
            'Quiz question không khớp vocabulary snapshot của Session.',
          );
        }
        return QuizQuestion(
          questionId: item.questionId,
          wordId: item.vocabularyId,
          word: vocabulary.word,
          phonetic: vocabulary.phonetic,
          definition: vocabulary.definition,
          prompt: item.prompt,
          direction: item.direction,
          options: List.unmodifiable(
            item.options.map(
              (option) => QuizOption(code: option.code, text: option.text),
            ),
          ),
        );
      }),
    );
    reviewWords = List.unmodifiable(
      session.vocabularies.map(
        (item) => QuizReviewWord(
          id: item.vocabularyId,
          word: item.word,
          phonetic: item.phonetic,
          definition: item.definition,
        ),
      ),
    );
    _applyResult(result);
  }

  void _applyCompletedResultFromCurrentQuestions(
    VocabularySessionResultDto result,
  ) {
    if (result.sessionId != sessionId) {
      throw const FormatException('Session result ID không khớp.');
    }
    _applyResult(result);
  }

  void _applyResult(VocabularySessionResultDto result) {
    final resultByQuestionId = {
      for (final answer in result.answers) answer.questionId: answer,
    };
    final entries = <QuizResultEntry>[];
    for (final question in questions) {
      final answer = resultByQuestionId[question.questionId];
      if (answer == null) {
        throw const FormatException('Session result thiếu câu trả lời.');
      }
      String optionText(String code) =>
          question.options.firstWhere((option) => option.code == code).text;
      entries.add(
        QuizResultEntry(
          question: question,
          selectedAnswer: optionText(answer.selectedOption),
          correctAnswer: optionText(answer.correctOption),
          isCorrect: answer.isCorrect,
        ),
      );
    }
    resultEntries = List.unmodifiable(entries);
    correctCount = result.quizScore;
    _selectedAnswers
      ..clear()
      ..addEntries(
        result.answers.map(
          (answer) => MapEntry(answer.questionId, answer.selectedOption),
        ),
      );
    status = QuizStatus.finished;
    message = null;
  }

  Future<void> cancelCurrentSession() async {
    final currentSessionId = sessionId;
    if (currentSessionId == null) {
      _clearAttempt(keepSessionId: false);
      status = QuizStatus.idle;
      notifyListeners();
      return;
    }
    final revision = _scopeRevision;
    await _sessions.cancelVocabularySession(currentSessionId);
    if (!_isCurrent(revision)) return;
    _clearAttempt(keepSessionId: false);
    status = QuizStatus.idle;
    message = null;
    notifyListeners();
  }

  Future<void> acknowledgeCompletedSession() async {
    final currentSessionId = sessionId;
    if (currentSessionId == null || status != QuizStatus.finished) return;
    final revision = _scopeRevision;
    await _sessions.acknowledgeCompletedSession(currentSessionId);
    if (!_isCurrent(revision)) return;
    sessionId = null;
  }

  void setUnavailable(String reason) => _setUnavailable(reason);

  void _setUnavailable(String reason) {
    _clearAttempt(keepSessionId: false);
    message = reason;
    status = QuizStatus.unavailable;
    notifyListeners();
  }

  void _setError(String reason) {
    message = reason;
    status = QuizStatus.error;
    notifyListeners();
  }

  String _messageFor(Object error) {
    if (error is AppException) return error.message;

    if (error is UnsupportedError) {
      return error.message ??
          'Chức năng này hiện không được hỗ trợ trong chế độ hiện tại.';
    }

    return error.toString().isEmpty
        ? 'Không thể xử lý Vocabulary Session. Vui lòng thử lại.'
        : error.toString();
  }

  bool _isCurrent(int revision) => revision == _scopeRevision;

  void _clearAttempt({required bool keepSessionId}) {
    if (!keepSessionId) sessionId = null;
    questions = const [];
    reviewWords = const [];
    resultEntries = const [];
    _selectedAnswers.clear();
    _reviewQualities.clear();
    _reviewSaveQueue = Future<void>.value();
    currentIndex = 0;
    selectedOption = null;
    correctCount = 0;
    message = null;
    reviewPersistenceMessage = null;
  }

  /// Clears only in-memory state. The repository journal remains user-scoped.
  void resetForUserScopeChange() {
    _scopeRevision++;
    _requestedTopicId = null;
    _requestedMode = null;
    _clearAttempt(keepSessionId: false);
    status = QuizStatus.idle;
    notifyListeners();
  }
}
