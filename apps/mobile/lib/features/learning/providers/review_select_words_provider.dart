// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';

import '../repositories/learning_local_state_repository.dart';
import '../repositories/learning_repository.dart';

enum WordMastery { chuaThuoc, moHo, daThuoc }

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

  Map<String, String> get topicOptions => Map.unmodifiable(_topicNames);

  List<ReviewWord> get words =>
      List.unmodifiable(_wordsByTopic[selectedTopicId] ?? const <ReviewWord>[]);
  List<ReviewWord> get selectedWords =>
      words.where((word) => word.selected).toList(growable: false);
  int get selectedCount => selectedWords.length;
  int get totalCount => words.length;

  Future<void> loadDueWords([String? topicId]) async {
    final revision = _scopeRevision;
    final userIdAtStart = _currentUserId()?.trim();
    _loadedUserId = null;
    if (topicId != null) {
      if (_topicNames.containsKey(topicId)) selectedTopicId = topicId;
    }
    status = ReviewSelectStatus.loading;
    errorMessage = null;
    notifyListeners();
    try {
      final topicsFromRepository = await _repository.getTopics();
      if (!_isCurrent(revision, userIdAtStart)) return;
      final dueWords = await _repository.getDueVocabulary(topicId: topicId);
      if (!_isCurrent(revision, userIdAtStart)) return;
      final localProgress = await _localStateRepository.getVocabularyProgress();
      if (!_isCurrent(revision, userIdAtStart)) return;

      _topicNames
        ..clear()
        ..addEntries(
          topicsFromRepository.map((topic) => MapEntry(topic.id, topic.name)),
        );
      _wordsByTopic.clear();
      for (final due in dueWords) {
        final item = due.vocabulary;
        final words = _wordsByTopic.putIfAbsent(
          item.topicId,
          () => <ReviewWord>[],
        );
        final saved = localProgress.words[item.id];
        // Local grade/revision is the device cache for history not fully
        // exposed by the current Learning Backend read contract.
        final quality = saved?.grade ?? due.quality ?? 0;
        final revision = saved?.serverRevision ?? due.revision;
        words.add(
          ReviewWord(
            id: item.id,
            word: item.word,
            meaning: item.definition,
            mastery: quality >= 5
                ? WordMastery.daThuoc
                : quality >= 3
                ? WordMastery.moHo
                : WordMastery.chuaThuoc,
            phonetic: item.phonetic,
            example: item.example,
            audioUrl: item.audioUrl,
            selected: false,
            topicId: item.topicId,
            topicName: item.topicName,
            baseEntityRevision: revision,
          ),
        );
      }
      if (topicId != null && _topicNames.containsKey(topicId)) {
        selectedTopicId = topicId;
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
    if (_isCurrent(revision, userIdAtStart)) notifyListeners();
  }

  void selectTopic(String topicId) {
    final containsTopic = _topicNames.containsKey(topicId);
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
