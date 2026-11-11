// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/storage/vocabulary_progress_storage.dart';
import '../models/learning_models.dart';
import '../repositories/learning_repository.dart';

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

enum VocabularyStatus { idle, loading, loaded, empty, finished, error }

enum VocabularyLearningMode { topic, random }

class VocabularyProvider extends ChangeNotifier {
  VocabularyProvider({
    VocabularyProgressStorage? storage,
    LearningRepository? repository,
    List<FlashcardItem>? catalog,
    String? Function()? currentUserId,
  }) : _storage = storage ?? VocabularyProgressStorage(),
       _repository = repository,
       _catalog = catalog ?? _defaultCatalog,
       _currentUserId = currentUserId ?? _noUser;

  static String? _noUser() => null;

  final VocabularyProgressStorage _storage;
  final LearningRepository? _repository;
  final List<FlashcardItem> _catalog;
  final String? Function() _currentUserId;
  Future<void>? _initialization;
  int _scopeRevision = 0;
  int _loadRequestToken = 0;

  VocabularyStatus status = VocabularyStatus.idle;
  VocabularyLearningMode currentMode = VocabularyLearningMode.topic;
  List<FlashcardItem> queue = [];
  int currentIndex = 0;
  String? currentTopicId;
  String? currentTopicName;
  String? errorMessage;
  String? persistenceError;

  final Map<String, int> gradedResults = <String, int>{};
  Map<String, StoredVocabularyWord> _progressRecords = {};
  final Map<String, LearningReviewProgress> _serverDueProgress = {};

  static const List<FlashcardItem> _defaultCatalog = [
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

  bool get isDemoData => _repository == null;

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
    final revision = _scopeRevision;
    try {
      final snapshot = await _storage.loadSnapshot();
      if (revision != _scopeRevision) return;
      _applySnapshot(snapshot);
      persistenceError = null;
    } catch (error) {
      if (revision != _scopeRevision) return;
      persistenceError = 'Không thể đọc tiến trình từ vựng đã lưu.';
    }
    notifyListeners();
  }

  /// Reloads the active user's saved progress after an explicit local-data import.
  Future<void> refreshPersistedProgress() async {
    final revision = _scopeRevision;
    try {
      final snapshot = await _storage.loadSnapshot();
      if (revision != _scopeRevision) return;
      _applySnapshot(snapshot);
      persistenceError = null;
    } catch (_) {
      if (revision != _scopeRevision) return;
      persistenceError = 'Không thể đọc tiến trình từ vựng đã lưu.';
    }
    notifyListeners();
  }

