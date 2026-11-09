import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Per-user local persistence for vocabulary progress and review preferences.
///
/// The old global key is quarantined, not assigned to the first account that
/// signs in. A caller may import it only after explicitly confirming ownership.
class VocabularyProgressStorage {
  static const String legacyStorageKey = 'toeic.vocabulary.progress.v1';
  static const String unassignedLegacyStorageKey =
      'toeic.vocabulary.progress.legacy.unassigned.v1';
  static const String _userStorageKeyPrefix =
      'toeic.vocabulary.progress.v2.user.';

  Future<void> _writeQueue = Future<void>.value();
  Future<void>? _legacyMigration;
  String? _activeUserId;
  int _scopeRevision = 0;

  String? get activeUserId => _activeUserId;
  bool get hasActiveUser => _activeUserId != null;

  /// Changes the storage scope without moving or deleting another user's data.
  void bindUser(String userId) {
    final normalized = userId.trim();
    if (normalized.isEmpty) {
      throw ArgumentError.value(userId, 'userId', 'User ID must not be empty.');
    }
    if (_activeUserId == normalized) return;

    _activeUserId = normalized;
    _scopeRevision++;
  }

  /// Removes the active in-memory scope. Persisted per-user data is retained.
  void unbindUser() {
    if (_activeUserId == null) return;
    _activeUserId = null;
    _scopeRevision++;
  }

  /// Moves the legacy global record to an unassigned quarantine key exactly
  /// once. This method does not associate legacy data with any account.
  Future<void> prepare() async {
    final pending = _legacyMigration;
    if (pending != null) return pending;

    final migration = _quarantineLegacyRecord();
    _legacyMigration = migration;
    try {
      await migration;
    } catch (_) {
      // Allow a later operation to retry if preferences were temporarily
      // unavailable; never cache a permanently failed migration Future.
      if (identical(_legacyMigration, migration)) {
        _legacyMigration = null;
      }
      rethrow;
    }
  }

  Future<void> _quarantineLegacyRecord() async {
    final preferences = await SharedPreferences.getInstance();
    final legacy = preferences.getString(legacyStorageKey);
    if (legacy == null) return;

    final alreadyQuarantined =
        preferences.getString(unassignedLegacyStorageKey);
    if (alreadyQuarantined == null) {
      final saved = await preferences.setString(
        unassignedLegacyStorageKey,
        legacy,
      );
      if (!saved) {
        throw StateError('Không thể bảo toàn dữ liệu từ vựng cũ.');
      }
    } else if (alreadyQuarantined != legacy) {
      // Two different legacy snapshots must not be merged or silently discard
      // one another. Keep the original key until a user can resolve the
      // conflict with an explicit recovery policy.
      throw StateError(
        'Phát hiện hai bản dữ liệu học cũ khác nhau. '
        'Dữ liệu gốc được giữ nguyên để tránh mất tiến trình.',
      );
    }

    // Remove the old global key only after an identical quarantine copy is
    // confirmed. The copy is never assigned to an account automatically.
    await preferences.remove(legacyStorageKey);
  }

  Future<bool> hasUnassignedLegacyData() async {
    await prepare();
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(unassignedLegacyStorageKey);
    return raw != null && raw.isNotEmpty;
  }

