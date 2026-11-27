import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/vocabulary_session_dtos.dart';
import '../requests/learning_session_requests.dart';
import 'learning_sync_journal.dart';

class LearningSessionCreateIntent {
  const LearningSessionCreateIntent({
    required this.idempotencyKey,
    required this.topicId,
    required this.mode,
  });

  final String idempotencyKey;
  final String topicId;
  final VocabularySessionMode mode;

  Map<String, dynamic> toJson() => {
    'idempotencyKey': idempotencyKey,
    'topicId': topicId,
    'mode': mode.apiValue,
  };

  factory LearningSessionCreateIntent.fromJson(Map<String, dynamic> json) {
    return LearningSessionCreateIntent(
      idempotencyKey: _requiredString(json, 'idempotencyKey'),
      topicId: _requiredString(json, 'topicId'),
      mode: VocabularySessionMode.fromApiValue(_requiredString(json, 'mode')),
    );
  }
}

class LearningSessionPointer {
  const LearningSessionPointer({
    required this.sessionId,
    required this.topicId,
    required this.mode,
  });

  final String sessionId;
  final String topicId;
  final VocabularySessionMode mode;

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'topicId': topicId,
    'mode': mode.apiValue,
  };

  factory LearningSessionPointer.fromJson(Map<String, dynamic> json) {
    return LearningSessionPointer(
      sessionId: _requiredString(json, 'sessionId'),
      topicId: _requiredString(json, 'topicId'),
      mode: VocabularySessionMode.fromApiValue(_requiredString(json, 'mode')),
    );
  }
}

class LearningPendingSessionSubmit {
  LearningPendingSessionSubmit({
    required this.sessionId,
    required this.operationId,
    required List<VocabularySessionReviewRequestDto> reviews,
    required List<VocabularySessionAnswerRequestDto> answers,
  }) : reviews = List.unmodifiable(reviews),
       answers = List.unmodifiable(answers);

  final String sessionId;
  final String operationId;
  final List<VocabularySessionReviewRequestDto> reviews;
  final List<VocabularySessionAnswerRequestDto> answers;

  SubmitVocabularySessionRequestDto toRequest() {
    return SubmitVocabularySessionRequestDto(
      operationId: operationId,
      reviews: reviews,
      answers: answers,
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'operationId': operationId,
    'reviews': reviews.map((item) => item.toJson()).toList(growable: false),
    'answers': answers.map((item) => item.toJson()).toList(growable: false),
  };

  factory LearningPendingSessionSubmit.fromJson(Map<String, dynamic> json) {
    final rawReviews = json['reviews'];
    final rawAnswers = json['answers'];
    if (rawReviews is! List || rawAnswers is! List) {
      throw const FormatException(
        'Pending Session submit must contain reviews and answers.',
      );
    }

    final reviews = rawReviews
        .map((item) {
          final map = _requiredMap(item, 'review');
          return VocabularySessionReviewRequestDto(
            vocabularyId: _requiredString(map, 'vocabularyId'),
            quality: _requiredInt(map, 'quality'),
          );
        })
        .toList(growable: false);

    final answers = rawAnswers
        .map((item) {
          final map = _requiredMap(item, 'answer');
          return VocabularySessionAnswerRequestDto(
            questionId: _requiredString(map, 'questionId'),
            selectedOption: _requiredString(map, 'selectedOption'),
          );
        })
        .toList(growable: false);

    final pending = LearningPendingSessionSubmit(
      sessionId: _requiredString(json, 'sessionId'),
      operationId: _requiredString(json, 'operationId'),
      reviews: reviews,
      answers: answers,
    );
    // Re-run B.2 request validation when restoring persisted JSON.
    pending.toRequest();
    return pending;
  }
}

class LearningSessionJournalState {
  const LearningSessionJournalState({
    this.pendingCreate,
    this.activeSession,
    this.pendingSubmit,
  });

  final LearningSessionCreateIntent? pendingCreate;
  final LearningSessionPointer? activeSession;
  final LearningPendingSessionSubmit? pendingSubmit;

  Map<String, dynamic> toJson() => {
    if (pendingCreate != null) 'pendingCreate': pendingCreate!.toJson(),
    if (activeSession != null) 'activeSession': activeSession!.toJson(),
    if (pendingSubmit != null) 'pendingSubmit': pendingSubmit!.toJson(),
  };

