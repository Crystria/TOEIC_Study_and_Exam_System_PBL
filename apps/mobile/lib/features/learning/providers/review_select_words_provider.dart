// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';

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
    LearningRepository? repository,
    String? Function()? currentUserId,
  }) : _repository = repository,
       _currentUserId = currentUserId ?? _noUser;

  static String? _noUser() => null;

  final LearningRepository? _repository;
  final String? Function() _currentUserId;
  int _scopeRevision = 0;
  ReviewSelectStatus status = ReviewSelectStatus.idle;
  String? errorMessage;
  String? _loadedUserId;
  String? get loadedUserId => _loadedUserId;
  String selectedTopicId = 'office';
  final Map<String, String> _apiTopicNames = {};
  final Map<String, List<ReviewWord>> _apiWordsByTopic = {};
  final Map<String, List<ReviewWord>> _wordsByTopic = {
    'office': [
      ReviewWord(
        id: 'v1',
        word: 'negotiate',
        meaning: 'thương lượng',
        mastery: WordMastery.moHo,
        phonetic: '/nɪˈɡoʊʃieɪt/',
        example: 'We need to negotiate the contract terms.',
        selected: true,
      ),
      ReviewWord(
        id: 'v2',
        word: 'contract',
        meaning: 'hợp đồng',
        mastery: WordMastery.daThuoc,
        phonetic: '/ˈkɒntrækt/',
        example: 'Please read the contract carefully.',
      ),
      ReviewWord(
        id: 'v3',
        word: 'invoice',
        meaning: 'hóa đơn',
        mastery: WordMastery.chuaThuoc,
        phonetic: '/ˈɪnvɔɪs/',
        example: 'The invoice is due next Monday.',
        selected: true,
      ),
      ReviewWord(
        id: 'v4',
        word: 'deadline',
        meaning: 'hạn chót',
        mastery: WordMastery.daThuoc,
        phonetic: '/ˈdedlaɪn/',
        example: 'We must meet the deadline.',
      ),
      ReviewWord(
        id: 'v5',
        word: 'client',
        meaning: 'khách hàng',
        mastery: WordMastery.daThuoc,
        phonetic: '/ˈklaɪənt/',
        example: 'The client approved our proposal.',
      ),
      ReviewWord(
        id: 'v6',
        word: 'proposal',
        meaning: 'đề xuất',
        mastery: WordMastery.moHo,
        phonetic: '/prəˈpoʊzəl/',
        example: 'She submitted a new proposal.',
        selected: true,
      ),
    ],
    'marketing': [
      ReviewWord(
        id: 'v7',
        word: 'campaign',
        meaning: 'chiến dịch',
        mastery: WordMastery.moHo,
        phonetic: '/kæmˈpeɪn/',
        example: 'The campaign starts next week.',
        selected: true,
      ),
      ReviewWord(
        id: 'v8',
        word: 'advertise',
        meaning: 'quảng cáo',
        mastery: WordMastery.chuaThuoc,
        phonetic: '/ˈædvərtaɪz/',
        example: 'They advertise the product online.',
      ),
      ReviewWord(
        id: 'v9',
        word: 'audience',
        meaning: 'đối tượng khán giả',
        mastery: WordMastery.daThuoc,
        phonetic: '/ˈɔːdiəns/',
        example: 'The audience responded positively.',
      ),
    ],
  };

  static const Map<String, String> topics = {
    'office': 'Office & Business',
    'marketing': 'Marketing',
  };

  Map<String, String> get topicOptions =>
      _repository == null ? topics : Map.unmodifiable(_apiTopicNames);

  List<ReviewWord> get words => List.unmodifiable(
    (_repository == null ? _wordsByTopic : _apiWordsByTopic)[selectedTopicId] ??
        const <ReviewWord>[],
  );
  List<ReviewWord> get selectedWords =>
      words.where((word) => word.selected).toList(growable: false);
  int get selectedCount => selectedWords.length;
  int get totalCount => words.length;

  Future<void> loadDueWords([String? topicId]) async {
    final revision = _scopeRevision;
    final userIdAtStart = _currentUserId()?.trim();
    _loadedUserId = null;
    if (topicId != null) {
      final containsTopic = _repository == null
          ? _wordsByTopic.containsKey(topicId)
          : _apiTopicNames.containsKey(topicId);
      if (containsTopic) selectedTopicId = topicId;
    }
    status = ReviewSelectStatus.loading;
    errorMessage = null;
    notifyListeners();
    try {
      if (_repository != null) {
        final topicsFromServer = await _repository.getTopics();
        if (!_isCurrent(revision, userIdAtStart)) return;
        final dueWords = await _repository.getDueVocabulary(topicId: topicId);
        if (!_isCurrent(revision, userIdAtStart)) return;

        _apiTopicNames
          ..clear()
          ..addEntries(
            topicsFromServer.map((topic) => MapEntry(topic.id, topic.name)),
          );
        _apiWordsByTopic.clear();
        for (final due in dueWords) {
          final item = due.vocabulary;
          final words = _apiWordsByTopic.putIfAbsent(
            item.topicId,
            () => <ReviewWord>[],
          );
          final quality = due.quality ?? 0;
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
              baseEntityRevision: due.revision,
            ),
          );
        }
        if (topicId != null && _apiTopicNames.containsKey(topicId)) {
          selectedTopicId = topicId;
        } else if (!_apiTopicNames.containsKey(selectedTopicId)) {
          selectedTopicId = _apiWordsByTopic.keys.isNotEmpty
              ? _apiWordsByTopic.keys.first
              : (_apiTopicNames.keys.isNotEmpty ? _apiTopicNames.keys.first : '');
        }
      } else {
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (!_isCurrent(revision, userIdAtStart)) return;
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
    final containsTopic = _repository == null
        ? _wordsByTopic.containsKey(topicId)
        : _apiTopicNames.containsKey(topicId);
    if (!containsTopic || topicId == selectedTopicId) return;
    selectedTopicId = topicId;
    notifyListeners();
  }

  void toggle(String id) {
    final source = _repository == null ? _wordsByTopic : _apiWordsByTopic;
    final matches = source[selectedTopicId] ?? const <ReviewWord>[];
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

  /// Clears account-specific selection state while retaining static catalog data.
  void resetForUserScopeChange() {
    _scopeRevision++;
    status = ReviewSelectStatus.idle;
    errorMessage = null;
    selectedTopicId = _repository == null ? 'office' : '';
    _loadedUserId = null;
    _apiTopicNames.clear();
    _apiWordsByTopic.clear();
    const initialSelections = <String, Set<String>>{
      'office': {'v1', 'v3', 'v6'},
      'marketing': {'v7'},
    };
    for (final entry in _wordsByTopic.entries) {
      final selectedIds = initialSelections[entry.key] ?? const <String>{};
      for (final word in entry.value) {
        word.selected = selectedIds.contains(word.id);
      }
    }
    notifyListeners();
  }

  void selectAll() {
    final source = _repository == null ? _wordsByTopic : _apiWordsByTopic;
    for (final word in source[selectedTopicId] ?? const <ReviewWord>[]) {
      word.selected = true;
    }
    notifyListeners();
  }
}