  /// Imports quarantined progress only after explicit ownership confirmation.
  /// It refuses to overwrite progress already stored for the active user.
  Future<void> importUnassignedLegacyData({
    required bool confirmOwnership,
  }) async {
    if (!confirmOwnership) {
      throw StateError('Cần xác nhận quyền sở hữu dữ liệu cũ trước khi nhập.');
    }

    final scope = _captureScope();
    await prepare();
    final completer = Completer<void>();

    // Serialize the import with normal progress writes so a concurrent study
    // action cannot be overwritten by the quarantined snapshot.
    _writeQueue = _writeQueue.then((_) async {
      try {
        _ensureScopeUnchanged(scope);
        final preferences = await SharedPreferences.getInstance();
        final raw = preferences.getString(unassignedLegacyStorageKey);
        if (raw == null || raw.isEmpty) {
          throw StateError('Không có dữ liệu từ vựng cũ đang chờ nhập.');
        }

        final legacy = _decodeSnapshot(raw);
        final current = await _readSnapshotFor(scope.storageKey);
        if (current.words.isNotEmpty ||
            current.dailyGoal != VocabularyProgressSnapshot.defaultDailyGoal ||
            !current.remindEnabled) {
          throw StateError(
            'Tài khoản hiện tại đã có dữ liệu. Không thể ghi đè bằng dữ liệu cũ.',
          );
        }

        _ensureScopeUnchanged(scope);
        await _writeSnapshotFor(scope.storageKey, legacy);
        _ensureScopeUnchanged(scope);

        // Do not delete a quarantine value that changed while this import was
        // running (for example, after a recovery operation on another screen).
        if (preferences.getString(unassignedLegacyStorageKey) != raw) {
          throw StateError(
            'Dữ liệu cũ đã thay đổi trong lúc nhập. '
            'Bản nhập đã được giữ lại, vui lòng kiểm tra lại.',
          );
        }
        await preferences.remove(unassignedLegacyStorageKey);
        completer.complete();
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });

    await completer.future;
  }

  Future<VocabularyProgressSnapshot> loadSnapshot() async {
    final scope = _captureScopeOrNull();
    if (scope == null) return VocabularyProgressSnapshot.empty();

    await prepare();
    await _writeQueue;
    _ensureScopeUnchanged(scope);
    final snapshot = await _readSnapshotFor(scope.storageKey);
    _ensureScopeUnchanged(scope);
    return snapshot;
  }

  Future<VocabularyProgressSnapshot> recordStudiedWord({
    required String wordId,
    required String word,
    required String phonetic,
    required String definition,
    required String example,
    required String audioUrl,
    required String topicId,
    required String topicName,
    required int grade,
    String? serverRevision,
  }) {
    return _serialize((snapshot) {
      final now = DateTime.now();
      final previous = snapshot.words[wordId];

      snapshot.words[wordId] = StoredVocabularyWord(
        id: wordId,
        word: word,
        phonetic: phonetic,
        definition: definition,
        example: example,
        audioUrl: audioUrl,
        topicId: topicId,
        topicName: topicName,
        grade: grade,
        serverRevision: serverRevision ?? previous?.serverRevision,
        firstStudiedAt: previous?.firstStudiedAt ?? now,
        lastStudiedAt: now,
      );
      return snapshot;
    });
  }

  Future<VocabularyProgressSnapshot> saveDailyGoal(int goal) {
    return _serialize((snapshot) {
      snapshot.dailyGoal = goal;
      return snapshot;
    });
  }

  Future<VocabularyProgressSnapshot> saveReminderEnabled(bool enabled) {
    return _serialize((snapshot) {
      snapshot.remindEnabled = enabled;
      return snapshot;
    });
  }

  Future<VocabularyProgressSnapshot> saveReviewSettings({
    required int dailyGoal,
    required bool remindEnabled,
  }) {
    return _serialize((snapshot) {
      snapshot.dailyGoal = dailyGoal;
      snapshot.remindEnabled = remindEnabled;
      return snapshot;
    });
  }

  Future<VocabularyProgressSnapshot> _serialize(
    VocabularyProgressSnapshot Function(VocabularyProgressSnapshot snapshot)
    operation,
  ) {
    final scope = _captureScope();
    final completer = Completer<VocabularyProgressSnapshot>();

    _writeQueue = _writeQueue.then((_) async {
      try {
        final snapshot = await _readSnapshotFor(scope.storageKey);
        final result = operation(snapshot);
        _ensureScopeUnchanged(scope);
        await _writeSnapshotFor(scope.storageKey, result);
        completer.complete(result);
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });

    return completer.future;
  }

  Future<VocabularyProgressSnapshot> _readSnapshotFor(String key) async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(key);
    if (raw == null || raw.isEmpty) {
      return VocabularyProgressSnapshot.empty();
    }
    return _decodeSnapshot(raw);
  }

  VocabularyProgressSnapshot _decodeSnapshot(String raw) {
    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      throw const FormatException('Dữ liệu tiến trình từ vựng không hợp lệ.');
    }
    return VocabularyProgressSnapshot.fromJson(
      Map<String, dynamic>.from(decoded),
    );
  }

  Future<void> _writeSnapshotFor(
    String key,
    VocabularyProgressSnapshot snapshot,
  ) async {
    final preferences = await SharedPreferences.getInstance();
    final saved = await preferences.setString(key, jsonEncode(snapshot.toJson()));
    if (!saved) {
      throw StateError('Không thể lưu tiến trình từ vựng vào thiết bị.');
    }
  }

  _VocabularyStorageScope _captureScope() {
    final scope = _captureScopeOrNull();
    if (scope == null) {
      throw StateError('Không có tài khoản đang hoạt động để lưu dữ liệu.');
    }
    return scope;
  }

