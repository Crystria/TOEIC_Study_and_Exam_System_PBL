import 'package:flutter/foundation.dart';

import '../models/mock_test_submission.dart';
import '../models/test_attempt_group.dart';
import '../models/test_attempt_question.dart';

enum ExplanationStatus { loaded }

enum ExplanationFilter { all, correct, incorrect, unanswered }

enum ExplanationAnswerState { correct, incorrect, unanswered }

/// Navigation and filter state for reviewing a submitted Attempt snapshot.
class AnswerExplanationProvider extends ChangeNotifier {
  AnswerExplanationProvider({required this.submission, int initialIndex = 0})
    : currentQuestionIndex = submission.questionReviews.isEmpty
          ? 0
          : initialIndex
                .clamp(0, submission.questionReviews.length - 1)
                .toInt();

  final MockTestSubmission submission;
  int currentQuestionIndex;
  ExplanationFilter selectedFilter = ExplanationFilter.all;

  ExplanationStatus get status => ExplanationStatus.loaded;
  List<MockTestQuestionReview> get reviews => submission.questionReviews;
  int get totalQuestions => reviews.length;
  int get filteredQuestionCount => filteredQuestionIndexes.length;
  int get currentNumber {
    final position = filteredQuestionIndexes.indexOf(currentQuestionIndex);
    return position < 0 ? 0 : position + 1;
  }

  MockTestQuestionReview? get currentReview =>
      reviews.isEmpty ? null : reviews[currentQuestionIndex];

  TestAttemptQuestion? get currentQuestion => currentReview?.question;

  TestAttemptGroup? get currentGroup =>
      submission.groupFor(currentQuestion?.groupId);

  bool get currentMatchesFilter =>
      reviews.isNotEmpty && _matchesFilter(stateForIndex(currentQuestionIndex));

  List<int> get filteredQuestionIndexes =>
      List<int>.generate(totalQuestions, (index) => index, growable: false)
          .where((index) => _matchesFilter(stateForIndex(index)))
          .toList(growable: false);

  ExplanationAnswerState stateForIndex(int index) {
    if (index < 0 || index >= totalQuestions) {
      throw RangeError.index(index, reviews, 'index');
    }
    final review = reviews[index];
    if (!review.isAnswered) return ExplanationAnswerState.unanswered;
    return review.isCorrect
        ? ExplanationAnswerState.correct
        : ExplanationAnswerState.incorrect;
  }

  int countForFilter(ExplanationFilter filter) {
    if (filter == ExplanationFilter.all) return totalQuestions;
    return List<int>.generate(totalQuestions, (index) => index).where((index) {
      final state = stateForIndex(index);
      switch (filter) {
        case ExplanationFilter.all:
          return true;
        case ExplanationFilter.correct:
          return state == ExplanationAnswerState.correct;
        case ExplanationFilter.incorrect:
          return state == ExplanationAnswerState.incorrect;
        case ExplanationFilter.unanswered:
          return state == ExplanationAnswerState.unanswered;
      }
    }).length;
  }

  bool _matchesFilter(ExplanationAnswerState state) {
    switch (selectedFilter) {
      case ExplanationFilter.all:
        return true;
      case ExplanationFilter.correct:
        return state == ExplanationAnswerState.correct;
      case ExplanationFilter.incorrect:
        return state == ExplanationAnswerState.incorrect;
      case ExplanationFilter.unanswered:
        return state == ExplanationAnswerState.unanswered;
    }
  }

  bool get canGoPrevious {
    final indexes = filteredQuestionIndexes;
    final position = indexes.indexOf(currentQuestionIndex);
    return position > 0;
  }

  bool get canGoNext {
    final indexes = filteredQuestionIndexes;
    final position = indexes.indexOf(currentQuestionIndex);
    return position >= 0 && position < indexes.length - 1;
  }

  void setFilter(ExplanationFilter filter) {
    if (selectedFilter == filter) return;
    selectedFilter = filter;
    final visibleIndexes = filteredQuestionIndexes;
    if (visibleIndexes.isNotEmpty &&
        !visibleIndexes.contains(currentQuestionIndex)) {
      currentQuestionIndex = visibleIndexes.first;
    }
    notifyListeners();
  }

  void goPrev() {
    final indexes = filteredQuestionIndexes;
    final position = indexes.indexOf(currentQuestionIndex);
    if (position <= 0) return;
    currentQuestionIndex = indexes[position - 1];
    notifyListeners();
  }

  void goNext() {
    final indexes = filteredQuestionIndexes;
    final position = indexes.indexOf(currentQuestionIndex);
    if (position < 0 || position >= indexes.length - 1) return;
    currentQuestionIndex = indexes[position + 1];
    notifyListeners();
  }

  void goToQuestion(int index) {
    if (index < 0 || index >= totalQuestions || index == currentQuestionIndex) {
      return;
    }
    if (!_matchesFilter(stateForIndex(index))) return;
    currentQuestionIndex = index;
    notifyListeners();
  }
}