  factory LearningSessionJournalState.fromJson(Map<String, dynamic> json) {
    final pendingCreate = json['pendingCreate'] == null
        ? null
        : LearningSessionCreateIntent.fromJson(
            _requiredMap(json['pendingCreate'], 'pendingCreate'),
          );
    final activeSession = json['activeSession'] == null
        ? null
        : LearningSessionPointer.fromJson(
            _requiredMap(json['activeSession'], 'activeSession'),
          );
    final pendingSubmit = json['pendingSubmit'] == null
        ? null
        : LearningPendingSessionSubmit.fromJson(
            _requiredMap(json['pendingSubmit'], 'pendingSubmit'),
          );

    if (pendingCreate != null && activeSession != null) {
      throw const FormatException(
        'Session Journal cannot contain both pending create and active session.',
      );
    }
    if (pendingSubmit != null &&
        (activeSession == null ||
            pendingSubmit.sessionId != activeSession.sessionId)) {
      throw const FormatException(
        'Pending submit does not match the active Session.',
      );
    }

    return LearningSessionJournalState(
      pendingCreate: pendingCreate,
      activeSession: activeSession,
      pendingSubmit: pendingSubmit,
    );
  }
}

/// User-scoped journal for the Backend Vocabulary Session transaction.
///
/// The journal stores identifiers and the exact pending submit payload; it
/// does not cache session content or answer keys. A retry therefore reuses the
/// same Idempotency-Key / operationId after process death or network failure.
class LearningSessionJournal {
  static const String _keyPrefix = 'toeic.learning.session_journal.v1.user.';

  Future<void> _queue = Future<void>.value();

  Future<LearningSessionJournalState> read(String userId) {
    _validateUserId(userId);
    return _serialize(() => _read(userId));
  }

  Future<LearningSessionCreateIntent> getOrCreatePendingCreate({
    required String userId,
    required String topicId,
    required VocabularySessionMode mode,
  }) {
    _validateUserId(userId);
    if (topicId.trim().isEmpty) {
      throw ArgumentError.value(topicId, 'topicId');
    }

    return _serialize(() async {
      final state = await _read(userId);
      if (state.activeSession != null) {
        throw StateError(
          'Tài khoản đang có một Vocabulary Session chưa được xử lý.',
        );
      }

      final existing = state.pendingCreate;
      if (existing != null) {
        if (existing.topicId == topicId && existing.mode == mode) {
          return existing;
        }
        throw StateError(
          'Đang có yêu cầu tạo Session chưa hoàn tất. '
          'Phải khôi phục yêu cầu cũ trước khi tạo Session khác.',
        );
      }

      final intent = LearningSessionCreateIntent(
        idempotencyKey: LearningSyncJournal.createOperationId(),
        topicId: topicId,
        mode: mode,
      );
      await _write(userId, LearningSessionJournalState(pendingCreate: intent));
      return intent;
    });
  }

  Future<void> attachCreatedSession({
    required String userId,
    required String idempotencyKey,
    required VocabularySessionDto session,
  }) {
    _validateUserId(userId);
    return _serialize(() async {
      final state = await _read(userId);
      final pending = state.pendingCreate;

      // Idempotent acknowledgement if a previous local write already attached
      // this exact Session before the caller observed completion.
      if (pending == null &&
          state.activeSession?.sessionId == session.sessionId) {
        return;
      }

      if (pending == null ||
          pending.idempotencyKey != idempotencyKey ||
          pending.topicId != session.topicId ||
          pending.mode != session.mode) {
        throw StateError('Created Session không khớp với yêu cầu đang chờ.');
      }

      await _write(
        userId,
        LearningSessionJournalState(
          activeSession: LearningSessionPointer(
            sessionId: session.sessionId,
            topicId: session.topicId,
            mode: session.mode,
          ),
        ),
      );
    });
  }

