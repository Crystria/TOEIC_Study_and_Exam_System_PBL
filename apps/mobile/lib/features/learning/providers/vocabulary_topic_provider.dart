// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../core/storage/vocabulary_progress_storage.dart';
import '../models/learning_models.dart';
import '../repositories/learning_repository.dart';

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
  VocabularyTopicsProvider({
    VocabularyProgressStorage? storage,
    LearningRepository? repository,
    List<LearningTopic>? mockTopics,
  }) : _storage = storage ?? VocabularyProgressStorage(),
       _repository = repository,
       _mockTopics = mockTopics ?? _defaultMockTopics {
    if (_repository != null) {
      // Never show fixture counts/previews while API data is loading.
      dueForReview = 0;
      reviewCount = 0;
      newCount = 0;
      estimateMinutes = 0;
      todayPreview = const [];
    }
  }

  final VocabularyProgressStorage _storage;
  final LearningRepository? _repository;
  final List<LearningTopic> _mockTopics;
  static const List<LearningTopic> _defaultMockTopics = [
    LearningTopic(id: 't1', name: 'Office & Business', vocabularyCount: 20),
    LearningTopic(id: 't2', name: 'Travel & Transport', vocabularyCount: 24),
  ];
  Future<void>? _initialization;
  int _scopeRevision = 0;

  TopicsStatus status = TopicsStatus.idle;
  List<TopicSummary> topics = [];
  int dailyLearned = 0;
  int dailyGoal = VocabularyProgressSnapshot.defaultDailyGoal;
  bool remindEnabled = true;
  int dueForReview = 27;
  int totalLearnedWords = 0;

  // Preview fixture data is used only in Mock/Local mode.
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
    final revision = _scopeRevision;
    try {
      final snapshot = await _storage.loadSnapshot();
      if (revision != _scopeRevision) return;
      _applyProgress(snapshot);
      persistenceError = null;
    } catch (_) {
      if (revision != _scopeRevision) return;
      persistenceError = 'Không thể đọc tiến trình đã lưu.';
    }
    if (revision == _scopeRevision) notifyListeners();
  }

  void resetForUserScopeChange() {
    _scopeRevision++;
    _initialization = null;
    status = TopicsStatus.idle;
    dailyLearned = 0;
    dailyGoal = VocabularyProgressSnapshot.defaultDailyGoal;
    remindEnabled = true;
    totalLearnedWords = 0;
    topics = [];
    errorMessage = null;
    persistenceError = null;
    dueForReview = _repository == null ? 27 : 0;
    reviewCount = _repository == null ? 15 : 0;
    newCount = _repository == null ? 5 : 0;
    estimateMinutes = _repository == null ? 12 : 0;
    todayPreview = _repository == null
        ? const [
            TodayVocabularyPreview(word: 'negotiate', meaning: 'thương lượng'),
            TodayVocabularyPreview(word: 'invoice', meaning: 'hóa đơn'),
          ]
        : const [];
    notifyListeners();
  }

  void _applyProgress(VocabularyProgressSnapshot snapshot) {
    dailyGoal = snapshot.dailyGoal;
    remindEnabled = snapshot.remindEnabled;
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
    final revision = _scopeRevision;
    try {
      final snapshot = await _storage.loadSnapshot();
      if (revision != _scopeRevision) return;
      _applyProgress(snapshot);
      persistenceError = null;

      if (_repository != null) {
        await _refreshApiSummary(revision);
      }
    } catch (_) {
      if (revision != _scopeRevision) return;
      persistenceError = 'Không thể đọc hoặc đồng bộ tiến trình học.';
    }
    if (revision == _scopeRevision) notifyListeners();
  }

  Future<void> setDailyGoal(int value) async {
    if (value < 5 || value > 100 || value % 5 != 0) return;
    final revision = _scopeRevision;
    final snapshot = await _storage.saveDailyGoal(value);
    if (revision != _scopeRevision) return;
    _applyProgress(snapshot);
    notifyListeners();
  }

  Future<void> saveReviewSettings({
    required int dailyGoal,
    required bool remindEnabled,
  }) async {
    if (dailyGoal < 5 || dailyGoal > 100 || dailyGoal % 5 != 0) return;
    final revision = _scopeRevision;
    final snapshot = await _storage.saveReviewSettings(
      dailyGoal: dailyGoal,
      remindEnabled: remindEnabled,
    );
    if (revision != _scopeRevision) return;
    _applyProgress(snapshot);
    notifyListeners();
  }

  Future<void> loadTopics() async {
    final revision = _scopeRevision;
    await initialize();
    if (revision != _scopeRevision) return;
    if (status == TopicsStatus.loading) return;

    status = TopicsStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      final snapshot = await _storage.loadSnapshot();
      if (revision != _scopeRevision) return;

      final learnedByTopic = <String, int>{};
      for (final word in snapshot.words.values) {
        learnedByTopic.update(
          word.topicId,
          (count) => count + 1,
          ifAbsent: () => 1,
        );
      }

      if (_repository != null) {
        final serverTopics = await _repository.getTopics();
        if (revision != _scopeRevision) return;
        final summary = await _repository.getProgressSummary();
        if (revision != _scopeRevision) return;
        final preview = await _repository.getDueVocabularyPreview(limit: 2);
        if (revision != _scopeRevision) return;

        topics = serverTopics
            .map(
              (topic) => TopicSummary(
                id: topic.id,
                name: topic.name,
                learned: learnedByTopic[topic.id] ?? 0,
                total: topic.vocabularyCount,
              ),
            )
            .toList(growable: false);
        totalLearnedWords = summary.vocabulariesLearned;
        dueForReview = summary.dueVocabularies;
        // reviewCount/newCount remain the existing daily-plan split
        // (75% review + 25% new). dueForReview is the authoritative Backend
        // count and is displayed separately in the review section.
        _updateStudyEstimate();
        todayPreview = preview
            .map(
              (item) => TodayVocabularyPreview(
                word: item.vocabulary.word,
                meaning: item.vocabulary.definition,
              ),
            )
            .toList(growable: false);
      } else {
        await Future<void>.delayed(const Duration(milliseconds: 400));
        if (revision != _scopeRevision) return;
        topics = _mockTopics
            .map(
              (topic) => TopicSummary(
                id: topic.id,
                name: topic.name,
                learned: learnedByTopic[topic.id] ?? 0,
                total: topic.vocabularyCount,
              ),
            )
            .toList(growable: false);
      }
      status = TopicsStatus.loaded;
    } catch (_) {
      if (revision != _scopeRevision) return;
      errorMessage = 'Không thể tải danh sách chủ đề. Vui lòng thử lại.';
      status = TopicsStatus.error;
    }

    if (revision == _scopeRevision) notifyListeners();
  }

  Future<void> _refreshApiSummary(int revision) async {
    final repository = _repository;
    if (repository == null) return;

    final summary = await repository.getProgressSummary();
    if (revision != _scopeRevision) return;
    final preview = await repository.getDueVocabularyPreview(limit: 2);
    if (revision != _scopeRevision) return;

    totalLearnedWords = summary.vocabulariesLearned;
    dueForReview = summary.dueVocabularies;
    _updateStudyEstimate();
    todayPreview = preview
        .map(
          (item) => TodayVocabularyPreview(
            word: item.vocabulary.word,
            meaning: item.vocabulary.definition,
          ),
        )
        .toList(growable: false);
  }
}
