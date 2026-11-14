// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../models/learning_progress.dart';
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
  VocabularyTopicsProvider({required LearningRepository repository})
    : _repository = repository;

  final LearningRepository _repository;
  Future<void>? _initialization;
  int _scopeRevision = 0;

  TopicsStatus status = TopicsStatus.idle;
  List<TopicSummary> topics = [];
  int dailyLearned = 0;
  int dailyGoal = LearningVocabularyProgress.defaultDailyGoal;
  bool remindEnabled = true;
  bool hasUnassignedLegacyProgress = false;
  bool isImportingLegacyProgress = false;
  int dueForReview = 0;
  int totalLearnedWords = 0;

  int reviewCount = 0;
  int newCount = 0;
  int estimateMinutes = 0;
  List<TodayVocabularyPreview> todayPreview = const [];

  String? errorMessage;
  String? persistenceError;

  double get dailyProgress {
    if (dailyGoal <= 0) return 0;
    return (dailyLearned / dailyGoal).clamp(0.0, 1.0).toDouble();
  }

  bool get dailyGoalCompleted => dailyLearned >= dailyGoal;

  Future<void> initialize() {
    return _initialization ??= _refreshProgressFromRepository();
  }

  Future<void> _refreshProgressFromRepository() async {
    final revision = _scopeRevision;
    try {
      final snapshot = await _repository.getVocabularyProgress();
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
    dailyGoal = LearningVocabularyProgress.defaultDailyGoal;
    remindEnabled = true;
    hasUnassignedLegacyProgress = false;
    isImportingLegacyProgress = false;
    totalLearnedWords = 0;
    topics = [];
    errorMessage = null;
    persistenceError = null;
    dueForReview = 0;
    reviewCount = 0;
    newCount = 0;
    estimateMinutes = 0;
    todayPreview = const [];
    notifyListeners();
  }

  void _applyProgress(LearningVocabularyProgress snapshot) {
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
      final snapshot = await _repository.getVocabularyProgress();
      if (revision != _scopeRevision) return;
      _applyProgress(snapshot);
      persistenceError = null;

      await _refreshRepositorySummary(revision);
    } catch (_) {
      if (revision != _scopeRevision) return;
      persistenceError = 'Không thể đọc hoặc đồng bộ tiến trình học.';
    }
    if (revision == _scopeRevision) notifyListeners();
  }

  /// Reads the quarantined pre-account progress marker through the repository.
  /// This is a one-time migration signal, not user-owned progress itself.
  Future<void> refreshLegacyProgressStatus() async {
    final revision = _scopeRevision;
    try {
      final hasLegacyData = await _repository.hasUnassignedLegacyProgress();
      if (revision != _scopeRevision) return;
      hasUnassignedLegacyProgress = hasLegacyData;
    } catch (_) {
      if (revision != _scopeRevision) return;
      persistenceError = 'Không thể kiểm tra dữ liệu học từ phiên bản cũ.';
    }
    if (revision == _scopeRevision) notifyListeners();
  }

  /// Imports quarantined progress only after the user confirms ownership.
  /// The repository and Local Data Source enforce user scope and no-overwrite.
  Future<void> importLegacyProgress({required bool confirmOwnership}) async {
    if (isImportingLegacyProgress) return;
    final revision = _scopeRevision;
    isImportingLegacyProgress = true;
    notifyListeners();
    try {
      final snapshot = await _repository.importUnassignedLegacyProgress(
        confirmOwnership: confirmOwnership,
      );
      if (revision != _scopeRevision) return;
      _applyProgress(snapshot);
      hasUnassignedLegacyProgress = false;
      persistenceError = null;
    } finally {
      if (revision == _scopeRevision) {
        isImportingLegacyProgress = false;
        notifyListeners();
      }
    }
  }

  Future<void> setDailyGoal(int value) async {
    if (value < 5 || value > 100 || value % 5 != 0) return;
    final revision = _scopeRevision;
    final snapshot = await _repository.saveDailyGoal(value);
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
    final snapshot = await _repository.saveReviewSettings(
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
      final snapshot = await _repository.getVocabularyProgress();
      if (revision != _scopeRevision) return;

      final learnedByTopic = <String, int>{};
      for (final word in snapshot.words.values) {
        learnedByTopic.update(
          word.topicId,
          (count) => count + 1,
          ifAbsent: () => 1,
        );
      }

      final repositoryTopics = await _repository.getTopics();
      if (revision != _scopeRevision) return;
      final summary = await _repository.getProgressSummary();
      if (revision != _scopeRevision) return;
      final preview = await _repository.getDueVocabularyPreview(limit: 2);
      if (revision != _scopeRevision) return;

      topics = repositoryTopics
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
      _updateStudyEstimate();
      todayPreview = preview
          .map(
            (item) => TodayVocabularyPreview(
              word: item.vocabulary.word,
              meaning: item.vocabulary.definition,
            ),
          )
          .toList(growable: false);
      status = TopicsStatus.loaded;
    } catch (_) {
      if (revision != _scopeRevision) return;
      errorMessage = 'Không thể tải danh sách chủ đề. Vui lòng thử lại.';
      status = TopicsStatus.error;
    }

    if (revision == _scopeRevision) notifyListeners();
  }

  Future<void> _refreshRepositorySummary(int revision) async {
    final summary = await _repository.getProgressSummary();
    if (revision != _scopeRevision) return;
    final preview = await _repository.getDueVocabularyPreview(limit: 2);
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
