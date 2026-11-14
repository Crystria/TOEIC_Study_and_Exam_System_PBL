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

  test('Home Screen and Provider depend only on Dashboard contracts', () async {
    final screen = await readProjectFile(
      'lib/features/home/screens/home_screen.dart',
    );
    final provider = await readProjectFile(
      'lib/features/home/providers/home_provider.dart',
    );
    final repository = await readProjectFile(
      'lib/features/home/repositories/analytics_home_repository.dart',
    );

    expect(provider, contains('required HomeRepository repository'));
    expect(provider, isNot(contains('AnalyticsRepository')));
    expect(provider, isNot(contains('LearningRepository')));
    expect(screen, isNot(contains('AnalyticsRepository')));
    expect(screen, isNot(contains('LearningRepository')));
    expect(screen, isNot(contains('isDemoData')));
    expect(screen, isNot(contains('usesBackend')));
    expect(
      repository,
      contains('required AnalyticsRepository analyticsRepository'),
    );
    expect(
      repository,
      contains('required LearningRepository learningRepository'),
    );
    expect(repository, contains('isIllustrative: progress.isIllustrative'));
    expect(screen, contains('DataSourceNotice('));
  });

  test(
    'Profile and Settings screens do not access storage or environment flags',
    () async {
      final profile = await readProjectFile(
        'lib/features/profile/screens/profile_screen.dart',
      );
      final editProfile = await readProjectFile(
        'lib/features/profile/screens/edit_profile_screen.dart',
      );
      final settings = await readProjectFile(
        'lib/features/profile/screens/settings_screen.dart',
      );

      for (final source in [profile, editProfile, settings]) {
        expect(source, isNot(contains('VocabularyProgressStorage')));
        expect(source, isNot(contains('SharedPreferences')));
        expect(source, isNot(contains('AppConfig')));
        expect(source, isNot(contains('isAuthApiEnabled')));
        expect(source, isNot(contains('usesBackend')));
        expect(source, isNot(contains('isDemoData')));
      }
      expect(settings, contains('VocabularyTopicsProvider'));
      expect(settings, isNot(contains('saveReminderEnabled(')));
    },
  );

  test(
    'Analytics Provider does not expose implementation selection flags',
    () async {
      final provider = await readProjectFile(
        'lib/features/analytics/providers/analytics_provider.dart',
      );
      expect(provider, isNot(contains('isDemoData')));
      expect(provider, isNot(contains('usesBackend')));
      expect(provider, isNot(contains('AnalyticsApiService')));
      expect(provider, isNot(contains('AnalyticsTestDataSource')));
    },
  );
}
