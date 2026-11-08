import 'package:flutter/foundation.dart';

import '../../../core/storage/vocabulary_progress_storage.dart';

class FlashcardItem {
  const FlashcardItem({
    required this.id,
    required this.word,
    required this.phonetic,
    required this.definition,
    required this.example,
    required this.audioUrl,
    required this.masteryGrade,
    required this.topicId,
    required this.topicName,
  });

  final String id;
  final String word;
  final String phonetic;
  final String definition;
  final String example;
  final String audioUrl;
  final int masteryGrade;
  final String topicId;
  final String topicName;

  FlashcardItem withGrade(int grade) => FlashcardItem(
    id: id,
    word: word,
    phonetic: phonetic,
    definition: definition,
    example: example,
    audioUrl: audioUrl,
    masteryGrade: grade,
    topicId: topicId,
    topicName: topicName,
  );
}

enum VocabularyStatus { idle, loading, loaded, finished, error }

enum VocabularyLearningMode { topic, random }

class VocabularyProvider extends ChangeNotifier {
  VocabularyProvider({VocabularyProgressStorage? storage})
    : _storage = storage ?? VocabularyProgressStorage();

  final VocabularyProgressStorage _storage;
  Future<void>? _initialization;

  VocabularyStatus status = VocabularyStatus.idle;
  VocabularyLearningMode currentMode = VocabularyLearningMode.topic;
  List<FlashcardItem> queue = [];
  int currentIndex = 0;
  String? currentTopicId;
  String? errorMessage;
  String? persistenceError;

  final Map<String, int> gradedResults = <String, int>{};
  Map<String, StoredVocabularyWord> _progressRecords = {};

  static const List<FlashcardItem> _catalog = [
    FlashcardItem(
      id: 't1-v1',
      word: 'negotiate',
      phonetic: '/nɪˈɡoʊʃieɪt/',
      definition: 'thương lượng, đàm phán',
      example: 'We need to negotiate the contract terms.',
      audioUrl: '',
      masteryGrade: 5,
      topicId: 't1',
      topicName: 'Office & Business',
    ),
    FlashcardItem(
      id: 't1-v2',
      word: 'invoice',
      phonetic: '/ˈɪnvɔɪs/',
      definition: 'hóa đơn',
      example: 'Please send the invoice by Friday.',
      audioUrl: '',
      masteryGrade: 3,
      topicId: 't1',
      topicName: 'Office & Business',
    ),
    FlashcardItem(
      id: 't1-v3',
      word: 'procurement',
      phonetic: '/prəˈkjʊrmənt/',
      definition: 'việc mua sắm, thu mua',
      example: 'Procurement approved the order.',
      audioUrl: '',
      masteryGrade: 1,
      topicId: 't1',
      topicName: 'Office & Business',
    ),
    FlashcardItem(
      id: 't2-v1',
      word: 'itinerary',
      phonetic: '/aɪˈtɪnəreri/',
      definition: 'lịch trình',
      example: 'Please check the travel itinerary.',
      audioUrl: '',
      masteryGrade: 5,
      topicId: 't2',
      topicName: 'Travel & Transport',
    ),
    FlashcardItem(
      id: 't2-v2',
      word: 'boarding pass',
      phonetic: '/ˈbɔːrdɪŋ pæs/',
      definition: 'thẻ lên máy bay',
      example: 'Show your boarding pass at the gate.',
      audioUrl: '',
      masteryGrade: 3,
      topicId: 't2',
      topicName: 'Travel & Transport',
    ),
    FlashcardItem(
      id: 't2-v3',
      word: 'destination',
      phonetic: '/ˌdestɪˈneɪʃn/',
      definition: 'điểm đến',
      example: 'Our final destination is Seoul.',
      audioUrl: '',
      masteryGrade: 1,
      topicId: 't2',
      topicName: 'Travel & Transport',
    ),
  ];

  FlashcardItem? get current => currentIndex >= 0 && currentIndex < queue.length
      ? queue[currentIndex]
      : null;

  int get totalLearnedWords => _progressRecords.length;

  int get todayLearnedWords => _todayRecords.length;

  List<FlashcardItem> get todayStudiedWords =>
      _todayRecords.map(_toFlashcardItem).toList(growable: false);

  Set<String> get todayStudiedWordIds =>
      _todayRecords.map((record) => record.id).toSet();

  List<StoredVocabularyWord> get _todayRecords {
    final today = VocabularyProgressSnapshot.dateKey(DateTime.now());
    final result = _progressRecords.values
        .where(
          (record) =>
              VocabularyProgressSnapshot.dateKey(record.lastStudiedAt) == today,
        )
        .toList();
    result.sort((a, b) => a.lastStudiedAt.compareTo(b.lastStudiedAt));
    return result;
  }

  Future<void> initialize() {
    return _initialization ??= _loadPersistedProgress();
  }