  /// Clears only in-memory state when a different account is activated.
  /// The previous user's persisted snapshot remains in their own storage key.
  void resetForUserScopeChange() {
    _scopeRevision++;
    _loadRequestToken++;
    _initialization = null;
    status = VocabularyStatus.idle;
    currentMode = VocabularyLearningMode.topic;
    queue = [];
    currentIndex = 0;
    currentTopicId = null;
    currentTopicName = null;
    errorMessage = null;
    persistenceError = null;
    gradedResults.clear();
    _progressRecords = {};
    _serverDueProgress.clear();
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
    final revision = _scopeRevision;
    final requestToken = ++_loadRequestToken;
    await initialize();
    if (!_isCurrentRequest(revision, requestToken)) return;

    currentMode = VocabularyLearningMode.topic;
    currentTopicId = topicId;
    currentTopicName = null;
    status = VocabularyStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      if (_repository != null) {
        // Fetch the canonical topic detail before loading its vocabulary so
        // API mode uses the Backend's current topic name rather than the
        // navigation label cached by the list screen.
        final topic = await _repository.getTopic(topicId);
        if (!_isCurrentRequest(revision, requestToken)) return;
        currentTopicName = topic.name;

        final serverItems = await _repository.getVocabularies(topicId: topicId);
        if (!_isCurrentRequest(revision, requestToken)) return;
        final dueProgress = await _repository.getDueProgress(topicId: topicId);
        if (!_isCurrentRequest(revision, requestToken)) return;
        _serverDueProgress
          ..clear()
          ..addEntries(
            dueProgress.map((item) => MapEntry(item.entityId, item)),
          );

        queue = serverItems
            .map(
              (item) => FlashcardItem(
                id: item.id,
                word: item.word,
                phonetic: item.phonetic,
                definition: item.definition,
                example: item.example,
                audioUrl: item.audioUrl,
                masteryGrade:
                    _progressRecords[item.id]?.grade ??
                    _serverDueProgress[item.id]?.quality ??
                    1,
                topicId: item.topicId,
                topicName: currentTopicName ?? item.topicName,
              ),
            )
            // Preserve the accepted topic-tab rule: show only words marked
            // "đã thuộc". Server grade is available only for its due queue;
            // all other per-word progress is retained in this user's cache.
            .where((item) => _effectiveGrade(item) == 5)
            .where((item) => !_wasStudiedToday(item.id))
            .toList();
      } else {
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (!_isCurrentRequest(revision, requestToken)) return;
        queue = _catalog
            .where((item) => item.topicId == topicId)
            .where((item) => _effectiveGrade(item) == 5)
            .where((item) => !_wasStudiedToday(item.id))
            .toList();
      }
      if (!_isCurrentRequest(revision, requestToken)) return;
      currentIndex = 0;
      status = queue.isEmpty ? VocabularyStatus.empty : VocabularyStatus.loaded;
    } catch (error) {
      if (!_isCurrentRequest(revision, requestToken)) return;
      errorMessage = error is AppException
          ? error.message
          : 'Không thể tải từ vựng của chủ đề. Vui lòng thử lại.';
      status = VocabularyStatus.error;
    }
    if (_isCurrentRequest(revision, requestToken)) notifyListeners();
  }

  Future<void> loadRandom() async {
    final revision = _scopeRevision;
    final requestToken = ++_loadRequestToken;
    await initialize();
    if (!_isCurrentRequest(revision, requestToken)) return;

    currentMode = VocabularyLearningMode.random;
    currentTopicId = null;
    currentTopicName = null;
    status = VocabularyStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      if (_repository != null) {
        final serverItems = await _repository.getVocabularies();
        if (!_isCurrentRequest(revision, requestToken)) return;
        final dueProgress = await _repository.getDueProgress();
        if (!_isCurrentRequest(revision, requestToken)) return;
        _serverDueProgress
          ..clear()
          ..addEntries(
            dueProgress.map((item) => MapEntry(item.entityId, item)),
          );
        queue = serverItems
            .where((item) => !_wasStudiedToday(item.id))
            .map(
              (item) => FlashcardItem(
                id: item.id,
                word: item.word,
                phonetic: item.phonetic,
                definition: item.definition,
                example: item.example,
                audioUrl: item.audioUrl,
                masteryGrade:
                    _progressRecords[item.id]?.grade ??
                    _serverDueProgress[item.id]?.quality ??
                    1,
                topicId: item.topicId,
                topicName: item.topicName,
              ),
            )
            .map((item) => item.withGrade(_effectiveGrade(item)))
            .toList();
        queue.shuffle();
      } else {
        await Future<void>.delayed(const Duration(milliseconds: 250));
        if (!_isCurrentRequest(revision, requestToken)) return;
        queue = _catalog
            .where((item) => !_wasStudiedToday(item.id))
            .map((item) => item.withGrade(_effectiveGrade(item)))
            .toList();
        queue.shuffle();
      }
      if (!_isCurrentRequest(revision, requestToken)) return;
      currentIndex = 0;
      status = queue.isEmpty ? VocabularyStatus.empty : VocabularyStatus.loaded;
    } catch (error) {
      if (!_isCurrentRequest(revision, requestToken)) return;
      errorMessage = error is AppException
          ? error.message
          : 'Không thể tạo danh sách từ ngẫu nhiên. Vui lòng thử lại.';
      status = VocabularyStatus.error;
    }
    if (_isCurrentRequest(revision, requestToken)) notifyListeners();
  }

  bool _isCurrentRequest(int revision, int requestToken) =>
      revision == _scopeRevision && requestToken == _loadRequestToken;

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

    final revision = _scopeRevision;
    final requestToken = _loadRequestToken;
    final userIdAtStart = _currentUserId()?.trim();

    try {
      // The durable journal keeps the same operationId until local persistence
      // succeeds and acknowledgeMutation removes the pending entry.
      LearningMutationReceipt? receipt;
      if (_repository != null) {
        if (userIdAtStart == null || userIdAtStart.isEmpty) {
          throw const AppException.unauthorized(
            message: 'Bạn cần đăng nhập để đồng bộ tiến trình từ vựng.',
          );
        }
        receipt = await _repository.reviewFlashcard(
          vocabularyId: item.id,
          quality: quality,
          baseEntityRevision:
              _progressRecords[item.id]?.serverRevision ??
              _serverDueProgress[item.id]?.revision ??
              '0',
        );
        if (!_isCurrentAccount(revision, userIdAtStart)) return;
      }

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
        serverRevision: receipt?.revision,
      );
      if (!_isCurrentAccount(revision, userIdAtStart)) return;
      _applySnapshot(snapshot);

      if (receipt != null && userIdAtStart != null) {
        await _repository!.acknowledgeMutation(
          userId: userIdAtStart,
          operationId: receipt.operationId,
        );
        if (!_isCurrentAccount(revision, userIdAtStart)) return;
      }

      // A request may finish after the user has started another queue. The
      // successful grade still belongs to this account, but must not advance
      // the newer queue's index.
      if (_loadRequestToken == requestToken && current?.id == item.id) {
        if (currentIndex + 1 < queue.length) {
          currentIndex++;
        } else {
          status = VocabularyStatus.finished;
        }
      }
      persistenceError = null;
      notifyListeners();
    } catch (error) {
      if (!_isCurrentAccount(revision, userIdAtStart)) return;
      persistenceError = error is AppException
          ? error.message
          : 'Không thể lưu kết quả từ vựng. Vui lòng thử lại.';
      notifyListeners();
      rethrow;
    }
  }

  bool _isCurrentAccount(int revision, String? userId) =>
      revision == _scopeRevision && _currentUserId()?.trim() == userId;

  /// Quiz phase can read this persisted list to build today's question set.
  /// The list contains each unique word last studied on the device's local day.
  Future<List<FlashcardItem>> getWordsStudiedTodayForQuiz() async {
    final revision = _scopeRevision;
    await initialize();
    if (revision != _scopeRevision) return const <FlashcardItem>[];
    return todayStudiedWords;
  }

  /// Clears only the active in-memory queue; persisted study history is kept.
  void reset() {
    _loadRequestToken++;
    queue = [];
    currentIndex = 0;
    currentTopicId = null;
    currentTopicName = null;
    currentMode = VocabularyLearningMode.topic;
    status = VocabularyStatus.idle;
    notifyListeners();
  }
}
