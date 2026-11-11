import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class GrammarProgressSnapshot {
  const GrammarProgressSnapshot({
    required this.startedLessonIds,
    required this.completedLessonIds,
    required this.revisions,
  });

  final Set<String> startedLessonIds;
  final Set<String> completedLessonIds;
  final Map<String, String> revisions;

  String revisionFor(String lessonId) => revisions[lessonId] ?? '0';
}

/// Persists client-side Grammar progress that the current Backend contract
/// does not expose as a readable per-lesson progress endpoint.
/// Completed writes are still submitted to POST /learning/lessons/:id/complete
/// in API mode; this store is the account-scoped local cache for list UI state.
class GrammarProgressStorage {
  static const String _keyPrefix = 'toeic.learning.grammar_progress.v1.user.';
  Future<void> _queue = Future<void>.value();

  Future<GrammarProgressSnapshot> load(String userId) async {
    if (userId.trim().isEmpty) {
      throw ArgumentError.value(userId, 'userId', 'User ID must not be empty.');
    }
    await _queue;
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_key(userId));
    if (raw == null || raw.isEmpty) return _emptySnapshot();

    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      throw const FormatException('Grammar progress must be a JSON object.');
    }
    final json = Map<String, dynamic>.from(decoded);
    final started = _readStringSet(json['startedLessonIds']);
    final completed = _readStringSet(json['completedLessonIds']);
    started.removeAll(completed);
    final rawRevisions = json['revisions'];
    final revisions = <String, String>{};
    if (rawRevisions is Map) {
      for (final entry in rawRevisions.entries) {
        if (entry.key is String && entry.value is String) {
          revisions[entry.key as String] = entry.value as String;
        }
      }
    }
    return GrammarProgressSnapshot(
      startedLessonIds: Set.unmodifiable(started),
      completedLessonIds: Set.unmodifiable(completed),
      revisions: Map.unmodifiable(revisions),
    );
  }

  Future<void> markStarted(String userId, String lessonId) {
    if (lessonId.trim().isEmpty) {
      throw ArgumentError.value(lessonId, 'lessonId');
    }
    return _update(userId, (json) {
      final started = _readStringSet(json['startedLessonIds']);
      final completed = _readStringSet(json['completedLessonIds']);
      if (!completed.contains(lessonId)) started.add(lessonId);
      json['startedLessonIds'] = started.toList();
    });
  }

  Future<void> markCompleted(
    String userId,
    String lessonId, {
    String? revision,
  }) {
    if (lessonId.trim().isEmpty) {
      throw ArgumentError.value(lessonId, 'lessonId');
    }
    return _update(userId, (json) {
      final started = _readStringSet(json['startedLessonIds']);
      final completed = _readStringSet(json['completedLessonIds']);
      final revisions = <String, dynamic>{};
      if (json['revisions'] is Map) {
        revisions.addAll(Map<String, dynamic>.from(json['revisions'] as Map));
      }
      started.remove(lessonId);
      completed.add(lessonId);
      if (revision != null && revision.trim().isNotEmpty) {
        revisions[lessonId] = revision.trim();
      }
      json['startedLessonIds'] = started.toList();
      json['completedLessonIds'] = completed.toList();
      json['revisions'] = revisions;
    });
  }

  Future<String> revisionFor(String userId, String lessonId) async {
    final snapshot = await load(userId);
    return snapshot.revisionFor(lessonId);
  }

  Future<void> _update(
    String userId,
    void Function(Map<String, dynamic> json) mutation,
  ) {
    if (userId.trim().isEmpty) {
      throw ArgumentError.value(userId, 'userId', 'User ID must not be empty.');
    }
    final completer = Completer<void>();
    _queue = _queue.then((_) async {
      try {
        final preferences = await SharedPreferences.getInstance();
        final key = _key(userId);
        final raw = preferences.getString(key);
        final decoded = raw == null || raw.isEmpty
            ? <String, dynamic>{}
            : jsonDecode(raw);
        if (decoded is! Map) {
          throw const FormatException(
            'Grammar progress must be a JSON object.',
          );
        }
        final json = Map<String, dynamic>.from(decoded);
        mutation(json);
        final saved = await preferences.setString(key, jsonEncode(json));
        if (!saved) throw StateError('Không thể lưu tiến trình Grammar.');
        completer.complete();
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }

  String _key(String userId) =>
      '$_keyPrefix${Uri.encodeComponent(userId.trim())}';

  Set<String> _readStringSet(Object? value) {
    if (value is! List) return <String>{};
    return value.whereType<String>().where((item) => item.isNotEmpty).toSet();
  }

  GrammarProgressSnapshot _emptySnapshot() => const GrammarProgressSnapshot(
    startedLessonIds: <String>{},
    completedLessonIds: <String>{},
    revisions: <String, String>{},
  );
}
