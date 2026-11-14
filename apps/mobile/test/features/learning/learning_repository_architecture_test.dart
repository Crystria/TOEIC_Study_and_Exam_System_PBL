import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../lib/core/errors/app_exception.dart';
import '../../../lib/core/storage/grammar_progress_storage.dart';
import '../../../lib/core/storage/vocabulary_progress_storage.dart';
import '../../../lib/features/learning/data_sources/local/learning_local_data_source.dart';
import '../../../lib/features/learning/data_sources/remote/learning_remote_data_source.dart';
import '../../../lib/features/learning/data_sources/test_data/learning_test_data_source.dart';
import '../../../lib/features/learning/models/grammar_lesson.dart';
import '../../../lib/features/learning/models/learning_dtos.dart';
import '../../../lib/features/learning/models/learning_models.dart';
import '../../../lib/features/learning/models/learning_progress.dart';
import '../../../lib/features/learning/repositories/learning_repository.dart';
import '../../../lib/features/learning/repositories/learning_sync_journal.dart';
import '../../../lib/features/learning/repositories/test_data_learning_repository.dart';
import '../../../lib/features/learning/providers/vocabulary_topic_provider.dart';
import '../../../lib/features/learning/requests/learning_request_dtos.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _MemoryLearningLocalDataSource localDataSource;
  late String activeUserId;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    activeUserId = 'user-a';
    localDataSource = _MemoryLearningLocalDataSource(
      currentUserId: () => activeUserId,
    );
  });

  Future<String> readProjectFile(String path) async {
    final direct = File(path);
    if (await direct.exists()) return direct.readAsString();
    final mobileRoot = File('apps/mobile/$path');
    if (await mobileRoot.exists()) return mobileRoot.readAsString();
    throw FileSystemException('Project fixture was not found.', path);
  }

  LearningTestDataSource fixtureSource() =>
      LearningTestDataSource(loadAsset: readProjectFile);

  group('Learning Test Data Data Source', () {
    test(
      'normalizes vocabulary and grammar fixture IDs and relationships',
      () async {
        final source = fixtureSource();
        final topics = await source.listTopics(
          query: const LearningPageQueryDto(page: 1, size: 50),
        );
        final vocabularies = await source.listVocabularies(
          query: const LearningPageQueryDto(page: 1, size: 50),
        );
        final grammar = await source.listGrammarLessons(
          query: const LearningPageQueryDto(page: 1, size: 50),
        );

        expect(topics.items.map((item) => item.topicId), ['t1', 't2']);
        expect(vocabularies.items, hasLength(6));
        expect(vocabularies.items.first.vocabularyId, 't1-v1');
        expect(vocabularies.items.first.topicId, 't1');
        expect(grammar.items, hasLength(8));
        expect(grammar.items.first.lessonId, 'g1');
        expect(grammar.items.first.sections, isNotEmpty);
      },
    );

    test(
      'mutation receipts preserve operation identity and increment revisions',
      () async {
        final source = fixtureSource();
        final receipt = await source.reviewFlashcard(
          vocabularyId: 't1-v1',
          request: const ReviewFlashcardRequestDto(
            operationId: 'review-op-1',
            quality: 5,
            baseEntityRevision: '8',
          ),
        );
        expect(receipt.operationId, 'review-op-1');
        expect(receipt.entityId, 't1-v1');
        expect(receipt.revision, '9');

        await expectLater(
          source.reviewFlashcard(
            vocabularyId: 't1-v1',
            request: const ReviewFlashcardRequestDto(
              operationId: 'review-op-invalid',
              quality: 9,
              baseEntityRevision: '0',
            ),
          ),
          throwsArgumentError,
        );

        await expectLater(
          source.completeGrammarLesson(
            lessonId: 'g1',
            request: const CompleteGrammarLessonRequestDto(
              operationId: 'grammar-op-1',
              baseEntityRevision: '-1',
            ),
          ),
          throwsArgumentError,
        );
      },
    );
  });

  test(
    'Learning Providers do not import fixture or storage implementations',
    () async {
      const providerFiles = <String>[
        'lib/features/learning/providers/vocabulary_provider.dart',
        'lib/features/learning/providers/vocabulary_topic_provider.dart',
        'lib/features/learning/providers/grammar_list_provider.dart',
        'lib/features/learning/providers/grammar_lesson_provider.dart',
        'lib/features/learning/providers/review_select_words_provider.dart',
        'lib/features/learning/providers/review_flashcard_provider.dart',
      ];
      for (final path in providerFiles) {
        final source = await readProjectFile(path);
        expect(source, isNot(contains('mock_data/')), reason: path);
        expect(source, isNot(contains('data_sources/')), reason: path);
        expect(
          source,
          isNot(contains('VocabularyProgressStorage')),
          reason: path,
        );
        expect(source, isNot(contains('GrammarProgressStorage')), reason: path);
        expect(source, isNot(contains('isDemoData')), reason: path);
        expect(source, isNot(contains('TestData')), reason: path);
        expect(source, isNot(contains('rootBundle')), reason: path);
        expect(source, isNot(contains('jsonDecode')), reason: path);
        expect(source, isNot(contains('LearningApiService')), reason: path);
        expect(
          source,
          contains('required LearningRepository repository'),
          reason: path,
        );
      }

      var screenDirectory = Directory('lib/features/learning/screens');
      if (!await screenDirectory.exists()) {
        screenDirectory = Directory(
          'apps/mobile/lib/features/learning/screens',
        );
      }
      final screenFiles = screenDirectory
          .listSync(recursive: true)
          .whereType<File>()
          .where((file) => file.path.endsWith('.dart'));
      for (final file in screenFiles) {
        final source = await file.readAsString();
        expect(source, isNot(contains('data_sources/')), reason: file.path);
        expect(
          source,
          isNot(contains('VocabularyProgressStorage')),
          reason: file.path,
        );
        expect(
          source,
          isNot(contains('GrammarProgressStorage')),
          reason: file.path,
        );
        expect(
          source,
          isNot(contains('LearningApiService')),
          reason: file.path,
        );
        expect(source, isNot(contains('isDemoData')), reason: file.path);
        expect(source, isNot(contains('TestData')), reason: file.path);
        expect(source, isNot(contains('rootBundle')), reason: file.path);
      }
    },
  );

  test(
    'SharedPreferences Local Data Source persists progress per user',
    () async {
      final vocabularyStorage = VocabularyProgressStorage()..bindUser('user-a');
      final grammarStorage = GrammarProgressStorage();
      final localSource = SharedPreferencesLearningLocalDataSource(
        vocabularyStorage: vocabularyStorage,
        grammarStorage: grammarStorage,
      );

      await localSource.recordStudiedWord(
        wordId: 't1-v1',
        word: 'negotiate',
        phonetic: '/nɪˈɡoʊʃieɪt/',
        definition: 'thương lượng, đàm phán',
        example: 'We need to negotiate the contract terms.',
        audioUrl: '',
        topicId: 't1',
        topicName: 'Office & Business',
        grade: 5,
      );
      await localSource.markGrammarLessonStarted('user-a', 'g1');
      await localSource.markGrammarLessonCompleted(
        'user-a',
        'g1',
        revision: '1',
      );

      final reloadedVocabularyStorage = VocabularyProgressStorage()
        ..bindUser('user-a');
      final reloaded = SharedPreferencesLearningLocalDataSource(
        vocabularyStorage: reloadedVocabularyStorage,
        grammarStorage: GrammarProgressStorage(),
      );
      expect(
        (await reloaded.loadVocabularyProgress()).words.keys,
        contains('t1-v1'),
      );
      expect(
        (await reloaded.loadGrammarProgress('user-a')).completedLessonIds,
        contains('g1'),
      );

      final otherUser = SharedPreferencesLearningLocalDataSource(
        vocabularyStorage: VocabularyProgressStorage()..bindUser('user-b'),
        grammarStorage: GrammarProgressStorage(),
      );
      expect((await otherUser.loadVocabularyProgress()).words, isEmpty);
      expect(
        (await otherUser.loadGrammarProgress('user-b')).completedLessonIds,
        isEmpty,
      );
    },
  );

  group('Learning Repository contract', () {
    test(
      'API and Test Data implementations return the same domain models',
      () async {
        final LearningRepository testRepository = TestDataLearningRepository(
          testDataSource: fixtureSource(),
          localDataSource: localDataSource,
          currentUserId: () => activeUserId,
        );
        final LearningRepository apiRepository = ApiLearningRepository(
          remoteDataSource: _FixtureLikeApiDataSource(),
          localDataSource: localDataSource,
          currentUserId: () => activeUserId,
          syncJournal: LearningSyncJournal(),
        );

        final testTopic = await testRepository.getTopic('t1');
        final apiTopic = await apiRepository.getTopic('t1');
        expect(apiTopic.id, testTopic.id);
        expect(apiTopic.name, testTopic.name);
        expect(apiTopic.vocabularyCount, testTopic.vocabularyCount);

        final testVocabulary = await testRepository.getVocabulary('t1-v1');
        final apiVocabulary = await apiRepository.getVocabulary('t1-v1');
        expect(apiVocabulary.id, testVocabulary.id);
        expect(apiVocabulary.topicId, testVocabulary.topicId);
        expect(apiVocabulary.topicName, testVocabulary.topicName);
        expect(apiVocabulary.word, testVocabulary.word);
        expect(apiVocabulary.definition, testVocabulary.definition);

        final testLesson = await testRepository.getGrammarLesson('g1');
        final apiLesson = await apiRepository.getGrammarLesson('g1');
        expect(apiLesson.id, testLesson.id);
        expect(apiLesson.title, testLesson.title);
        expect(apiLesson.category, testLesson.category);
        expect(apiLesson.summary, testLesson.summary);
        expect(apiLesson.sections.length, testLesson.sections.length);

        final apiDue = await apiRepository.getDueProgress();
        final testDue = await testRepository.getDueProgress();
        expect(apiDue, isA<List<LearningReviewProgress>>());
        expect(testDue, isA<List<LearningReviewProgress>>());

        expect(
          await apiRepository.getProgressSummary(),
          isA<LearningProgressSummary>(),
        );
        expect(
          await testRepository.getProgressSummary(),
          isA<LearningProgressSummary>(),
        );

        final apiReceipt = await apiRepository.reviewFlashcard(
          vocabularyId: 't1-v1',
          quality: 5,
          baseEntityRevision: '0',
        );
        final testReceipt = await testRepository.reviewFlashcard(
          vocabularyId: 't1-v1',
          quality: 5,
          baseEntityRevision: '0',
        );
        expect(apiReceipt, isA<LearningMutationReceipt>());
        expect(testReceipt, isA<LearningMutationReceipt>());
        expect(apiReceipt.entityId, testReceipt.entityId);
        expect(apiReceipt.revision, testReceipt.revision);
        await apiRepository.acknowledgeMutation(
          userId: activeUserId,
          operationId: apiReceipt.operationId,
        );
        await testRepository.acknowledgeMutation(
          userId: activeUserId,
          operationId: testReceipt.operationId,
        );
      },
    );

    test(
      'Legacy progress is accessed through Repository and Provider contracts',
      () async {
        localDataSource.hasLegacyProgressForTesting = true;
        final repository = TestDataLearningRepository(
          testDataSource: fixtureSource(),
          localDataSource: localDataSource,
          currentUserId: () => activeUserId,
        );
        final provider = VocabularyTopicsProvider(repository: repository);
        addTearDown(provider.dispose);

        await provider.refreshLegacyProgressStatus();
        expect(provider.hasUnassignedLegacyProgress, isTrue);

        await expectLater(
          provider.importLegacyProgress(confirmOwnership: false),
          throwsA(isA<StateError>()),
        );
        expect(provider.hasUnassignedLegacyProgress, isTrue);

        await provider.importLegacyProgress(confirmOwnership: true);
        expect(provider.hasUnassignedLegacyProgress, isFalse);
        expect(provider.dailyGoal, 20);
        expect(await repository.hasUnassignedLegacyProgress(), isFalse);
      },
    );

    test('API and Test Data repositories expose the same legacy migration contract', () async {
      localDataSource.hasLegacyProgressForTesting = true;
      final testRepository = TestDataLearningRepository(
        testDataSource: fixtureSource(),
        localDataSource: localDataSource,
        currentUserId: () => activeUserId,
      );
      final apiRepository = ApiLearningRepository(
        remoteDataSource: _FixtureLikeApiDataSource(),
        localDataSource: localDataSource,
        currentUserId: () => activeUserId,
        syncJournal: LearningSyncJournal(),
      );

      expect(await testRepository.hasUnassignedLegacyProgress(), isTrue);
      expect(await apiRepository.hasUnassignedLegacyProgress(), isTrue);
      final imported = await apiRepository.importUnassignedLegacyProgress(
        confirmOwnership: true,
      );
      expect(imported, isA<LearningVocabularyProgress>());
      expect(await testRepository.hasUnassignedLegacyProgress(), isFalse);
    });

    test(
      'Test Data mutations persist progress outside immutable fixture assets',
      () async {
        final repository = TestDataLearningRepository(
          testDataSource: fixtureSource(),
          localDataSource: localDataSource,
          currentUserId: () => activeUserId,
        );
        await expectLater(
          repository.getGrammarProgress('user-b'),
          throwsA(isA<AppException>()),
        );

        final vocabularyReceipt = await repository.reviewFlashcard(
          vocabularyId: 't1-v1',
          quality: 5,
          baseEntityRevision: '1',
        );
        expect(vocabularyReceipt.revision, '2');
        await repository.recordStudiedVocabulary(
          wordId: 't1-v1',
          word: 'negotiate',
          phonetic: '/nɪˈɡoʊʃieɪt/',
          definition: 'thương lượng, đàm phán',
          example: 'We need to negotiate the contract terms.',
          audioUrl: '',
          topicId: 't1',
          topicName: 'Office & Business',
          grade: 5,
          serverRevision: vocabularyReceipt.revision,
        );
        await repository.acknowledgeMutation(
          userId: activeUserId,
          operationId: vocabularyReceipt.operationId,
        );

        final vocabularyProgress = await repository.getVocabularyProgress();
        expect(vocabularyProgress.words.keys, contains('t1-v1'));
        expect(vocabularyProgress.words['t1-v1']!.serverRevision, '2');

        await repository.markGrammarLessonStarted(activeUserId, 'g1');
        final grammarReceipt = await repository.completeGrammarLesson(
          lessonId: 'g1',
          baseEntityRevision: '3',
        );
        expect(grammarReceipt.revision, '4');
        await repository.markGrammarLessonCompleted(
          activeUserId,
          'g1',
          revision: grammarReceipt.revision,
        );
        await repository.acknowledgeMutation(
          userId: activeUserId,
          operationId: grammarReceipt.operationId,
        );

        final grammarProgress = await repository.getGrammarProgress(
          activeUserId,
        );
        expect(grammarProgress.startedLessonIds, isEmpty);
        expect(grammarProgress.completedLessonIds, contains('g1'));
        expect(grammarProgress.revisionFor('g1'), '4');
      },
    );

    test(
      'local flashcard grades override fixture mastery on subsequent reads',
      () async {
        final repository = TestDataLearningRepository(
          testDataSource: fixtureSource(),
          localDataSource: localDataSource,
          currentUserId: () => activeUserId,
        );

        final initial = await repository.getDueProgress();
        expect(
          initial.firstWhere((item) => item.entityId == 't1-v2').quality,
          3,
        );

        await repository.recordStudiedVocabulary(
          wordId: 't1-v2',
          word: 'invoice',
          phonetic: '/ˈɪnvɔɪs/',
          definition: 'hóa đơn',
          example: 'The invoice is due next Monday.',
          audioUrl: '',
          topicId: 't1',
          topicName: 'Office & Business',
          grade: 5,
          serverRevision: '2',
        );

        final updated = await repository.getDueProgress();
        final invoice = updated.firstWhere((item) => item.entityId == 't1-v2');
        expect(invoice.quality, 5);
        expect(invoice.revision, '2');
      },
    );

    test(
      'local progress remains isolated when the active user changes',
      () async {
        final repository = TestDataLearningRepository(
          testDataSource: fixtureSource(),
          localDataSource: localDataSource,
          currentUserId: () => activeUserId,
        );
        await repository.recordStudiedVocabulary(
          wordId: 't1-v1',
          word: 'negotiate',
          phonetic: '',
          definition: 'thương lượng',
          example: '',
          audioUrl: '',
          topicId: 't1',
          topicName: 'Office & Business',
          grade: 5,
        );

        activeUserId = 'user-b';
        localDataSource.switchUser();
        repository.resetForUserScopeChange();
        expect((await repository.getVocabularyProgress()).words, isEmpty);

        activeUserId = 'user-a';
        localDataSource.switchUser();
        repository.resetForUserScopeChange();
        expect(
          (await repository.getVocabularyProgress()).words.keys,
          contains('t1-v1'),
        );
      },
    );

    test(
      'API failure is surfaced and never falls back to fixture data',
      () async {
        final apiFailure = StateError('Learning API unavailable');
        final remote = _FixtureLikeApiDataSource(failure: apiFailure);
        final repository = ApiLearningRepository(
          remoteDataSource: remote,
          localDataSource: localDataSource,
          currentUserId: () => activeUserId,
          syncJournal: LearningSyncJournal(),
        );

        await expectLater(repository.getTopics(), throwsA(same(apiFailure)));
        expect(remote.listTopicsCalls, 1);
      },
    );
  });
}

