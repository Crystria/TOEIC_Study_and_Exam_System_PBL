// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';

import '../repositories/learning_local_state_repository.dart';
import '../repositories/learning_repository.dart';

enum WordMastery { chuaThuoc, moHo, daThuoc }

enum ReviewWordsSource { due, allLearned }

class ReviewWord {
  ReviewWord({
    required this.id,
    required this.word,
    required this.meaning,
    required this.mastery,
    this.phonetic = '',
    this.example = '',
    this.audioUrl = '',
    this.selected = false,
    this.topicId = '',
    this.topicName = '',
    this.baseEntityRevision = '0',
  });

  final String id;
  final String word;
  final String meaning;
  final WordMastery mastery;
  final String phonetic;
  final String example;
  final String audioUrl;
  bool selected;
  final String topicId;
  final String topicName;
  final String baseEntityRevision;
}

enum ReviewSelectStatus { idle, loading, loaded, error }

class ReviewSelectWordsProvider extends ChangeNotifier {
  ReviewSelectWordsProvider({
    required LearningRepository repository,
    required LearningLocalStateRepository localStateRepository,
    required String? Function() currentUserId,
  }) : _repository = repository,
       _localStateRepository = localStateRepository,
       _currentUserId = currentUserId;

  final LearningRepository _repository;
  final LearningLocalStateRepository _localStateRepository;
  final String? Function() _currentUserId;
  int _scopeRevision = 0;
  ReviewSelectStatus status = ReviewSelectStatus.idle;
  String? errorMessage;
  String? _loadedUserId;
  String? get loadedUserId => _loadedUserId;
  String selectedTopicId = '';
  final Map<String, String> _topicNames = {};
  final Map<String, List<ReviewWord>> _wordsByTopic = {};
  static const String allTopicsId = '__all_topics__';

  ReviewWordsSource source = ReviewWordsSource.due;

  Map<String, String> get topicOptions {
    if (source == ReviewWordsSource.allLearned) {
      return Map.unmodifiable({allTopicsId: 'Tất cả chủ đề', ..._topicNames});
    }

    return Map.unmodifiable(_topicNames);
  }

  List<ReviewWord> get words {
    return List.unmodifiable(
      _wordsByTopic[selectedTopicId] ?? const <ReviewWord>[],
    );
  }

  List<ReviewWord> get selectedWords =>
      words.where((word) => word.selected).toList(growable: false);
  int get selectedCount => selectedWords.length;
  int get totalCount => words.length;

  Future<void> loadDueWords([String? topicId]) {
    return loadSource(source: ReviewWordsSource.due, topicId: topicId);
  }

  Future<void> loadAllLearnedWords([String? topicId]) {
    return loadSource(source: ReviewWordsSource.allLearned, topicId: topicId);
  }

  Future<void> reload() {
    final topicId = selectedTopicId == allTopicsId || selectedTopicId.isEmpty
        ? null
        : selectedTopicId;

    return loadSource(source: source, topicId: topicId);
  }

