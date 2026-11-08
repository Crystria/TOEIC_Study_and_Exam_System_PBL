import 'package:flutter/foundation.dart';

import '../../../core/storage/vocabulary_progress_storage.dart';

class TopicSummary {
  const TopicSummary({
    required this.id,
    required this.name,
    required this.learned,
    required this.total,
  });

  final String id;
  final String name;
  final int learned;
  final int total;
}

class TodayVocabularyPreview {
  const TodayVocabularyPreview({required this.word, required this.meaning});

  final String word;
  final String meaning;
}

enum TopicsStatus { idle, loading, loaded, error }

class VocabularyTopicsProvider extends ChangeNotifier {
  VocabularyTopicsProvider({VocabularyProgressStorage? storage})
    : _storage = storage ?? VocabularyProgressStorage();

  final VocabularyProgressStorage _storage;
  Future<void>? _initialization;

  TopicsStatus status = TopicsStatus.idle;
  List<TopicSummary> topics = [];
  int dailyLearned = 0;
  int dailyGoal = 20;
  int dueForReview = 27;
  int totalLearnedWords = 0;

  // TodayReview summary components are retained in this Provider.
  int reviewCount = 15;
  int newCount = 5;
  int estimateMinutes = 12;
  List<TodayVocabularyPreview> todayPreview = const [
    TodayVocabularyPreview(word: 'negotiate', meaning: 'thương lượng'),
    TodayVocabularyPreview(word: 'invoice', meaning: 'hóa đơn'),
  ];

  String? errorMessage;
  String? persistenceError;

  double get dailyProgress {
    if (dailyGoal <= 0) return 0;
    return (dailyLearned / dailyGoal).clamp(0.0, 1.0).toDouble();
  }

  bool get dailyGoalCompleted => dailyLearned >= dailyGoal;

  Future<void> initialize() {
    return _initialization ??= _refreshFromStorage();
  }

  Future<void> _refreshFromStorage() async {
    try {
      final snapshot = await _storage.loadSnapshot();
      _applyProgress(snapshot);
      persistenceError = null;
    } catch (error) {
      persistenceError = 'Không thể đọc tiến trình đã lưu: $error';
    }
    notifyListeners();
  }

  void _applyProgress(VocabularyProgressSnapshot snapshot) {
    dailyGoal = snapshot.dailyGoal;
    dailyLearned = snapshot.todayWords.length;
    totalLearnedWords = snapshot.totalLearnedWords;
    _updateStudyEstimate();
  }

  void _updateStudyEstimate() {
    reviewCount = (dailyGoal * 0.75).round();
    newCount = dailyGoal - reviewCount;
    estimateMinutes = (dailyGoal * 0.6).ceil();
  }

  Future<void> refreshProgress() async {
    final snapshot = await _storage.loadSnapshot();
    _applyProgress(snapshot);
    persistenceError = null;
    notifyListeners();
  }

  Future<void> setDailyGoal(int value) async {
    if (value < 5 || value > 100 || value % 5 != 0) return;
    final snapshot = await _storage.saveDailyGoal(value);
    _applyProgress(snapshot);
    notifyListeners();
  }

  Future<void> loadTopics() async {
    await initialize();
    if (status == TopicsStatus.loading) return;
    status = TopicsStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      await Future.delayed(const Duration(milliseconds: 400));
      // TODO: repository.getTopics() + repository.getProgress() +
      // repository.getTodayReviewSummary().
      topics = const [
        TopicSummary(
          id: 't1',
          name: 'Office & Business',
          learned: 7,
          total: 20,
        ),
        TopicSummary(
          id: 't2',
          name: 'Travel & Transport',
          learned: 12,
          total: 24,
        ),
      ];
      status = TopicsStatus.loaded;
    } catch (_) {
      errorMessage = 'Không thể tải danh sách chủ đề. Vui lòng thử lại.';
      status = TopicsStatus.error;
    }
    notifyListeners();
  }
}