class _MemoryLearningLocalDataSource implements LearningLocalDataSource {
  _MemoryLearningLocalDataSource({required this.currentUserId});

  final String Function() currentUserId;
  final Map<String, Map<String, LearningVocabularyProgressRecord>> _words = {};
  final Map<String, int> _goals = {};
  final Map<String, bool> _reminders = {};
  bool _hasLegacyProgress = false;
  set hasLegacyProgressForTesting(bool value) => _hasLegacyProgress = value;
  final Map<String, Set<String>> _started = {};
  final Map<String, Set<String>> _completed = {};
  final Map<String, Map<String, String>> _revisions = {};
  String _boundUser = 'user-a';

  void switchUser() => _boundUser = currentUserId();

  LearningVocabularyProgress _snapshot() => LearningVocabularyProgress(
    dailyGoal: _goals[_boundUser] ?? 20,
    remindEnabled: _reminders[_boundUser] ?? true,
    words: _words[_boundUser] ?? const {},
  );

  @override
  Future<LearningVocabularyProgress> loadVocabularyProgress() async =>
      _snapshot();

  @override
  Future<bool> hasUnassignedLegacyProgress() async => _hasLegacyProgress;

  @override
  Future<LearningVocabularyProgress> importUnassignedLegacyProgress({
    required bool confirmOwnership,
  }) async {
    if (!confirmOwnership) {
      throw StateError('Cần xác nhận quyền sở hữu dữ liệu cũ trước khi nhập.');
    }
    _hasLegacyProgress = false;
    return _snapshot();
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
  }) async {
    final records = _words.putIfAbsent(_boundUser, () => {});
    final previous = records[wordId];
    final now = DateTime.now();
    records[wordId] = LearningVocabularyProgressRecord(
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
    return _snapshot();
  }

  @override
  Future<LearningVocabularyProgress> saveDailyGoal(int goal) async {
    _goals[_boundUser] = goal;
    return _snapshot();
  }

  @override
  Future<LearningVocabularyProgress> saveReminderEnabled(bool enabled) async {
    _reminders[_boundUser] = enabled;
    return _snapshot();
  }

  @override
  Future<LearningVocabularyProgress> saveReviewSettings({
    required int dailyGoal,
    required bool remindEnabled,
  }) async {
    _goals[_boundUser] = dailyGoal;
    _reminders[_boundUser] = remindEnabled;
    return _snapshot();
  }

  @override
  Future<LearningGrammarProgress> loadGrammarProgress(String userId) async =>
      LearningGrammarProgress(
        startedLessonIds: _started[userId] ?? const {},
        completedLessonIds: _completed[userId] ?? const {},
        revisions: _revisions[userId] ?? const {},
      );

  @override
  Future<void> markGrammarLessonStarted(String userId, String lessonId) async {
    _started.putIfAbsent(userId, () => {}).add(lessonId);
  }

  @override
  Future<void> markGrammarLessonCompleted(
    String userId,
    String lessonId, {
    String? revision,
  }) async {
    _started.putIfAbsent(userId, () => {}).remove(lessonId);
    _completed.putIfAbsent(userId, () => {}).add(lessonId);
    if (revision != null) {
      _revisions.putIfAbsent(userId, () => {})[lessonId] = revision;
    }
  }

  @override
  Future<String> grammarLessonRevision(String userId, String lessonId) async =>
      _revisions[userId]?[lessonId] ?? '0';
}

