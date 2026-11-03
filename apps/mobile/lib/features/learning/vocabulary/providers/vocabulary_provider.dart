import 'package:flutter/foundation.dart';

class FlashcardItem {
  const FlashcardItem({
    required this.id,
    required this.word,
    required this.phonetic,
    required this.definition,
    required this.example,
    required this.audioUrl,
  });

  final String id;
  final String word;
  final String phonetic;
  final String definition;
  final String example;
  final String audioUrl;
}

enum VocabularyStatus { idle, loading, loaded, finished, error }

class VocabularyProvider extends ChangeNotifier {
  VocabularyStatus status = VocabularyStatus.idle;
  List<FlashcardItem> queue = [];
  int currentIndex = 0;

  FlashcardItem? get current => currentIndex < queue.length ? queue[currentIndex] : null;

  Future<void> loadTopic(String topicId) async {
    status = VocabularyStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 500));
    // TODO: repository.getNewAndDueWords(topicId)
    queue = const [
      FlashcardItem(
        id: 'v1',
        word: 'negotiate',
        phonetic: "/nɪˈɡoʊʃiert/",
        definition: 'thương lượng, đàm phán',
        example: '"We need to negotiate the contract terms."',
        audioUrl: '',
      ),
    ];
    currentIndex = 0;
    status = VocabularyStatus.loaded;
    notifyListeners();
  }

  Future<void> playAudio() async {
    // TODO: phát current?.audioUrl bằng audioplayers/just_audio
  }

  Future<void> grade(int quality) async {
    await Future.delayed(const Duration(milliseconds: 300));
    // TODO: repository.reviewFlashcard(current!.id, quality) -> trả về SM-2 mới
    if (currentIndex + 1 < queue.length) {
      currentIndex++;
    } else {
      status = VocabularyStatus.finished; // screen điều hướng sang màn hoàn thành/trang chủ nếu cần
    }
    notifyListeners();
  }
}
