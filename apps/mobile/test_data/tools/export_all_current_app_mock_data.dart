import 'dart:convert';
import 'dart:io';

import 'package:toeic_mobile/features/ai_chat/mock_data/ai_chat_mock_data.dart';
import 'package:toeic_mobile/features/analytics/models/analytics_models.dart';
import 'package:toeic_mobile/features/analytics/repositories/analytics_repository.dart';
import 'package:toeic_mobile/features/learning/mock_data/grammar_catalog.dart';
import 'package:toeic_mobile/features/mock_test/mock_data/mock_test_mock_data.dart';
import 'package:toeic_mobile/features/mock_test/mock_data/mock_test_score_reference.dart';
import 'package:toeic_mobile/features/mock_test/mock_data/mock_test_taking_mock_data.dart';
import 'package:toeic_mobile/features/mock_test/models/test_attempt_group.dart';

Future<void> writeJson(
  Directory root,
  String relativePath,
  Object? data,
) async {
  final file = File('${root.path}${Platform.pathSeparator}$relativePath');
  await file.parent.create(recursive: true);
  const encoder = JsonEncoder.withIndent('  ');
  await file.writeAsString('${encoder.convert(data)}\n');
}

Map<String, Object?> questionToJson(MockTestQuestionSeed seed) {
  final q = seed.question;
  return {
    'questionId': q.questionId,
    'part': q.part,
    'orderNo': q.orderNo,
    'type': q.type,
    'questionText': q.questionText,
    'options': q.options
        .map((o) => {'optionCode': o.optionCode, 'optionText': o.optionText})
        .toList(),
    'groupId': q.groupId,
    'positionInGroup': q.positionInGroup,
    'audioUrl': q.audioUrl,
    'imageUrl': q.imageUrl,
    'imageDescription': q.imageDescription,
    'transcript': q.transcript,
    'correctOption': seed.correctOption,
    'explanation': seed.explanation,
  };
}

Map<String, Object?> groupToJson(TestAttemptGroup g) => {
  'groupId': g.groupId,
  'part': g.part,
  'orderNo': g.orderNo,
  'type': g.type,
  'instruction': g.instruction,
  'audioUrl': g.audioUrl,
  'transcript': g.transcript,
  'passageText': g.passageText,
  'assets': g.assets
      .map(
        (a) => {
          'assetId': a.assetId,
          'kind': a.kind,
          'orderNo': a.orderNo,
          'content': a.content,
          'publicUrl': a.publicUrl,
        },
      )
      .toList(),
};

Map<String, Object?> grammarToJson(lesson) => {
  'id': lesson.id,
  'title': lesson.title,
  'category': lesson.category,
  'summary': lesson.summary,
  'level': lesson.level,
  'durationMinutes': lesson.durationMinutes,
  'keyTakeaway': lesson.keyTakeaway,
  'contentMarkdown': lesson.contentMarkdown,
  'contentHtml': lesson.contentHtml,
  'serverStatus': lesson.serverStatus,
  'sections': lesson.sections
      .map(
        (s) => {
          'title': s.title,
          'explanation': s.explanation,
          'examples': s.examples,
        },
      )
      .toList(),
};

Map<String, Object?> chatMessageToJson(message) => {
  'id': message.id,
  'role': message.role.name,
  'text': message.text,
  'bullets': message.bullets,
  'createdAt': message.createdAt?.toIso8601String(),
  'status': message.status.name,
};

Map<String, Object?> analyticsProgressToJson(AnalyticsProgress p) => {
  'timeRange': p.timeRange.apiValue,
  'timezone': p.timezone,
  'asOf': p.asOf.toIso8601String(),
  'from': p.from?.toIso8601String(),
  'lifetime': _counters(p.lifetime),
  'inRange': _counters(p.inRange),
  'learningStreakDays': p.learningStreakDays,
  'longestStreak': p.longestStreak,
  'scoreTrend': p.scoreTrend
      .map(
        (x) => {
          'attemptId': x.attemptId,
          'completedAt': x.completedAt.toIso8601String(),
          'scoreListening': x.scoreListening,
          'scoreReading': x.scoreReading,
          'totalScore': x.totalScore,
          'scoring': x.scoring,
        },
      )
      .toList(),
  'scoreTrendNextCursor': p.scoreTrendNextCursor,
  'predictedToeicScore': p.predictedToeicScore,
  'weakAreas': p.weakAreas
      .map(
        (x) => {
          'part': x.part,
          'status': x.status,
          'correct': x.correct,
          'total': x.total,
          'weaknessScore': x.weaknessScore,
          'isWeak': x.isWeak,
          'calculatedAt': x.calculatedAt?.toIso8601String(),
        },
      )
      .toList(),
  'dailyActivity': p.dailyActivity
      .map((x) => {'date': x.date.toIso8601String(), 'count': x.count})
      .toList(),
  'updatedAt': p.updatedAt?.toIso8601String(),
  'dailyActivityTruncated': p.dailyActivityTruncated,
};
Map<String, Object?> _counters(AnalyticsCounters c) => {
  'vocabulariesLearned': c.vocabulariesLearned,
  'reviewCount': c.reviewCount,
  'grammarLessonsCompleted': c.grammarLessonsCompleted,
  'mockTestCount': c.mockTestCount,
  'practiceCount': c.practiceCount,
  'studyDays': c.studyDays,
};
Map<String, Object?> historyItemToJson(AnalyticsHistoryItem x) => {
  'attemptId': x.attemptId,
  'testId': x.testId,
  'mode': x.mode.name,
  'completedAt': x.completedAt.toIso8601String(),
  'partStats': x.partStats
      .map((s) => {'part': s.part, 'correct': s.correct, 'total': s.total})
      .toList(),
  'scoreListening': x.scoreListening,
  'scoreReading': x.scoreReading,
  'totalScore': x.totalScore,
  'correctCount': x.correctCount,
  'totalQuestions': x.totalQuestions,
  'accuracy': x.accuracy,
  'scoring': x.scoring,
};

