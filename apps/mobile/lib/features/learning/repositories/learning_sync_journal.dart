import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

enum LearningOperationKind { reviewFlashcard, completeLesson }

class LearningPendingOperation {
  const LearningPendingOperation({
    required this.operationId,
    required this.kind,
    required this.entityId,
    required this.baseEntityRevision,
    required this.createdAt,
    this.quality,
  });

  final String operationId;
  final LearningOperationKind kind;
  final String entityId;
  final String baseEntityRevision;
  final DateTime createdAt;
  final int? quality;

  LearningPendingOperation withConflictRevision(String revision) {
    return LearningPendingOperation(
      operationId: LearningSyncJournal.createOperationId(),
      kind: kind,
      entityId: entityId,
      baseEntityRevision: revision,
      createdAt: DateTime.now().toUtc(),
      quality: quality,
    );
  }

  Map<String, dynamic> toJson() => {
    'operationId': operationId,
    'kind': kind.name,
    'entityId': entityId,
    'baseEntityRevision': baseEntityRevision,
    'createdAt': createdAt.toUtc().toIso8601String(),
    'quality': quality,
  };

  factory LearningPendingOperation.fromJson(Map<String, dynamic> json) {
    final kindValue = json['kind'];
    final kind = LearningOperationKind.values.firstWhere(
      (value) => value.name == kindValue,
      orElse: () => throw const FormatException(
        'Learning journal operation kind is invalid.',
      ),
    );
    final createdAt = DateTime.tryParse(json['createdAt'] as String? ?? '');
    if (createdAt == null) {
      throw const FormatException('Learning journal timestamp is invalid.');
    }
    final operationId = _required(json, 'operationId');
    final entityId = _required(json, 'entityId');
    final baseEntityRevision = _required(json, 'baseEntityRevision');
    final parsedRevision = BigInt.tryParse(baseEntityRevision);
    if (parsedRevision == null || parsedRevision.isNegative) {
      throw const FormatException('Learning journal base revision is invalid.');
    }

    final rawQuality = json['quality'];
    int? quality;
    if (rawQuality != null) {
      if (rawQuality is int) {
        quality = rawQuality;
      } else if (rawQuality is double &&
          rawQuality.isFinite &&
          rawQuality == rawQuality.roundToDouble()) {
        quality = rawQuality.toInt();
      } else {
        throw const FormatException(
          'Learning journal quality must be an integer.',
        );
      }
    }
    if (kind == LearningOperationKind.reviewFlashcard &&
        (quality == null || quality < 0 || quality > 5)) {
      throw const FormatException(
        'Learning journal review quality is invalid.',
      );
    }
    if (kind == LearningOperationKind.completeLesson && quality != null) {
      throw const FormatException(
        'Learning journal lesson completion must not contain quality.',
      );
    }

    return LearningPendingOperation(
      operationId: operationId,
      kind: kind,
      entityId: entityId,
      baseEntityRevision: baseEntityRevision,
      createdAt: createdAt.toUtc(),
      quality: quality,
    );
  }

  static String _required(Map<String, dynamic> json, String key) {
    final value = json[key];
    if (value is! String || value.trim().isEmpty) {
      throw FormatException('Learning journal field $key is invalid.');
    }
    return value.trim();
  }
}

/// Durable idempotency journal for learning writes.
///
/// The key is scoped by Backend user ID. Network/timeout failures retain the
/// exact operationId and payload so a retry can safely replay the same write.
/// A 409 revision conflict receives a fresh operationId and the authoritative
/// revision from currentProgress; the next explicit user retry uses that entry.
class LearningSyncJournal {
  static const String _keyPrefix = 'toeic.learning.sync_journal.v1.user.';

  Future<void> _queue = Future<void>.value();

  Future<LearningPendingOperation> getOrCreate({
    required String userId,
    required LearningOperationKind kind,
    required String entityId,
    required String baseEntityRevision,
    int? quality,
  }) {
    _validateOperationInput(
      userId: userId,
      kind: kind,
      entityId: entityId,
      baseEntityRevision: baseEntityRevision,
      quality: quality,
    );
    return _serialize(() async {
      final operations = await _read(userId);
      final existingIndex = operations.indexWhere(
        (operation) => operation.kind == kind && operation.entityId == entityId,
      );

      if (existingIndex >= 0) {
        final existing = operations[existingIndex];
        if (existing.quality != quality) {
          throw StateError(
            'Có một thao tác học chưa đồng bộ cho mục này. '
            'Hãy thử lại thao tác trước khi thay đổi đánh giá.',
          );
        }
        return existing;
      }

      final created = LearningPendingOperation(
        operationId: createOperationId(),
        kind: kind,
        entityId: entityId,
        baseEntityRevision: baseEntityRevision,
        createdAt: DateTime.now().toUtc(),
        quality: quality,
      );
      operations.add(created);
      await _write(userId, operations);
      return created;
    });
  }