class _FixtureLikeApiDataSource implements LearningRemoteDataSource {
  _FixtureLikeApiDataSource({this.failure});

  final Object? failure;
  int listTopicsCalls = 0;

  static const _topics = <LearningTopicDto>[
    LearningTopicDto(
      topicId: 't1',
      topicName: 'Office & Business',
      vocabularyCount: 20,
    ),
    LearningTopicDto(
      topicId: 't2',
      topicName: 'Daily Life',
      vocabularyCount: 24,
    ),
  ];

  static const _vocabularies = <LearningVocabularyDto>[
    LearningVocabularyDto(
      vocabularyId: 't1-v1',
      topicId: 't1',
      word: 'negotiate',
      phonetic: '/nɪˈɡoʊʃieɪt/',
      definition: 'thương lượng, đàm phán',
      example: 'We need to negotiate the contract terms.',
      audioUrl: '',
      imageUrl: '',
    ),
  ];

  static const _lessons = <LearningGrammarLessonDto>[
    LearningGrammarLessonDto(
      lessonId: 'g1',
      lessonTitle: 'Giới từ chỉ thời gian: in, on, at, by',
      category: 'Giới từ',
      summary: 'Phân biệt cách dùng các giới từ thường gặp trong thông báo và lịch làm việc.',
      level: 'Cơ bản',
      durationMinutes: 8,
      keyTakeaway:
          'IN = khoảng thời gian; ON = ngày; AT = thời điểm; BY = hạn chót.',
      sections: [
        GrammarLessonSection(
          title: 'IN — khoảng thời gian',
          explanation:
              'Dùng in với tháng, năm, mùa và các khoảng thời gian dài.',
          examples: [
            'The conference will take place in November.',
            'Sales increased in 2026.',
          ],
        ),
        GrammarLessonSection(
          title: 'ON — ngày cụ thể',
          explanation: 'Dùng on với thứ trong tuần và ngày tháng cụ thể.',
          examples: [
            'The office is closed on Monday.',
            'The interview is on May 5.',
          ],
        ),
        GrammarLessonSection(
          title: 'AT — thời điểm cụ thể',
          explanation:
              'Dùng at với giờ, thời điểm hoặc một mốc thời gian xác định.',
          examples: ['The meeting starts at 8 a.m.', 'Please arrive at noon.'],
        ),
        GrammarLessonSection(
          title: 'BY — không muộn hơn một mốc',
          explanation: 'Dùng by để diễn tả hạn chót: một việc phải hoàn tất trước hoặc tại thời điểm được nêu.',
          examples: [
            'Please submit the report by Friday.',
            'The package should arrive by noon.',
          ],
        ),
      ],
    ),
  ];

