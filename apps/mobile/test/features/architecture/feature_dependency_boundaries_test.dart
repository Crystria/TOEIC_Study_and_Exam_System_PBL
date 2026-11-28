import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final featureRoot = Directory('lib/features');
  final importPattern = RegExp(
    r"""^\s*import\s+['"]([^'"]+)['"]""",
    multiLine: true,
  );

  test(
    'Screens do not import Repositories, Data Sources, Storage or AppConfig',
    () {
      final violations = <String>[];
      for (final file
          in featureRoot.listSync(recursive: true).whereType<File>()) {
        if (!file.path.contains(
              '${Platform.pathSeparator}screens${Platform.pathSeparator}',
            ) ||
            !file.path.endsWith('.dart')) {
          continue;
        }
        final source = file.readAsStringSync();
        for (final match in importPattern.allMatches(source)) {
          final uri = match.group(1)!;
          if (uri.contains('/repositories/') ||
              uri.contains('/data_sources/') ||
              uri.contains('/storage/') ||
              uri.contains('/test_data/') ||
              uri.contains('/mock_data/') ||
              uri.endsWith('/app_config.dart') ||
              uri == '../../../core/config/app_config.dart') {
            violations.add('${file.path} -> $uri');
          }
        }
      }
      expect(violations, isEmpty);
    },
  );

  test('Providers do not import Data Sources, Storage or source selection', () {
    final violations = <String>[];
    for (final file
        in featureRoot.listSync(recursive: true).whereType<File>()) {
      if (!file.path.contains(
            '${Platform.pathSeparator}providers${Platform.pathSeparator}',
          ) ||
          !file.path.endsWith('.dart')) {
        continue;
      }
      final source = file.readAsStringSync();
      for (final match in importPattern.allMatches(source)) {
        final uri = match.group(1)!;
        if (uri.contains('/data_sources/') ||
            uri.contains('/storage/') ||
            uri.contains('/test_data/') ||
            uri.contains('/mock_data/') ||
            uri.contains('/services/') ||
            uri.endsWith('/app_config.dart')) {
          violations.add('${file.path} -> $uri');
        }
      }
    }
    expect(violations, isEmpty);
  });

  test('Repositories do not import presentation screens or widgets', () {
    final violations = <String>[];
    for (final file
        in featureRoot.listSync(recursive: true).whereType<File>()) {
      if (!file.path.contains(
            '${Platform.pathSeparator}repositories${Platform.pathSeparator}',
          ) ||
          !file.path.endsWith('.dart')) {
        continue;
      }
      final source = file.readAsStringSync();
      for (final match in importPattern.allMatches(source)) {
        final uri = match.group(1)!;
        if (uri.contains('/screens/') || uri.contains('/widgets/')) {
          violations.add('${file.path} -> $uri');
        }
      }
    }
    expect(violations, isEmpty);
  });

  test('Composition Root owns Mock Test Provider construction', () {
    final bootstrap = File('lib/core/di/app_bootstrap.dart').readAsStringSync();
    for (final provider in [
      'MockTestSelectProvider',
      'SelectTestPartsProvider',
      'TestHistoryProvider',
      'TestHistoryDetailProvider',
      'MockTestTakingProvider',
    ]) {
      expect(bootstrap, contains('$provider('));
      expect(bootstrap, contains('ChangeNotifierProvider<$provider>.value'));
    }
    expect(bootstrap, isNot(contains('Provider<MockTestRepository>')));
    expect(bootstrap, isNot(contains('Provider<MockTestAttemptRepository>')));
  });

  test('obsolete dependency wrappers have been removed', () {
    expect(
      File('lib/features/auth/repositories/fake_auth_repository.dart')
          .existsSync(),
      isFalse,
    );
    expect(
      File('lib/features/mock_test/mock_test_dependencies.dart').existsSync(),
      isFalse,
    );
  });
}
