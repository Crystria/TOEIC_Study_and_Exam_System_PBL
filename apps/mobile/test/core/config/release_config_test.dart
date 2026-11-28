import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/config/app_config.dart';

void main() {
  group('AppConfig.validateForRelease', () {
    AppConfig validReleaseConfig({
      AppEnvironment environment = AppEnvironment.production,
      bool auth = true,
      bool learning = true,
      bool mockTest = true,
      bool analytics = true,
      String baseUrl = 'https://api.example.test/api/v1',
    }) => AppConfig(
      environment: environment,
      baseUrl: baseUrl,
      apiEnabled: false,
      authApiEnabled: auth,
      learningApiEnabled: learning,
      mockTestApiEnabled: mockTest,
      analyticsApiEnabled: analytics,
    );

    test('accepts production HTTPS with every API feature enabled', () {
      expect(validReleaseConfig().validateForRelease, returnsNormally);
    });

    test('rejects Development or Staging configuration', () {
      expect(
        validReleaseConfig(environment: AppEnvironment.development)
            .validateForRelease,
        throwsStateError,
      );
      expect(
        validReleaseConfig(environment: AppEnvironment.staging)
            .validateForRelease,
        throwsStateError,
      );
    });

    test('rejects any feature configured to use Test Data', () {
      expect(
        validReleaseConfig(
          auth: false,
          learning: false,
          mockTest: false,
          analytics: false,
        ).validateForRelease,
        throwsStateError,
      );
      expect(
        validReleaseConfig(learning: false).validateForRelease,
        throwsStateError,
      );
      expect(
        validReleaseConfig(mockTest: false).validateForRelease,
        throwsStateError,
      );
      expect(
        validReleaseConfig(analytics: false).validateForRelease,
        throwsStateError,
      );
    });

    test('rejects a non-HTTPS Production API URL during config creation', () {
      expect(
        () => AppConfig(
          environment: AppEnvironment.production,
          baseUrl: 'http://api.example.test/api/v1',
          apiEnabled: true,
        ),
        throwsArgumentError,
      );
    });
  });
}
