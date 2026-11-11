import 'dart:convert';
import 'dart:io';

import 'package:toeic_mobile/features/mock_test/mock_data/mock_test_mock_data.dart';
import 'package:toeic_mobile/features/mock_test/mock_data/mock_test_score_reference.dart';
import 'package:toeic_mobile/features/mock_test/mock_data/mock_test_taking_mock_data.dart';
import 'package:toeic_mobile/features/mock_test/models/test_attempt_group.dart';

Map<String, Object?> questionToJson(MockTestQuestionSeed seed) {
  final q = seed.question;
  return <String, Object?>{
    'questionId': q.questionId,
    'part': q.part,
    'orderNo': q.orderNo,
    'type': q.type,
    'questionText': q.questionText,
    'options': q.options
        .map(
          (option) => <String, Object?>{
            'optionCode': option.optionCode,
            'optionText': option.optionText,
          },
        )
        .toList(growable: false),
    'groupId': q.groupId,
    'positionInGroup': q.positionInGroup,
    'audioUrl': q.audioUrl,
    'imageUrl': q.imageUrl,
    'imageDescription': q.imageDescription,
    'transcript': q.transcript,
    // This field belongs only in tester-side reference exports.
    'correctOption': seed.correctOption,
    'explanation': seed.explanation,
  };
}

Map<String, Object?> groupToJson(TestAttemptGroup group) => <String, Object?>{
  'groupId': group.groupId,
  'part': group.part,
  'orderNo': group.orderNo,
  'type': group.type,
  'instruction': group.instruction,
  'audioUrl': group.audioUrl,
  'transcript': group.transcript,
  'passageText': group.passageText,
  'assets': group.assets
      .map(
        (asset) => <String, Object?>{
          'assetId': asset.assetId,
          'kind': asset.kind,
          'orderNo': asset.orderNo,
          'content': asset.content,
          'publicUrl': asset.publicUrl,
        },
      )
      .toList(growable: false),
};

Future<void> writeJson(Directory output, String name, Object? value) async {
  final file = File('${output.path}${Platform.pathSeparator}$name');
  await file.parent.create(recursive: true);
  const encoder = JsonEncoder.withIndent('  ');
  await file.writeAsString('${encoder.convert(value)}\n');
}

Future<void> main(List<String> args) async {
  final outputPath = args.isEmpty ? 'test_data/offline_export' : args.first;
  final output = Directory(outputPath);
  await output.create(recursive: true);

  final bank = MockTestTakingMockData.buildBank();
  await writeJson(
    output,
    'question_bank_full_TESTER_ONLY.json',
    <String, Object?>{
      'source': 'MockTestTakingMockData.buildBank()',
      'classification': 'TESTER_ONLY_DO_NOT_BUNDLE_IN_APPLICATION',
      'totalQuestions': bank.questions.length,
      'questions': bank.questions.map(questionToJson).toList(growable: false),
      'groups': bank.groups.map(groupToJson).toList(growable: false),
    },
  );

  await writeJson(output, 'test_catalog.json', <String, Object?>{
    'tests': MockTestMockData.tests
        .map(
          (test) => <String, Object?>{
            'testId': test.testId,
            'title': test.title,
            'durationSeconds': test.durationSeconds,
            'createdAt': test.createdAt.toIso8601String(),
            'totalQuestions': test.totalQuestions,
          },
        )
        .toList(growable: false),
    'parts': MockTestMockData.parts
        .map(
          (part) => <String, Object?>{
            'part': part.part,
            'title': part.title,
            'totalQuestions': part.totalQuestions,
            'groupCount': part.groupCount,
            'available': part.available,
            'errors': part.errors,
          },
        )
        .toList(growable: false),
  });

  await writeJson(output, 'score_reference.json', <String, Object?>{
    'version': MockTestScoreReference.version,
    'official': MockTestScoreReference.official,
    'disclaimer': MockTestScoreReference.disclaimer,
    'sourceNote': MockTestScoreReference.sourceNote,
    'listening': MockTestScoreReference.listening,
    'reading': MockTestScoreReference.reading,
  });

  stdout.writeln(
    'Exported ${bank.questions.length} questions and ${bank.groups.length} groups to ${output.path}',
  );
}
