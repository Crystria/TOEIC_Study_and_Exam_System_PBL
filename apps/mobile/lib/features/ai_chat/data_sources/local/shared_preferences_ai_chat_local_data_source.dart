import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'ai_chat_local_data_source.dart';

/// User-scoped Development history storage backed by SharedPreferences.
class SharedPreferencesAiChatLocalDataSource implements AiChatLocalDataSource {
  static const String _keyPrefix = 'toeic.ai_chat.history.v1.user.';
  Future<void> _writeQueue = Future<void>.value();

  @override
  Future<Map<String, Object?>?> readSnapshot(String userId) async {
    final normalizedUserId = _validateUserId(userId);
    await _writeQueue;
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_key(normalizedUserId));
    if (raw == null || raw.isEmpty) return null;

    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      throw const FormatException(
        'AI Chat local snapshot phải là JSON object.',
      );
    }
    return Map<String, Object?>.from(decoded);
  }

  @override
  Future<void> writeSnapshot(String userId, Map<String, Object?> snapshot) {
    final normalizedUserId = _validateUserId(userId);
    final encoded = jsonEncode(snapshot);
    final completer = Completer<void>();

    _writeQueue = _writeQueue.then((_) async {
      try {
        final preferences = await SharedPreferences.getInstance();
        final saved = await preferences.setString(
          _key(normalizedUserId),
          encoded,
        );
        if (!saved) {
          throw StateError('Không thể lưu lịch sử AI Chat trên thiết bị.');
        }
        completer.complete();
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });

    return completer.future;
  }

  String _key(String userId) =>
      '$_keyPrefix${base64Url.encode(utf8.encode(userId))}';

  String _validateUserId(String userId) {
    final normalized = userId.trim();
    if (normalized.isEmpty) {
      throw ArgumentError.value(userId, 'userId', 'User ID không được rỗng.');
    }
    return normalized;
  }
}
