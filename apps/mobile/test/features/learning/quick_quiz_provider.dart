import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/learning/providers/quick_quiz_provider.dart';
import 'package:toeic_mobile/features/learning/providers/vocabulary_provider.dart';

void main() {
  late QuickQuizProvider provider;

  setUp(() {
    provider = QuickQuizProvider();
  });

  tearDown(() {
    provider.dispose();
  });

  test('requires at least five distinct studied words', () async {
    await provider.loadQuestions(_words().take(4).toList());

    expect(provider.status, QuizStatus.unavailable);
    expect(provider.questions, isEmpty);
    expect(provider.message, contains('ít nhất 5 từ khác nhau'));
  });

  test('builds and submits exactly five answered questions', () async {
    await provider.loadQuestions(_words());

    expect(provider.status, QuizStatus.loaded);
    expect(provider.totalQuestions, QuickQuizProvider.questionCount);
    expect(
      provider.questions.every((question) => question.options.length == 4),
      isTrue,
    );
    expect(
      provider.questions.every(
        (question) =>
            question.options.toSet().length == question.options.length &&
            question.correctIndex >= 0,
      ),
      isTrue,
    );

    expect(provider.submitQuiz(), isFalse);

    for (var index = 0; index < provider.totalQuestions; index++) {
      if (index > 0) provider.continueToNextQuestion();
      provider.select(provider.questions[index].correctIndex);
    }

    expect(provider.submitQuiz(), isTrue);
    expect(provider.status, QuizStatus.finished);
    expect(provider.correctCount, 5);
    expect(provider.resultEntries, hasLength(5));
    expect(provider.wrongAnswers, isEmpty);
  });

  test('ignores a pending quiz load after account scope is reset', () async {
    final pendingLoad = provider.loadQuestions(_words());
    provider.resetForUserScopeChange();

    await pendingLoad;

    expect(provider.status, QuizStatus.idle);
    expect(provider.questions, isEmpty);
    expect(provider.resultEntries, isEmpty);
  });

  test(
    'discard clears the current attempt without retaining its result',
    () async {
      await provider.loadQuestions(_words());
      provider.select(provider.questions.first.correctIndex);
      provider.discardCurrentAttempt();

      expect(provider.status, QuizStatus.idle);
      expect(provider.questions, isEmpty);
      expect(provider.resultEntries, isEmpty);
      expect(provider.correctCount, 0);
    },
  );
}

List<FlashcardItem> _words() => List<FlashcardItem>.generate(
  5,
  (index) => FlashcardItem(
    id: 'word-$index',
    word: 'word$index',
    phonetic: '/wɜːd/',
    definition: 'meaning $index',
    example: 'Example sentence $index.',
    audioUrl: '',
    masteryGrade: 0,
    topicId: 'topic-1',
    topicName: 'Office',
  ),
);
