// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/storage/vocabulary_progress_storage.dart';
import '../models/learning_models.dart';
import '../repositories/learning_repository.dart';
import 'review_select_words_provider.dart';

enum ReviewFlashcardStatus { idle, loading, loaded, finished }

class ReviewResultTally {
  int daThuoc = 0;
  int moHo = 0;
  int chuaThuoc = 0;

  int get total => daThuoc + moHo + chuaThuoc;

  void reset() {
    daThuoc = 0;
    moHo = 0;
    chuaThuoc = 0;
  }
}

class ReviewFlashcardProvider extends ChangeNotifier {
  ReviewFlashcardProvider({
    LearningRepository? repository,
    VocabularyProgressStorage? storage,
    String? Function()? currentUserId,
    Future<void> Function()? onProgressPersisted,
  }) : _repository = repository,
       _storage = storage ?? VocabularyProgressStorage(),
       _currentUserId = currentUserId ?? _noUser,
       _onProgressPersisted = onProgressPersisted;

  static String? _noUser() => null;

  final LearningRepository? _repository;
  final VocabularyProgressStorage _storage;
  final String? Function() _currentUserId;
  final Future<void> Function()? _onProgressPersisted;

  int _scopeRevision = 0;
  String? _loadedQueueUserId;

  ReviewFlashcardStatus status = ReviewFlashcardStatus.idle;
  List<ReviewWord> queue = [];
  int currentIndex = 0;
  bool isGrading = false;
  String? errorMessage;
  final ReviewResultTally tally = ReviewResultTally();

  ReviewWord? get currentWord =>
      currentIndex >= 0 && currentIndex < queue.length
      ? queue[currentIndex]
      : null;
  int get totalCards => queue.length;
  double get progress => totalCards == 0 ? 0 : (currentIndex + 1) / totalCards;

  Future<bool> loadQueue(
    List<ReviewWord> words, {
    String? expectedUserId,
  }) async {
    final revision = _scopeRevision;
    final userIdAtStart = _currentUserId()?.trim();
    if (expectedUserId != null && expectedUserId != userIdAtStart) {
      return false;
    }
    if (_repository != null &&
        (userIdAtStart == null || userIdAtStart.isEmpty)) {
      return false;
    }

    status = ReviewFlashcardStatus.loading;
    errorMessage = null;
    notifyListeners();
    await Future<void>.delayed(const Duration(milliseconds: 200));
    if (!_isCurrent(revision, userIdAtStart)) return false;
    queue = List<ReviewWord>.of(words);
    currentIndex = 0;
    isGrading = false;
    tally.reset();
    _loadedQueueUserId = userIdAtStart;
    status = queue.isEmpty
        ? ReviewFlashcardStatus.finished
        : ReviewFlashcardStatus.loaded;
    notifyListeners();
    return true;
  }

  Future<void> grade(int quality) async {
    final word = currentWord;
    if (status != ReviewFlashcardStatus.loaded || isGrading || word == null) {
      return;
    }
    if (quality != 1 && quality != 3 && quality != 5) return;

    final revision = _scopeRevision;
    final userIdAtStart = _currentUserId()?.trim();
    if (_loadedQueueUserId != userIdAtStart) return;
    isGrading = true;
    errorMessage = null;
    notifyListeners();

    try {
      LearningMutationReceipt? receipt;
      if (_repository != null) {
        if (userIdAtStart == null || userIdAtStart.isEmpty) {
          throw const AppException.unauthorized(
            message: 'Bạn cần đăng nhập để đồng bộ tiến trình ôn tập.',
          );
        }

        receipt = await _repository.reviewFlashcard(
          vocabularyId: word.id,
          quality: quality,
          baseEntityRevision: word.baseEntityRevision,
        );
        if (!_isCurrent(revision, userIdAtStart)) return;
      }

      await _storage.recordStudiedWord(
        wordId: word.id,
        word: word.word,
        phonetic: word.phonetic,
        definition: word.meaning,
        example: word.example,
        audioUrl: word.audioUrl,
        topicId: word.topicId,
        topicName: word.topicName,
        grade: quality,
        serverRevision: receipt?.revision,
      );
      if (!_isCurrent(revision, userIdAtStart)) return;

      // Keep the journal entry until both Backend and local account cache have
      // committed. If local storage/acknowledgement fails, the next attempt
      // replays the same Backend operationId instead of grading twice.
      if (receipt != null && userIdAtStart != null) {
        await _repository!.acknowledgeMutation(
          userId: userIdAtStart,
          operationId: receipt.operationId,
        );
        if (!_isCurrent(revision, userIdAtStart)) return;
      }

      // Refresh account-scoped vocabulary totals and due counts. A refresh
      // failure must not roll back a review already accepted by the server.
      try {
        await _onProgressPersisted?.call();
      } catch (_) {
        // The persisted word remains authoritative for the local cache.
      }
      if (!_isCurrent(revision, userIdAtStart)) return;
    } catch (error) {
      if (!_isCurrent(revision, userIdAtStart)) return;
      errorMessage = error is AppException
          ? error.message
          : 'Không thể lưu kết quả ôn tập. Vui lòng thử lại.';
      isGrading = false;
      notifyListeners();
      return;
    }

    if (!_isCurrent(revision, userIdAtStart)) return;

    if (quality <= 2) {
      tally.chuaThuoc++;
    } else if (quality <= 3) {
      tally.moHo++;
    } else {
      tally.daThuoc++;
    }

    if (currentIndex + 1 < queue.length) {
      currentIndex++;
      isGrading = false;
    } else {
      status = ReviewFlashcardStatus.finished;
      isGrading = false;
    }
    notifyListeners();
  }

  bool _isCurrent(int revision, String? userId) =>
      revision == _scopeRevision && _currentUserId()?.trim() == userId;

  void reset() {
    _scopeRevision++;
    status = ReviewFlashcardStatus.idle;
    queue = [];
    currentIndex = 0;
    isGrading = false;
    tally.reset();
    errorMessage = null;
    _loadedQueueUserId = null;
    notifyListeners();
  }
}
