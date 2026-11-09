import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class LocalExamAnswer {
  const LocalExamAnswer({required this.selectedOption, required this.updatedAt});

  final String? selectedOption;
  final DateTime updatedAt;
}

/// User-scoped unsynced answer cache. It stores only the learner's selections,
/// never the correct option or explanations. Successfully synchronized entries
/// are removed; remaining entries are merged when resuming an active Attempt.
class ExamAttemptLocalStore {
  static const String _prefix = 'toeic.exam.local_drafts.v1.user.';
  Future<void> _queue = Future<void>.value();

  Future<void> saveAnswer({
    required String userId,
    required String attemptId,
    required String questionId,
    required String? selectedOption,
  }) {
    _validate(userId, attemptId, questionId);
    if (selectedOption != null &&
        !const ['A', 'B', 'C', 'D'].contains(selectedOption)) {
      throw ArgumentError.value(selectedOption, 'selectedOption');
    }
    return _serialize(() async {
      final all = await _read(userId);
      final attempt = all.putIfAbsent(attemptId, () => <String, dynamic>{});
      attempt[questionId] = {
        'selectedOption': selectedOption,
        'updatedAt': DateTime.now().toUtc().toIso8601String(),
      };
      await _write(userId, all);
    });
  }

  Future<void> markAnswerSynced({
    required String userId,
    required String attemptId,
    required String questionId,
    required String? expectedSelectedOption,
  }) {
    _validate(userId, attemptId, questionId);
    return _serialize(() async {
      final all = await _read(userId);
      final attempt = all[attemptId];
      if (attempt == null) return;
      final raw = attempt[questionId];
      if (raw is! Map) return;
      final savedValue = raw['selectedOption'];
      if (savedValue != expectedSelectedOption) return;
      attempt.remove(questionId);
      if (attempt.isEmpty) all.remove(attemptId);
      await _write(userId, all);
    });
  }

  Future<Map<String, LocalExamAnswer>> loadUnsyncedAnswers({
    required String userId,
    required String attemptId,
  }) async {
    _validate(userId, attemptId, '_');
    await _queue;
    final all = await _read(userId);
    final rawAttempt = all[attemptId] ?? const <String, dynamic>{};
    final result = <String, LocalExamAnswer>{};
    for (final entry in rawAttempt.entries) {
      if (entry.value is! Map) continue;
      final data = Map<String, dynamic>.from(entry.value as Map);
      final selected = data['selectedOption'];
      final updatedAt = DateTime.tryParse(data['updatedAt'] as String? ?? '');
      if ((selected != null && selected is! String) || updatedAt == null) continue;
      if (selected is String && !const ['A', 'B', 'C', 'D'].contains(selected)) continue;
      result[entry.key] = LocalExamAnswer(
        selectedOption: selected as String?,
        updatedAt: updatedAt.toUtc(),
      );
    }
    return Map.unmodifiable(result);
  }

  Future<void> clearAttempt({required String userId, required String attemptId}) {
    _validate(userId, attemptId, '_');
    return _serialize(() async {
      final all = await _read(userId);
      all.remove(attemptId);
      await _write(userId, all);
    });
  }

  Future<Map<String, Map<String, dynamic>>> _read(String userId) async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_key(userId));
    if (raw == null || raw.isEmpty) return <String, Map<String, dynamic>>{};
    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      throw const FormatException('Exam local draft không hợp lệ.');
    }
    final result = <String, Map<String, dynamic>>{};
    for (final entry in decoded.entries) {
      if (entry.key is! String || entry.value is! Map) continue;
      result[entry.key as String] = Map<String, dynamic>.from(entry.value as Map);
    }
    return result;
  }

  Future<void> _write(
    String userId,
    Map<String, Map<String, dynamic>> all,
  ) async {
    final preferences = await SharedPreferences.getInstance();
    final key = _key(userId);
    if (all.isEmpty) {
      if (preferences.containsKey(key) && !await preferences.remove(key)) {
        throw StateError('Không thể xóa bản nháp bài thi đã đồng bộ.');
      }
      return;
    }
    final saved = await preferences.setString(key, jsonEncode(all));
    if (!saved) throw StateError('Không thể lưu câu trả lời tạm trên thiết bị.');
  }

  String _key(String userId) => '$_prefix${Uri.encodeComponent(userId.trim())}';

  void _validate(String userId, String attemptId, String questionId) {
    if (userId.trim().isEmpty || attemptId.trim().isEmpty || questionId.trim().isEmpty) {
      throw ArgumentError('userId, attemptId và questionId không được để trống.');
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
