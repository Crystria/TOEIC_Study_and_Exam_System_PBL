import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

/// Durable idempotency-key storage for start-attempt requests.
/// A request key is retained across timeout/network failures so tapping Start
/// again replays the same server idempotency identity rather than creating a
/// second attempt.
class ExamAttemptStartJournal {
  static const String _prefix = 'toeic.exam.start_journal.v1.user.';
  Future<void> _queue = Future<void>.value();

  Future<String> getOrCreate({
    required String userId,
    required String fingerprint,
  }) {
    _validate(userId, fingerprint);
    return _serialize(() async {
      final preferences = await SharedPreferences.getInstance();
      final key = _storageKey(userId);
      final raw = preferences.getString(key);
      final entries = _decode(raw);
      final existing = entries[fingerprint];
      if (existing != null) return existing;

      final generated = _uuidV4();
      entries[fingerprint] = generated;
      final saved = await preferences.setString(key, jsonEncode(entries));
      if (!saved) {
        throw StateError('Không thể lưu khóa khởi tạo lượt thi.');
      }
      return generated;
    });
  }

  Future<void> remove({
    required String userId,
    required String fingerprint,
    required String idempotencyKey,
  }) {
    _validate(userId, fingerprint);
    if (idempotencyKey.trim().isEmpty) {
      throw ArgumentError.value(idempotencyKey, 'idempotencyKey');
    }
    return _serialize(() async {
      final preferences = await SharedPreferences.getInstance();
      final key = _storageKey(userId);
      final entries = _decode(preferences.getString(key));
      if (entries[fingerprint] != idempotencyKey) return;
      entries.remove(fingerprint);
      if (entries.isEmpty) {
        if (preferences.containsKey(key) && !await preferences.remove(key)) {
          throw StateError('Không thể xóa khóa khởi tạo lượt thi đã hoàn tất.');
        }
      } else {
        final saved = await preferences.setString(key, jsonEncode(entries));
        if (!saved) {
          throw StateError('Không thể xóa khóa khởi tạo lượt thi đã hoàn tất.');
        }
      }
    });
  }

  Map<String, String> _decode(String? raw) {
    if (raw == null || raw.isEmpty) return <String, String>{};
    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      throw const FormatException('Exam start journal không hợp lệ.');
    }
    final result = <String, String>{};
    for (final entry in decoded.entries) {
      if (entry.key is! String || entry.value is! String) {
        throw const FormatException(
          'Exam start journal chứa dữ liệu sai kiểu.',
        );
      }
      result[entry.key as String] = entry.value as String;
    }
    return result;
  }

  String _storageKey(String userId) =>
      '$_prefix${Uri.encodeComponent(userId.trim())}';

  void _validate(String userId, String fingerprint) {
    if (userId.trim().isEmpty) {
      throw ArgumentError.value(userId, 'userId');
    }
    if (fingerprint.trim().isEmpty) {
      throw ArgumentError.value(fingerprint, 'fingerprint');
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

  static String _uuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((value) => value.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}';
  }
}