  Future<LearningPageDto<T>> _page<T>(
    List<T> items,
    LearningPageQueryDto query,
  ) async {
    final pages = items.isEmpty ? 0 : (items.length / query.size).ceil();
    final start = (query.page - 1) * query.size;
    final end = (start + query.size).clamp(0, items.length).toInt();
    return LearningPageDto<T>(
      items: start >= items.length ? <T>[] : items.sublist(start, end),
      total: items.length,
      page: query.page,
      size: query.size,
      totalPages: pages,
    );
  }

  @override
  Future<LearningPageDto<LearningTopicDto>> listTopics({
    required LearningPageQueryDto query,
  }) {
    listTopicsCalls++;
    if (failure != null) return Future.error(failure!);
    return _page(_topics, query);
  }

  @override
  Future<LearningTopicDto> getTopic(String topicId) async =>
      _topics.firstWhere((item) => item.topicId == topicId);

  @override
  Future<LearningPageDto<LearningVocabularyDto>> listVocabularies({
    required LearningPageQueryDto query,
  }) => _page(
    _vocabularies
        .where((item) => query.topicId == null || item.topicId == query.topicId)
        .toList(),
    query,
  );

  @override
  Future<LearningVocabularyDto> getVocabulary(String vocabularyId) async =>
      _vocabularies.firstWhere((item) => item.vocabularyId == vocabularyId);

