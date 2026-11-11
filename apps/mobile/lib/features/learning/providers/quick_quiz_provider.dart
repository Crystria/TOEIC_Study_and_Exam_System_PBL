import 'dart:math';

import 'package:flutter/foundation.dart';

import 'vocabulary_provider.dart';

class QuizQuestion {
  const QuizQuestion({
    required this.wordId,
    required this.word,
    required this.phonetic,
    required this.options,
    required this.correctIndex,
  });

  final String wordId;
  final String word;
  final String phonetic;
  final List<String> options;
  final int correctIndex;

  String get correctAnswer => options[correctIndex];
}

class QuizResultEntry {
  const QuizResultEntry({
    required this.question,
    required this.selectedAnswer,
    required this.correctAnswer,
  });

  final QuizQuestion question;
  final String selectedAnswer;
  final String correctAnswer;

  bool get isCorrect => selectedAnswer == correctAnswer;
}

enum QuizStatus { idle, loading, loaded, finished, unavailable, error }

class QuickQuizProvider extends ChangeNotifier {
  static const int questionCount = 5;

  final Random _random = Random();
  int _scopeRevision = 0;
  List<QuizQuestion> questions = [];
  List<int?> _selectedAnswers = [];
  List<QuizResultEntry> resultEntries = [];
  int currentIndex = 0;
  int? selectedOption;
  int correctCount = 0;
  QuizStatus status = QuizStatus.idle;
  String? message;
  List<String> _lastQuestionWordIds = const [];
  Set<String> _lastQuestionWordSet = const <String>{};

  int get totalQuestions => questions.length;
  bool get isLastQuestion =>
      questions.isNotEmpty && currentIndex == questions.length - 1;
  bool get hasSelection => selectedOption != null;
  List<QuizResultEntry> get wrongAnswers =>
      resultEntries.where((item) => !item.isCorrect).toList(growable: false);

  /// Creates exactly five questions from the words studied on the local day.
  /// Each question uses the word's definition as its correct option and three
  /// other distinct definitions from the same five-word quiz set as distractors.
  ///
  /// This stays app-side even when the Learning API is enabled: the Backend's
  /// vocabulary-session endpoint selects only NEW (no progress row) or REVIEW
  /// (already due) words, while this product flow must test today's studied
  /// words, which already received their Backend SM-2 update in
  /// [VocabularyProvider.grade].
  Future<void> loadQuestions(List<FlashcardItem> studiedToday) async {
    final revision = _scopeRevision;
    status = QuizStatus.loading;
    message = null;
    questions = [];
    resultEntries = [];
    _selectedAnswers = [];
    currentIndex = 0;
    selectedOption = null;
    correctCount = 0;
    notifyListeners();

    await Future<void>.delayed(const Duration(milliseconds: 250));
    if (revision != _scopeRevision) return;

    final uniqueById = <String, FlashcardItem>{};
    for (final word in studiedToday) {
      if (word.id.trim().isNotEmpty && word.definition.trim().isNotEmpty) {
        uniqueById[word.id] = word;
      }
    }
    final candidates = uniqueById.values.toList(growable: false);

    if (candidates.length < questionCount) {
      status = QuizStatus.unavailable;
      message =
          'Bạn cần học ít nhất $questionCount từ khác nhau hôm nay để tạo Quiz.';
      notifyListeners();
      return;
    }

    List<FlashcardItem>? selectedWords;
    List<FlashcardItem>? validFallback;
    for (var attempt = 0; attempt < 30; attempt++) {
      final shuffled = List<FlashcardItem>.from(candidates)..shuffle(_random);
      final sample = shuffled.take(questionCount).toList(growable: false);
      final distinctDefinitions = sample
          .map((item) => _normalizeDefinition(item.definition))
          .where((value) => value.isNotEmpty)
          .toSet();
      if (distinctDefinitions.length < 4) continue;

      validFallback ??= sample;
      final sampleIds = sample.map((item) => item.id).toSet();
      final isDifferentSet =
          _lastQuestionWordSet.isEmpty ||
          !_sameWordSet(sampleIds, _lastQuestionWordSet);
      if (isDifferentSet || candidates.length == questionCount) {
        selectedWords = sample;
        break;
      }
    }
    selectedWords ??= validFallback;

    if (selectedWords == null) {
      status = QuizStatus.unavailable;
      message = 'Chưa đủ nghĩa từ khác nhau để tạo 5 câu hỏi. Hãy học thêm các từ khác hôm nay.';
      notifyListeners();
      return;
    }

    var wordIds = selectedWords.map((item) => item.id).toList(growable: true);
    // A retake with only five eligible words still creates a new question order.
    if (_sameSequence(wordIds, _lastQuestionWordIds) && wordIds.length > 1) {
      wordIds = [...wordIds.skip(1), wordIds.first];
      final byId = {for (final item in selectedWords) item.id: item};
      selectedWords = wordIds.map((id) => byId[id]!).toList(growable: false);
    }
    _lastQuestionWordIds = List<String>.unmodifiable(wordIds);
    _lastQuestionWordSet = wordIds.toSet();

    final definitions = selectedWords
        .map((item) => item.definition.trim())
        .fold<List<String>>([], (values, definition) {
          if (!_containsDefinition(values, definition)) values.add(definition);
          return values;
        });

    questions = selectedWords
        .map((item) {
          final correct = item.definition.trim();
          final distractors =
              definitions
                  .where(
                    (definition) =>
                        _normalizeDefinition(definition) !=
                        _normalizeDefinition(correct),
                  )
                  .toList(growable: true)
                ..shuffle(_random);
          final options = <String>[correct, ...distractors.take(3)]
            ..shuffle(_random);
          return QuizQuestion(
            wordId: item.id,
            word: item.word,
            phonetic: item.phonetic,
            options: List<String>.unmodifiable(options),
            correctIndex: options.indexOf(correct),
          );
        })
        .toList(growable: false);

    _selectedAnswers = List<int?>.filled(questionCount, null);
    status = QuizStatus.loaded;
    notifyListeners();
  }