Future<void> main(List<String> args) async {
  final target = Directory(
    args.isEmpty ? 'test_data/offline_source_export' : args.first,
  );
  await target.create(recursive: true);
  final bank = MockTestTakingMockData.buildBank();
  await writeJson(target, 'exam/question_bank_full_TESTER_ONLY.json', {
    'classification': 'TESTER_ONLY_DO_NOT_BUNDLE_IN_APPLICATION',
    'source': 'MockTestTakingMockData.buildBank()',
    'totalQuestions': bank.questions.length,
    'questions': bank.questions.map(questionToJson).toList(),
    'groups': bank.groups.map(groupToJson).toList(),
  });
  await writeJson(target, 'exam/test_catalog_source.json', {
    'tests': MockTestMockData.tests
        .map(
          (t) => {
            'testId': t.testId,
            'title': t.title,
            'durationSeconds': t.durationSeconds,
            'createdAt': t.createdAt.toIso8601String(),
            'totalQuestions': t.totalQuestions,
          },
        )
        .toList(),
    'parts': MockTestMockData.parts
        .map(
          (p) => {
            'part': p.part,
            'title': p.title,
            'totalQuestions': p.totalQuestions,
            'groupCount': p.groupCount,
            'available': p.available,
            'errors': p.errors,
          },
        )
        .toList(),
  });
  await writeJson(target, 'exam/score_reference_source.json', {
    'version': MockTestScoreReference.version,
    'official': MockTestScoreReference.official,
    'disclaimer': MockTestScoreReference.disclaimer,
    'sourceNote': MockTestScoreReference.sourceNote,
    'listening': MockTestScoreReference.listening,
    'reading': MockTestScoreReference.reading,
  });
  await writeJson(target, 'learning/grammar_catalog_source.json', {
    'source': 'GrammarCatalog.lessons',
    'items': GrammarCatalog.lessons.map(grammarToJson).toList(),
  });
  await writeJson(target, 'ai_chat/conversations_source.json', {
    'backendIntegrationSafetyPassed': false,
    'conversations': AiChatMockData.conversations
        .map(
          (c) => {
            'id': c.id,
            'title': c.title,
            'lastMessagePreview': c.lastMessagePreview,
            'updatedAt': c.updatedAt.toIso8601String(),
            'context': c.context?.toApiPayload(),
          },
        )
        .toList(),
    'messagesByConversation': AiChatMockData.messagesByConversation.map(
      (id, messages) => MapEntry(id, messages.map(chatMessageToJson).toList()),
    ),
  });
  final analytics = MockAnalyticsRepository();
  final progress = <String, Object?>{};
  for (final range in AnalyticsTimeRange.values) {
    final value = await analytics.getProgress(range);
    progress[range.name] = analyticsProgressToJson(value);
  }
  final scores = await analytics.getScores(page: 1, size: 50);
  final practices = await analytics.getPractices(page: 1, size: 50);
  final streak = await analytics.getStreak();
  final prediction = await analytics.getPrediction();
  final weak = await analytics.getWeakAreas();
  await writeJson(target, 'analytics/analytics_source_export.json', {
    'isDemoData': analytics.isDemoData,
    'progress': progress,
    'scores': {
      'items': scores.items.map(historyItemToJson).toList(),
      'total': scores.total,
      'page': scores.page,
      'size': scores.size,
      'totalPages': scores.totalPages,
    },
    'practices': {
      'items': practices.items.map(historyItemToJson).toList(),
      'total': practices.total,
      'page': practices.page,
      'size': practices.size,
      'totalPages': practices.totalPages,
    },
    'streak': {
      'learningStreakDays': streak.learningStreakDays,
      'longestStreak': streak.longestStreak,
      'timezone': streak.timezone,
      'asOf': streak.asOf.toIso8601String(),
      'lastActivityDate': streak.lastActivityDate?.toIso8601String(),
    },
    'prediction': {
      'predictedToeicScore': prediction.predictedToeicScore,
      'eligibleFullCount': prediction.eligibleFullCount,
      'usedAttemptIds': prediction.usedAttemptIds,
      'method': prediction.method,
      'windowDays': prediction.windowDays,
      'asOf': prediction.asOf.toIso8601String(),
      'reason': prediction.reason,
    },
    'weakAreas': {
      'items': weak.items
          .map(
            (x) => {
              'part': x.part,
              'status': x.status,
              'correct': x.correct,
              'total': x.total,
              'weaknessScore': x.weaknessScore,
              'isWeak': x.isWeak,
            },
          )
          .toList(),
      'asOf': weak.asOf.toIso8601String(),
      'windowDays': weak.windowDays,
      'minimumQuestions': weak.minimumQuestions,
      'threshold': weak.threshold,
      'timezone': weak.timezone,
    },
  });
  stdout.writeln(
    'Exported current exam, grammar, AI Chat and Analytics fixtures to ${target.path}.',
  );
  stdout.writeln(
    'VocabularyProvider._catalog and ReviewSelectWordsProvider local map remain represented in the static JSON fixture pack because those fields are library-private.',
  );
}