  Future<void> _loadPersistedProgress() async {
    try {
      _applySnapshot(await _storage.loadSnapshot());
      persistenceError = null;
    } catch (error) {
      persistenceError = 'Không thể đọc tiến trình từ vựng đã lưu: $error';
    }
    notifyListeners();
  }

  void _applySnapshot(VocabularyProgressSnapshot snapshot) {
    _progressRecords = Map<String, StoredVocabularyWord>.from(snapshot.words);
    gradedResults
      ..clear()
      ..addEntries(
        _progressRecords.entries.map(
          (entry) => MapEntry(entry.key, entry.value.grade),
        ),
      );
  }

  FlashcardItem _toFlashcardItem(StoredVocabularyWord record) {
    return FlashcardItem(
      id: record.id,
      word: record.word,
      phonetic: record.phonetic,
      definition: record.definition,
      example: record.example,
      audioUrl: record.audioUrl,
      masteryGrade: record.grade,
      topicId: record.topicId,
      topicName: record.topicName,
    );
  }

  int _effectiveGrade(FlashcardItem item) =>
      gradedResults[item.id] ?? item.masteryGrade;

  bool _wasStudiedToday(String wordId) => todayStudiedWordIds.contains(wordId);

  Future<void> loadTopic(String topicId) async {
    await initialize();
    currentMode = VocabularyLearningMode.topic;
    currentTopicId = topicId;
    status = VocabularyStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      await Future.delayed(const Duration(milliseconds: 250));
      queue = _catalog
          .where((item) => item.topicId == topicId)
          // Topic mode intentionally keeps only Grade 5 words, as agreed.
          .where((item) => _effectiveGrade(item) == 5)
          // Previously completed words stay counted and are not repeated today.
          .where((item) => !_wasStudiedToday(item.id))
          .toList();
      currentIndex = 0;
      status = queue.isEmpty
          ? VocabularyStatus.finished
          : VocabularyStatus.loaded;
    } catch (error) {
      errorMessage = 'Không thể tải từ vựng của chủ đề. Vui lòng thử lại.';
      status = VocabularyStatus.error;
    }
    notifyListeners();
  }

  Future<void> loadRandom() async {
    await initialize();
    currentMode = VocabularyLearningMode.random;
    currentTopicId = null;
    status = VocabularyStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      await Future.delayed(const Duration(milliseconds: 250));
      queue = _catalog
          .where((item) => !_wasStudiedToday(item.id))
          // Random mode deliberately mixes Grade 1, 3 and 5 across topics.
          .map((item) => item.withGrade(_effectiveGrade(item)))
          .toList();
      queue.shuffle();
      currentIndex = 0;
      status = queue.isEmpty
          ? VocabularyStatus.finished
          : VocabularyStatus.loaded;
    } catch (error) {
      errorMessage = 'Không thể tạo danh sách từ ngẫu nhiên. Vui lòng thử lại.';
      status = VocabularyStatus.error;
    }
    notifyListeners();
  }

  Future<void> reloadCurrentSession() {
    return currentMode == VocabularyLearningMode.random
        ? loadRandom()
        : loadTopic(currentTopicId ?? 't1');
  }

  Future<void> playAudio() async {
    // TODO: phát current?.audioUrl bằng audioplayers/just_audio.
  }

  Future<void> grade(int quality) async {
    final item = current;
    if (item == null || status != VocabularyStatus.loaded) return;
    if (quality != 1 && quality != 3 && quality != 5) return;

    try {
      // Persist before advancing. If the write fails, the current card remains
      // visible so the user can retry rather than silently losing progress.
      final snapshot = await _storage.recordStudiedWord(
        wordId: item.id,
        word: item.word,
        phonetic: item.phonetic,
        definition: item.definition,
        example: item.example,
        audioUrl: item.audioUrl,
        topicId: item.topicId,
        topicName: item.topicName,
        grade: quality,
      );
      _applySnapshot(snapshot);

      if (currentIndex + 1 < queue.length) {
        currentIndex++;
      } else {
        status = VocabularyStatus.finished;
      }
      persistenceError = null;
      notifyListeners();
    } catch (error) {
      persistenceError = 'Không thể lưu kết quả từ vựng. Vui lòng thử lại.';
      notifyListeners();
      rethrow;
    }
  }

  /// Quiz phase can read this persisted list to build today's question set.
  /// The list contains each unique word last studied on the device's local day.
  Future<List<FlashcardItem>> getWordsStudiedTodayForQuiz() async {
    await initialize();
    return todayStudiedWords;
  }

  /// Clears only the active in-memory queue; persisted study history is kept.
  void reset() {
    queue = [];
    currentIndex = 0;
    currentTopicId = null;
    currentMode = VocabularyLearningMode.topic;
    status = VocabularyStatus.idle;
    notifyListeners();
  }
}
