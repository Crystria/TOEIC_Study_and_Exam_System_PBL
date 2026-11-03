import 'package:flutter/foundation.dart';

class QuizQuestion {
  const QuizQuestion({
    required this.word,
    required this.phonetic,
    required this.options,
    required this.correctIndex,
  });
  final String word;
  final String phonetic;
  final List<String> options;
  final int correctIndex;
}

enum QuizStatus { idle, loading, loaded, finished }

class QuickQuizProvider extends ChangeNotifier {
  QuizStatus status = QuizStatus.idle;
  List<QuizQuestion> questions = [];
  int currentIndex = 0;
  int? selectedOption;
  int correctCount = 0;
  bool? lastAnswerCorrect;

  Future<void> loadQuestions(List<String> recentWordIds) async {
    status = QuizStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 400));
    // TODO: repository.generateQuizFromRecentWords(recentWordIds)
    questions = const [
      QuizQuestion(
        word: 'negotiate',
        phonetic: "/nɪˈɡoʊʃiert/",
        options: ['thương lượng', 'hợp đồng', 'hóa đơn', 'đề xuất'],
        correctIndex: 0,
      ),
    ];
    currentIndex = 0;
    status = QuizStatus.loaded;
    notifyListeners();
  }

  void select(int index) {
    selectedOption = index;
    notifyListeners();
  }

  Future<void> check() async {
    if (selectedOption == null) return;
    lastAnswerCorrect = selectedOption == questions[currentIndex].correctIndex;
    if (lastAnswerCorrect == true) correctCount++;
    await Future.delayed(const Duration(milliseconds: 300)); // TODO: repository.submitQuizAnswer(...)

    if (currentIndex + 1 < questions.length) {
      currentIndex++;
      selectedOption = null;
      lastAnswerCorrect = null;
    } else {
      status = QuizStatus.finished; // screen điều hướng sang ReviewResultScreen
    }
    notifyListeners();
  }

  void skip() {
    if (currentIndex + 1 < questions.length) {
      currentIndex++;
      selectedOption = null;
    } else {
      status = QuizStatus.finished;
    }
    notifyListeners();
  }
}
