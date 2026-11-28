import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  Future<String> readProjectFile(String path) async {
    final direct = File(path);
    if (await direct.exists()) return direct.readAsString();
    final mobileRoot = File('apps/mobile/$path');
    if (await mobileRoot.exists()) return mobileRoot.readAsString();
    throw FileSystemException('Project file was not found.', path);
  }

  test(
    'Analytics Provider and Screen do not depend on data-source details',
    () async {
      final provider = await readProjectFile(
        'lib/features/analytics/providers/analytics_provider.dart',
      );
      final screen = await readProjectFile(
        'lib/features/analytics/screens/analytics_screen.dart',
      );

      expect(provider, contains('required AnalyticsRepository repository'));
      expect(provider, isNot(contains('AnalyticsApiService')));
      expect(provider, isNot(contains('AnalyticsTestDataSource')));
      expect(provider, isNot(contains('isIllustrative')));
      expect(provider, isNot(contains('_repository.isDemoData')));
      expect(provider, isNot(contains('data_sources/')));
      expect(screen, isNot(contains('AnalyticsApiService')));
      expect(screen, isNot(contains('AnalyticsTestDataSource')));
      expect(screen, isNot(contains('data_sources/')));
    },
  );

  test(
    'Analytics Repository does not import transport or fixture classes',
    () async {
      final repository = await readProjectFile(
        'lib/features/analytics/repositories/analytics_repository.dart',
      );

      expect(
        repository,
        contains("../data_sources/analytics_data_source.dart"),
      );
      expect(repository, isNot(contains('AnalyticsApiService')));
      expect(repository, isNot(contains('AnalyticsTestDataSource')));
      expect(repository, isNot(contains('bool get isDemoData')));
      expect(repository, isNot(contains('dio/')));
    },
  );

  test('API and Test Data implementations remain isolated', () async {
    final api = await readProjectFile(
      'lib/features/analytics/data_sources/remote/api_analytics_data_source.dart',
    );
    final testData = await readProjectFile(
      'lib/features/analytics/data_sources/test_data/analytics_test_data_source.dart',
    );

    expect(api, contains('AnalyticsApiService'));
    expect(api, isNot(contains('AnalyticsTestDataSource')));
    expect(testData, isNot(contains('AnalyticsApiService')));
    expect(testData, isNot(contains('ApiClient')));
  });
}