  Future<void> remove({required String userId, required String operationId}) {
    _validateUserId(userId);
    if (operationId.trim().isEmpty) {
      throw ArgumentError.value(operationId, 'operationId');
    }
    return _serialize(() async {
      final operations = await _read(userId);
      operations.removeWhere(
        (operation) => operation.operationId == operationId,
      );
      await _write(userId, operations);
    });
  }

  Future<LearningPendingOperation> replaceAfterConflict({
    required String userId,
    required String operationId,
    required String currentRevision,
  }) {
    _validateUserId(userId);
    final parsedRevision = BigInt.tryParse(currentRevision);
    if (parsedRevision == null || parsedRevision.isNegative) {
      throw ArgumentError.value(currentRevision, 'currentRevision');
    }
    if (operationId.trim().isEmpty) {
      throw ArgumentError.value(operationId, 'operationId');
    }
    return _serialize(() async {
      final operations = await _read(userId);
      final index = operations.indexWhere(
        (operation) => operation.operationId == operationId,
      );
      if (index < 0) {
        throw StateError('Không tìm thấy thao tác học đang chờ đồng bộ.');
      }

      final replacement = operations[index].withConflictRevision(
        currentRevision,
      );
      operations[index] = replacement;
      await _write(userId, operations);
      return replacement;
    });
  }

  Future<List<LearningPendingOperation>> pendingForUser(String userId) {
    _validateUserId(userId);
    return _serialize(() async => List.unmodifiable(await _read(userId)));
  }

  Future<List<LearningPendingOperation>> _read(String userId) async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_storageKey(userId));
    if (raw == null || raw.isEmpty) return <LearningPendingOperation>[];

    final decoded = jsonDecode(raw);
    if (decoded is! List) {
      throw const FormatException('Learning journal must be a JSON list.');
    }

    final operations = <LearningPendingOperation>[];
    for (final entry in decoded) {
      if (entry is! Map) {
        throw const FormatException(
          'Learning journal contains an invalid operation.',
        );
      }
      operations.add(
        LearningPendingOperation.fromJson(Map<String, dynamic>.from(entry)),
      );
    }
    return operations;
  }

  Future<void> _write(
    String userId,
    List<LearningPendingOperation> operations,
  ) async {
    final preferences = await SharedPreferences.getInstance();
    final key = _storageKey(userId);
    if (operations.isEmpty) {
      final existed = preferences.containsKey(key);
      if (existed && !await preferences.remove(key)) {
        throw StateError(
          'Không thể xóa thao tác học đã hoàn tất khỏi hàng đợi.',
        );
      }
      return;
    }

    final saved = await preferences.setString(
      key,
      jsonEncode(operations.map((item) => item.toJson()).toList()),
    );
    if (!saved) {
      throw StateError('Không thể lưu hàng đợi đồng bộ tiến trình học.');
    }
  }

  void _validateUserId(String userId) {
    if (userId.trim().isEmpty) {
      throw ArgumentError.value(userId, 'userId', 'User ID must not be empty.');
    }
  }

  void _validateOperationInput({
    required String userId,
    required LearningOperationKind kind,
    required String entityId,
    required String baseEntityRevision,
    required int? quality,
  }) {
    _validateUserId(userId);
    if (entityId.trim().isEmpty) {
      throw ArgumentError.value(entityId, 'entityId');
    }
    final revision = BigInt.tryParse(baseEntityRevision);
    if (revision == null || revision.isNegative) {
      throw ArgumentError.value(baseEntityRevision, 'baseEntityRevision');
    }
    if (kind == LearningOperationKind.reviewFlashcard &&
        (quality == null || quality < 0 || quality > 5)) {
      throw ArgumentError.value(quality, 'quality', 'Quality must be 0–5.');
    }
    if (kind == LearningOperationKind.completeLesson && quality != null) {
      throw ArgumentError.value(quality, 'quality');
    }
  }

  String _storageKey(String userId) =>
      '$_keyPrefix${Uri.encodeComponent(userId.trim())}';

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

  static String createOperationId() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((value) => value.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-'
        '${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-'
        '${hex.substring(16, 20)}-'
        '${hex.substring(20, 32)}';
  }
}
