import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Production feature graph contains API implementations only', () async {
    final production = await File(
      'lib/core/di/production_feature_dependencies.dart',
    ).readAsString();

    expect(production, contains('ApiLearningRepository'));
    expect(production, contains('ApiLearningSessionRepository'));
    expect(production, isNot(contains('test_data/')));
    expect(production, isNot(contains('TestData')));
    expect(production, isNot(contains('LearningTestDataSource')));
  });

  test(
    'Development Test Data graph is guarded from non-development builds',
    () async {
      final dependencies = await File(
        'lib/core/di/app_feature_dependencies.dart',
      ).readAsString();
      final entryPoint = await File('lib/main.dart').readAsString();
      final releaseEntryPoint = await File('lib/main_release.dart')
          .readAsString();

      expect(dependencies, contains('!config.isLearningApiEnabled &&'));
      expect(dependencies, contains('!config.isDevelopment || kReleaseMode'));
      expect(dependencies, contains('UnavailableLearningSessionRepository'));
      expect(entryPoint, contains('if (kReleaseMode)'));
      expect(entryPoint, contains('ProductionFeatureDependencies.create'));
      expect(
        releaseEntryPoint,
        contains('ProductionFeatureDependencies.create'),
      );
      expect(releaseEntryPoint, isNot(contains('AppFeatureDependencies')));
    },
  );

  test(
    'Learning Test Data is retained only as an explicit development adapter',
    () async {
      final dependencies = await File(
        'lib/core/di/app_feature_dependencies.dart',
      ).readAsString();
      final production = await File(
        'lib/core/di/production_feature_dependencies.dart',
      ).readAsString();

      expect(dependencies, contains('TestDataLearningRepository('));
      expect(dependencies, contains('LearningTestDataSource()'));
      expect(production, isNot(contains('TestDataLearningRepository')));
      expect(production, isNot(contains('LearningTestDataSource')));
    },
  );
}