  Future<LearningPendingSessionSubmit> getOrCreatePendingSubmit({
    required String userId,
    required String sessionId,
    required List<VocabularySessionReviewRequestDto> reviews,
    required List<VocabularySessionAnswerRequestDto> answers,
  }) {
    _validateUserId(userId);
    final proposed = SubmitVocabularySessionRequestDto(
      operationId: LearningSyncJournal.createOperationId(),
      reviews: reviews,
      answers: answers,
    );

    return _serialize(() async {
      final state = await _read(userId);
      if (state.activeSession?.sessionId != sessionId) {
        throw StateError(
          'Session submit không thuộc active Session của tài khoản.',
        );
      }

      final existing = state.pendingSubmit;
      if (existing != null) {
        final sameReviews =
            jsonEncode(
              existing.reviews.map((item) => item.toJson()).toList(),
            ) ==
            jsonEncode(reviews.map((item) => item.toJson()).toList());
        final sameAnswers =
            jsonEncode(
              existing.answers.map((item) => item.toJson()).toList(),
            ) ==
            jsonEncode(answers.map((item) => item.toJson()).toList());

        if (existing.sessionId == sessionId && sameReviews && sameAnswers) {
          return existing;
        }
        throw StateError(
          'Đang có yêu cầu submit chưa hoàn tất. '
          'Không được thay đổi Operation ID hoặc payload khi retry.',
        );
      }

      final created = LearningPendingSessionSubmit(
        sessionId: sessionId,
        operationId: proposed.operationId,
        reviews: reviews,
        answers: answers,
      );
      await _write(
        userId,
        LearningSessionJournalState(
          activeSession: state.activeSession,
          pendingSubmit: created,
        ),
      );
      return created;
    });
  }

  Future<void> clearPendingSubmit({
    required String userId,
    required String operationId,
  }) {
    _validateUserId(userId);
    return _serialize(() async {
      final state = await _read(userId);
      final pending = state.pendingSubmit;
      if (pending == null) return;
      if (pending.operationId != operationId) {
        throw StateError('Operation ID không khớp với pending Session submit.');
      }
      await _write(
        userId,
        LearningSessionJournalState(activeSession: state.activeSession),
      );
    });
  }

  Future<void> clearSession({
    required String userId,
    required String sessionId,
  }) {
    _validateUserId(userId);
    return _serialize(() async {
      final state = await _read(userId);
      final active = state.activeSession;
      if (active == null) return;
      if (active.sessionId != sessionId) {
        throw StateError('Không thể xóa Session pointer của một Session khác.');
      }
      await _write(userId, const LearningSessionJournalState());
    });
  }

  Future<LearningSessionJournalState> _read(String userId) async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_storageKey(userId));
    if (raw == null || raw.isEmpty) {
      return const LearningSessionJournalState();
    }
    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      throw const FormatException(
        'Learning Session Journal phải là một JSON object.',
      );
    }
    return LearningSessionJournalState.fromJson(
      Map<String, dynamic>.from(decoded),
    );
  }

  Future<void> _write(String userId, LearningSessionJournalState state) async {
    final preferences = await SharedPreferences.getInstance();
    final key = _storageKey(userId);
    final json = state.toJson();
    if (json.isEmpty) {
      if (preferences.containsKey(key) && !await preferences.remove(key)) {
        throw StateError('Không thể xóa Learning Session Journal.');
      }
      return;
    }
    if (!await preferences.setString(key, jsonEncode(json))) {
      throw StateError('Không thể lưu Learning Session Journal.');
    }
  }

  String _storageKey(String userId) =>
      '$_keyPrefix${Uri.encodeComponent(userId.trim())}';

  void _validateUserId(String userId) {
    if (userId.trim().isEmpty) {
      throw ArgumentError.value(userId, 'userId', 'User ID must not be empty.');
    }
  }

  Future<T> _serialize<T>(Future<T> Function() operation) {
    final completer = Completer<T>();
    _queue = _queue.then((_) async {
      try {
        completer.complete(await operation());
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('Session Journal field "$key" is invalid.');
  }
  return value.trim();
}

int _requiredInt(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! int) {
    throw FormatException('Session Journal field "$key" is invalid.');
  }
  return value;
}

Map<String, dynamic> _requiredMap(Object? value, String field) {
  if (value is! Map) {
    throw FormatException('Session Journal "$field" must be an object.');
  }
  return Map<String, dynamic>.from(value);
}
