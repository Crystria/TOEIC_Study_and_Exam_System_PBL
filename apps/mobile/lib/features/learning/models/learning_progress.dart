/// Domain representation of a persisted vocabulary progress record.
///
/// This model deliberately does not expose SharedPreferences or storage DTOs.
class LearningVocabularyProgressRecord {
  const LearningVocabularyProgressRecord({
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
    this.serverRevision,
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
}

class LearningVocabularyProgress {
  LearningVocabularyProgress({
    required this.dailyGoal,
    required this.remindEnabled,
    required Map<String, LearningVocabularyProgressRecord> words,
  }) : words = Map.unmodifiable(words);

  static const int defaultDailyGoal = 20;

  final int dailyGoal;
  final bool remindEnabled;
  final Map<String, LearningVocabularyProgressRecord> words;

  int get totalLearnedWords => words.length;

  List<LearningVocabularyProgressRecord> get todayWords {
    final today = dateKey(DateTime.now());
    final result =
        words.values
            .where((record) => dateKey(record.lastStudiedAt) == today)
            .toList(growable: true)
          ..sort((a, b) => a.lastStudiedAt.compareTo(b.lastStudiedAt));
    return List.unmodifiable(result);
  }

  static String dateKey(DateTime date) {
    final local = date.toLocal();
    return '${local.year.toString().padLeft(4, '0')}-'
        '${local.month.toString().padLeft(2, '0')}-'
        '${local.day.toString().padLeft(2, '0')}';
  }

  factory LearningVocabularyProgress.empty() => LearningVocabularyProgress(
    dailyGoal: defaultDailyGoal,
    remindEnabled: true,
    words: const {},
  );
}

class LearningGrammarProgress {
  LearningGrammarProgress({
    required Set<String> startedLessonIds,
    required Set<String> completedLessonIds,
    required Map<String, String> revisions,
  }) : startedLessonIds = Set.unmodifiable(startedLessonIds),
       completedLessonIds = Set.unmodifiable(completedLessonIds),
       revisions = Map.unmodifiable(revisions);

  final Set<String> startedLessonIds;
  final Set<String> completedLessonIds;
  final Map<String, String> revisions;

  String revisionFor(String lessonId) => revisions[lessonId] ?? '0';

  factory LearningGrammarProgress.empty() => LearningGrammarProgress(
    startedLessonIds: const {},
    completedLessonIds: const {},
    revisions: const {},
  );
}