  Future<void> loadSource({
    required ReviewWordsSource source,
    String? topicId,
  }) async {
    final revision = _scopeRevision;
    final userIdAtStart = _currentUserId()?.trim();

    if (this.source != source) {
      selectedTopicId = '';
    }

    this.source = source;
    _loadedUserId = null;

    status = ReviewSelectStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      final topicsFromRepository = await _repository.getTopics();

      if (!_isCurrent(revision, userIdAtStart)) return;

      final localProgress = await _localStateRepository.getVocabularyProgress();

      if (!_isCurrent(revision, userIdAtStart)) return;

      final nextTopicNames = <String, String>{
        for (final topic in topicsFromRepository) topic.id: topic.name,
      };

      final nextWordsByTopic = <String, List<ReviewWord>>{};

      if (source == ReviewWordsSource.due) {
        final dueWords = await _repository.getDueVocabulary(topicId: topicId);

        if (!_isCurrent(revision, userIdAtStart)) return;

        for (final due in dueWords) {
          final item = due.vocabulary;
          final saved = localProgress.words[item.id];

          final quality = saved?.grade ?? due.quality ?? 0;
          final serverRevision = saved?.serverRevision ?? due.revision;

          final word = ReviewWord(
            id: item.id,
            word: item.word,
            meaning: item.definition,
            mastery: _masteryFromGrade(quality),
            phonetic: item.phonetic,
            example: item.example,
            audioUrl: item.audioUrl,
            topicId: item.topicId,
            topicName: item.topicName,
            baseEntityRevision: serverRevision,
          );

          nextWordsByTopic
              .putIfAbsent(item.topicId, () => <ReviewWord>[])
              .add(word);

          nextTopicNames.putIfAbsent(item.topicId, () => item.topicName);
        }
      } else {
        // Local progress is the source of all previously studied words.
        // Grade 1, 3 and 5 are all included.
        final records = localProgress.words.values.toList()
          ..sort((a, b) => b.lastStudiedAt.compareTo(a.lastStudiedAt));

        final allWords = <ReviewWord>[];

        for (final record in records) {
          final word = ReviewWord(
            id: record.id,
            word: record.word,
            meaning: record.definition,
            mastery: _masteryFromGrade(record.grade),
            phonetic: record.phonetic,
            example: record.example,
            audioUrl: record.audioUrl,
            topicId: record.topicId,
            topicName: record.topicName,
            baseEntityRevision: record.serverRevision ?? '0',
          );

          allWords.add(word);

          nextWordsByTopic
              .putIfAbsent(record.topicId, () => <ReviewWord>[])
              .add(word);

          nextTopicNames.putIfAbsent(record.topicId, () => record.topicName);
        }

        // Aggregate queue for the "Tất cả chủ đề" filter.
        nextWordsByTopic[allTopicsId] = allWords;
      }

      if (!_isCurrent(revision, userIdAtStart)) return;

      _topicNames
        ..clear()
        ..addAll(nextTopicNames);

      _wordsByTopic
        ..clear()
        ..addAll(nextWordsByTopic);

      if (topicId != null &&
          (topicId == allTopicsId || _topicNames.containsKey(topicId))) {
        selectedTopicId = topicId;
      } else if (source == ReviewWordsSource.allLearned) {
        if (selectedTopicId != allTopicsId &&
            !_topicNames.containsKey(selectedTopicId)) {
          selectedTopicId = allTopicsId;
        }
      } else if (!_topicNames.containsKey(selectedTopicId)) {
        selectedTopicId = _wordsByTopic.keys.isNotEmpty
            ? _wordsByTopic.keys.first
            : (_topicNames.keys.isNotEmpty ? _topicNames.keys.first : '');
      }

      _loadedUserId = userIdAtStart;
      status = ReviewSelectStatus.loaded;
    } catch (error) {
      if (!_isCurrent(revision, userIdAtStart)) return;

      errorMessage = error is AppException
          ? error.message
          : 'Không thể tải danh sách từ cần ôn. Vui lòng thử lại.';

      status = ReviewSelectStatus.error;
    }

    if (_isCurrent(revision, userIdAtStart)) {
      notifyListeners();
    }
  }

  WordMastery _masteryFromGrade(int grade) {
    if (grade >= 5) return WordMastery.daThuoc;
    if (grade >= 3) return WordMastery.moHo;
    return WordMastery.chuaThuoc;
  }

  void selectTopic(String topicId) {
    final containsTopic =
        (source == ReviewWordsSource.allLearned && topicId == allTopicsId) ||
        _topicNames.containsKey(topicId);

    if (!containsTopic || topicId == selectedTopicId) return;

    selectedTopicId = topicId;
    notifyListeners();
  }

  void toggle(String id) {
    final matches = _wordsByTopic[selectedTopicId] ?? const <ReviewWord>[];
    for (final word in matches) {
      if (word.id == id) {
        word.selected = !word.selected;
        notifyListeners();
        return;
      }
    }
  }

  bool _isCurrent(int revision, String? userId) =>
      revision == _scopeRevision && _currentUserId()?.trim() == userId;

  /// Clears account-specific content and selection state before reloading.
  void resetForUserScopeChange() {
    _scopeRevision++;
    status = ReviewSelectStatus.idle;
    source = ReviewWordsSource.due;
    errorMessage = null;
    selectedTopicId = '';
    _loadedUserId = null;
    _topicNames.clear();
    _wordsByTopic.clear();
    notifyListeners();
  }

  void selectAll() {
    for (final word in _wordsByTopic[selectedTopicId] ?? const <ReviewWord>[]) {
      word.selected = true;
    }
    notifyListeners();
  }
}