  @override
  Future<LearningPageDto<LearningGrammarLessonDto>> listGrammarLessons({
    required LearningPageQueryDto query,
  }) => _page(
    _lessons
        .where(
          (item) => query.category == null || item.category == query.category,
        )
        .toList(),
    query,
  );

  @override
  Future<LearningGrammarLessonDto> getGrammarLesson(String lessonId) async =>
      _lessons.firstWhere((item) => item.lessonId == lessonId);

  @override
  Future<LearningPageDto<LearningReviewProgressDto>> listDueReviews({
    required LearningPageQueryDto query,
  }) => _page(
    _vocabularies
        .map(
          (item) => LearningReviewProgressDto(
            entityId: item.vocabularyId,
            revision: '0',
            quality: 1,
          ),
        )
        .toList(),
    query,
  );

  @override
  Future<LearningProgressSummaryDto> getProgressSummary() async =>
      const LearningProgressSummaryDto(
        reviewedVocabularies: 0,
        vocabulariesLearned: 0,
        dueVocabularies: 1,
        grammarLessonsCompleted: 0,
        sessionsCompleted: 0,
      );

  @override
  Future<LearningMutationReceiptDto> reviewFlashcard({
    required String vocabularyId,
    required ReviewFlashcardRequestDto request,
  }) async => LearningMutationReceiptDto(
    operationId: request.operationId,
    entityId: vocabularyId,
    revision: '1',
  );

  @override
  Future<LearningMutationReceiptDto> completeGrammarLesson({
    required String lessonId,
    required CompleteGrammarLessonRequestDto request,
  }) async => LearningMutationReceiptDto(
    operationId: request.operationId,
    entityId: lessonId,
    revision: '1',
  );
}