  _VocabularyStorageScope? _captureScopeOrNull() {
    final userId = _activeUserId;
    if (userId == null) return null;
    final encodedUserId = Uri.encodeComponent(userId);
    return _VocabularyStorageScope(
      userId: userId,
      revision: _scopeRevision,
      storageKey: '$_userStorageKeyPrefix$encodedUserId',
    );
  }

  void _ensureScopeUnchanged(_VocabularyStorageScope scope) {
    if (_scopeRevision != scope.revision || _activeUserId != scope.userId) {
      throw StateError('Tài khoản đã thay đổi trong lúc xử lý dữ liệu cục bộ.');
    }
  }
}

class _VocabularyStorageScope {
  const _VocabularyStorageScope({
    required this.userId,
    required this.revision,
    required this.storageKey,
  });

  final String userId;
  final int revision;
  final String storageKey;
}

class StoredVocabularyWord {
  const StoredVocabularyWord({
    required this.id,
    required this.word,
    required this.phonetic,
    required this.definition,
    required this.example,
    required this.audioUrl,
    required this.topicId,
    required this.topicName,
    required this.grade,
    this.serverRevision,
    required this.firstStudiedAt,
    required this.lastStudiedAt,
  });

  final String id;
  final String word;
  final String phonetic;
  final String definition;
  final String example;
  final String audioUrl;
  final String topicId;
  final String topicName;
  final int grade;
  final String? serverRevision;
  final DateTime firstStudiedAt;
  final DateTime lastStudiedAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'word': word,
    'phonetic': phonetic,
    'definition': definition,
    'example': example,
    'audioUrl': audioUrl,
    'topicId': topicId,
    'topicName': topicName,
    'grade': grade,
    'serverRevision': serverRevision,
    'firstStudiedAt': firstStudiedAt.toIso8601String(),
    'lastStudiedAt': lastStudiedAt.toIso8601String(),
  };

  factory StoredVocabularyWord.fromJson(Map<String, dynamic> json) {
    return StoredVocabularyWord(
      id: json['id'] as String,
      word: json['word'] as String,
      phonetic: json['phonetic'] as String? ?? '',
      definition: json['definition'] as String? ?? '',
      example: json['example'] as String? ?? '',
      audioUrl: json['audioUrl'] as String? ?? '',
      topicId: json['topicId'] as String? ?? '',
      topicName: json['topicName'] as String? ?? '',
      grade: (json['grade'] as num?)?.toInt() ?? 1,
      serverRevision: json['serverRevision'] as String?,
      firstStudiedAt: DateTime.parse(json['firstStudiedAt'] as String),
      lastStudiedAt: DateTime.parse(json['lastStudiedAt'] as String),
    );
  }
}

class VocabularyProgressSnapshot {
  VocabularyProgressSnapshot({
    required this.dailyGoal,
    required this.words,
    this.remindEnabled = true,
  });

  static const int defaultDailyGoal = 20;

  int dailyGoal;
  bool remindEnabled;
  final Map<String, StoredVocabularyWord> words;

  int get totalLearnedWords => words.length;

  List<StoredVocabularyWord> get todayWords {
    final today = dateKey(DateTime.now());
    final result = words.values
        .where((item) => dateKey(item.lastStudiedAt) == today)
        .toList();
    result.sort((a, b) => a.lastStudiedAt.compareTo(b.lastStudiedAt));
    return result;
  }

  static String dateKey(DateTime date) {
    final local = date.toLocal();
    final year = local.year.toString().padLeft(4, '0');
    final month = local.month.toString().padLeft(2, '0');
    final day = local.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  factory VocabularyProgressSnapshot.empty() {
    return VocabularyProgressSnapshot(
      dailyGoal: defaultDailyGoal,
      remindEnabled: true,
      words: {},
    );
  }

  factory VocabularyProgressSnapshot.fromJson(Map<String, dynamic> json) {
    final rawWords = json['words'];
    final words = <String, StoredVocabularyWord>{};
    if (rawWords is Map) {
      for (final entry in rawWords.entries) {
        if (entry.value is Map) {
          final stored = StoredVocabularyWord.fromJson(
            Map<String, dynamic>.from(entry.value as Map),
          );
          words[entry.key.toString()] = stored;
        }
      }
    }

    final rawReminder = json['remindEnabled'];
    return VocabularyProgressSnapshot(
      dailyGoal: (json['dailyGoal'] as num?)?.toInt() ?? defaultDailyGoal,
      remindEnabled: rawReminder is bool ? rawReminder : true,
      words: words,
    );
  }

  Map<String, dynamic> toJson() => {
    'dailyGoal': dailyGoal,
    'remindEnabled': remindEnabled,
    'words': words.map((key, value) => MapEntry(key, value.toJson())),
  };
}