  void setUnavailable(String reason) {
    questions = [];
    _selectedAnswers = [];
    resultEntries = [];
    currentIndex = 0;
    selectedOption = null;
    correctCount = 0;
    message = reason;
    status = QuizStatus.unavailable;
    notifyListeners();
  }

  void setError(String reason) {
    message = reason;
    status = QuizStatus.error;
    notifyListeners();
  }

  void select(int index) {
    if (status != QuizStatus.loaded || questions.isEmpty) return;
    if (index < 0 || index >= questions[currentIndex].options.length) return;
    selectedOption = index;
    _selectedAnswers[currentIndex] = index;
    notifyListeners();
  }

  void discardCurrentAttempt() {
    questions = [];
    _selectedAnswers = [];
    resultEntries = [];

    currentIndex = 0;
    selectedOption = null;
    correctCount = 0;

    message = null;
    status = QuizStatus.idle;

    notifyListeners();
  }

  /// Advances only after an answer has been selected. Submission of the fifth
  /// answer is deliberately handled separately after UI confirmation.
  void continueToNextQuestion() {
    if (status != QuizStatus.loaded ||
        selectedOption == null ||
        isLastQuestion) {
      return;
    }
    currentIndex++;
    selectedOption = _selectedAnswers[currentIndex];
    notifyListeners();
  }

  /// Returns false unless all five questions have an answer.
  bool submitQuiz() {
    if (status != QuizStatus.loaded ||
        questions.length != questionCount ||
        _selectedAnswers.length != questionCount ||
        _selectedAnswers.any((answer) => answer == null)) {
      return false;
    }

    correctCount = 0;
    resultEntries = [];
    for (var index = 0; index < questions.length; index++) {
      final question = questions[index];
      final selected = question.options[_selectedAnswers[index]!];
      final correct = question.correctAnswer;
      final result = QuizResultEntry(
        question: question,
        selectedAnswer: selected,
        correctAnswer: correct,
      );
      resultEntries.add(result);
      if (result.isCorrect) correctCount++;
    }
    status = QuizStatus.finished;
    notifyListeners();
    return true;
  }

  /// Discards user-specific quiz state when the active account changes.
  void resetForUserScopeChange() {
    _scopeRevision++;
    questions = [];
    _selectedAnswers = [];
    resultEntries = [];
    currentIndex = 0;
    selectedOption = null;
    correctCount = 0;
    status = QuizStatus.idle;
    message = null;
    _lastQuestionWordIds = const [];
    _lastQuestionWordSet = const <String>{};
    notifyListeners();
  }

  static String _normalizeDefinition(String value) =>
      value.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

  static bool _containsDefinition(List<String> values, String candidate) {
    final normalized = _normalizeDefinition(candidate);
    return values.any((value) => _normalizeDefinition(value) == normalized);
  }

  static bool _sameWordSet(Set<String> first, Set<String> second) {
    if (first.length != second.length) return false;
    return first.containsAll(second);
  }

  static bool _sameSequence(List<String> first, List<String> second) {
    if (first.length != second.length || second.isEmpty) return false;
    for (var index = 0; index < first.length; index++) {
      if (first[index] != second[index]) return false;
    }
    return true;
  }
}
