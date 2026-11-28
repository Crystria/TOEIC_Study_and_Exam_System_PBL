import '../../../../core/storage/grammar_progress_storage.dart';
import '../../../../core/storage/vocabulary_progress_storage.dart';
import '../../models/learning_progress.dart';

/// User-owned, mutable Learning state. This source is valid in Development
/// and Production; unlike Test Data it stores real user progress.
abstract interface class LearningLocalDataSource {
  Future<LearningVocabularyProgress> loadVocabularyProgress();
  Future<bool> hasUnassignedLegacyProgress();
  Future<LearningVocabularyProgress> importUnassignedLegacyProgress({
    required bool confirmOwnership,
  });
  Future<LearningVocabularyProgress> recordStudiedWord({
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
  });
  Future<LearningVocabularyProgress> saveDailyGoal(int goal);
  Future<LearningVocabularyProgress> saveReminderEnabled(bool enabled);
  Future<LearningVocabularyProgress> saveReviewSettings({
    required int dailyGoal,
    required bool remindEnabled,
  });

  Future<LearningGrammarProgress> loadGrammarProgress(String userId);
  Future<void> markGrammarLessonStarted(String userId, String lessonId);
  Future<void> markGrammarLessonCompleted(
    String userId,
    String lessonId, {
    String? revision,
  });
  Future<String> grammarLessonRevision(String userId, String lessonId);
}

class SharedPreferencesLearningLocalDataSource
    implements LearningLocalDataSource {
  SharedPreferencesLearningLocalDataSource({
    required VocabularyProgressStorage vocabularyStorage,
    required GrammarProgressStorage grammarStorage,
  }) : _vocabularyStorage = vocabularyStorage,
       _grammarStorage = grammarStorage;

  final VocabularyProgressStorage _vocabularyStorage;
  final GrammarProgressStorage _grammarStorage;

  @override
  Future<LearningVocabularyProgress> loadVocabularyProgress() async =>
      _mapVocabularySnapshot(await _vocabularyStorage.loadSnapshot());

  @override
  Future<bool> hasUnassignedLegacyProgress() =>
      _vocabularyStorage.hasUnassignedLegacyData();

  @override
  Future<LearningVocabularyProgress> importUnassignedLegacyProgress({
    required bool confirmOwnership,
  }) async {
    await _vocabularyStorage.importUnassignedLegacyData(
      confirmOwnership: confirmOwnership,
    );
    return loadVocabularyProgress();
  }

  @override
  Future<LearningVocabularyProgress> recordStudiedWord({
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
  }) async => _mapVocabularySnapshot(
    await _vocabularyStorage.recordStudiedWord(
      wordId: wordId,
      word: word,
      phonetic: phonetic,
      definition: definition,
      example: example,
      audioUrl: audioUrl,
      topicId: topicId,
      topicName: topicName,
      grade: grade,
      serverRevision: serverRevision,
    ),
  );

  @override
  Future<LearningVocabularyProgress> saveDailyGoal(int goal) async =>
      _mapVocabularySnapshot(await _vocabularyStorage.saveDailyGoal(goal));

  @override
  Future<LearningVocabularyProgress> saveReminderEnabled(bool enabled) async =>
      _mapVocabularySnapshot(
        await _vocabularyStorage.saveReminderEnabled(enabled),
      );

  @override
  Future<LearningVocabularyProgress> saveReviewSettings({
    required int dailyGoal,
    required bool remindEnabled,
  }) async => _mapVocabularySnapshot(
    await _vocabularyStorage.saveReviewSettings(
      dailyGoal: dailyGoal,
      remindEnabled: remindEnabled,
    ),
  );

  @override
  Future<LearningGrammarProgress> loadGrammarProgress(String userId) async {
    final snapshot = await _grammarStorage.load(userId);
    return LearningGrammarProgress(
      startedLessonIds: snapshot.startedLessonIds,
      completedLessonIds: snapshot.completedLessonIds,
      revisions: snapshot.revisions,
    );
  }

  @override
  Future<void> markGrammarLessonStarted(String userId, String lessonId) =>
      _grammarStorage.markStarted(userId, lessonId);

  @override
  Future<void> markGrammarLessonCompleted(
    String userId,
    String lessonId, {
    String? revision,
  }) => _grammarStorage.markCompleted(userId, lessonId, revision: revision);

  @override
  Future<String> grammarLessonRevision(String userId, String lessonId) =>
      _grammarStorage.revisionFor(userId, lessonId);

  LearningVocabularyProgress _mapVocabularySnapshot(
    VocabularyProgressSnapshot snapshot,
  ) {
    return LearningVocabularyProgress(
      dailyGoal: snapshot.dailyGoal,
      remindEnabled: snapshot.remindEnabled,
      words: {
        for (final entry in snapshot.words.entries)
          entry.key: LearningVocabularyProgressRecord(
            id: entry.value.id,
            word: entry.value.word,
            phonetic: entry.value.phonetic,
            definition: entry.value.definition,
            example: entry.value.example,
            audioUrl: entry.value.audioUrl,
            topicId: entry.value.topicId,
            topicName: entry.value.topicName,
            grade: entry.value.grade,
            serverRevision: entry.value.serverRevision,
            firstStudiedAt: entry.value.firstStudiedAt,
            lastStudiedAt: entry.value.lastStudiedAt,
          ),
      },
    );
  }
}
