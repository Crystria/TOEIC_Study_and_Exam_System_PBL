import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Local persistence for vocabulary learning progress.
///
/// The store keeps one record per unique word. Re-rating a word updates its
/// latest grade and last-studied date without increasing the lifetime count.
class VocabularyProgressStorage {
  static const String _storageKey = 'toeic.vocabulary.progress.v1';

  Future<void> _writeQueue = Future<void>.value();

  Future<VocabularyProgressSnapshot> loadSnapshot() async {
    await _writeQueue;
    return _readSnapshot();
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
  }) {
    return _serialize(() async {
      final snapshot = await _readSnapshot();
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
        firstStudiedAt: previous?.firstStudiedAt ?? now,
        lastStudiedAt: now,
      );

      await _writeSnapshot(snapshot);
      return snapshot;
    });
  }

  Future<VocabularyProgressSnapshot> saveDailyGoal(int goal) {
    return _serialize(() async {
      final snapshot = await _readSnapshot();
      snapshot.dailyGoal = goal;
      await _writeSnapshot(snapshot);
      return snapshot;
    });
  }

  Future<T> _serialize<T>(Future<T> Function() operation) {
    final completer = Completer<T>();
    _writeQueue = _writeQueue.then((_) async {
      try {
        completer.complete(await operation());
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }

  Future<VocabularyProgressSnapshot> _readSnapshot() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_storageKey);
    if (raw == null || raw.isEmpty) {
      return VocabularyProgressSnapshot.empty();
    }

    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      throw const FormatException('Dữ liệu tiến trình từ vựng không hợp lệ.');
    }
    return VocabularyProgressSnapshot.fromJson(
      Map<String, dynamic>.from(decoded),
    );
  }

  Future<void> _writeSnapshot(VocabularyProgressSnapshot snapshot) async {
    final preferences = await SharedPreferences.getInstance();
    final saved = await preferences.setString(
      _storageKey,
      jsonEncode(snapshot.toJson()),
    );
    if (!saved) {
      throw StateError('Không thể lưu tiến trình từ vựng vào thiết bị.');
    }
  }
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
      firstStudiedAt: DateTime.parse(json['firstStudiedAt'] as String),
      lastStudiedAt: DateTime.parse(json['lastStudiedAt'] as String),
    );
  }
}

class VocabularyProgressSnapshot {
  VocabularyProgressSnapshot({required this.dailyGoal, required this.words});

  int dailyGoal;
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
    return VocabularyProgressSnapshot(dailyGoal: 20, words: {});
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

    return VocabularyProgressSnapshot(
      dailyGoal: (json['dailyGoal'] as num?)?.toInt() ?? 20,
      words: words,
    );
  }

  Map<String, dynamic> toJson() => {
    'dailyGoal': dailyGoal,
    'words': words.map((key, value) => MapEntry(key, value.toJson())),
  };
}
