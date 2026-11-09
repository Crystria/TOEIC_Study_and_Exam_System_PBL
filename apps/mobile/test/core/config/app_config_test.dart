import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/config/app_config.dart';

void main() {
  group('AppEnvironment', () {
    test('parses supported environment names', () {
      expect(AppEnvironment.parse('development'), AppEnvironment.development);
      expect(AppEnvironment.parse('STAGING'), AppEnvironment.staging);
      expect(AppEnvironment.parse('prod'), AppEnvironment.production);
    });

    test('rejects an unsupported environment name', () {
      expect(() => AppEnvironment.parse('qa'), throwsFormatException);
    });
  });

  group('AppConfig', () {
    test(
      'keeps API mode disabled when configured for local/mock operation',
      () {
        final config = AppConfig(
          environment: AppEnvironment.development,
          baseUrl: '',
        );

        expect(config.apiEnabled, isFalse);
        expect(config.baseUrl, isEmpty);
        expect(config.baseUri, isNull);
        expect(config.connectTimeout, const Duration(seconds: 15));
        expect(config.sendTimeout, const Duration(seconds: 20));
        expect(config.receiveTimeout, const Duration(seconds: 20));
      },
    );

    test('normalizes a configured API base URL', () {
      final config = AppConfig(
        environment: AppEnvironment.development,
        baseUrl: ' http://10.0.2.2:3000/api/v1/ ',
        apiEnabled: true,
      );

      expect(config.baseUrl, 'http://10.0.2.2:3000/api/v1');
      expect(config.baseUri, Uri.parse('http://10.0.2.2:3000/api/v1'));
    });

    test('requires a base URL when API mode is enabled', () {
      expect(
        () => AppConfig(
          environment: AppEnvironment.development,
          baseUrl: '',
          apiEnabled: true,
        ),
        throwsArgumentError,
      );
    });

    test('requires HTTPS for production API mode', () {
      expect(
        () => AppConfig(
          environment: AppEnvironment.production,
          baseUrl: 'http://api.example.com/api/v1',
          apiEnabled: true,
        ),
        throwsArgumentError,
      );
    });

    test('rejects a base URL containing a query or fragment', () {
      expect(
        () => AppConfig(
          environment: AppEnvironment.development,
          baseUrl: 'https://api.example.com/api/v1?token=abc',
        ),
        throwsArgumentError,
      );
      expect(
        () => AppConfig(
          environment: AppEnvironment.development,
          baseUrl: 'https://api.example.com/api/v1#section',
        ),
        throwsArgumentError,
      );
    });

    test('rejects non-positive timeout values', () {
      expect(
        () => AppConfig(
          environment: AppEnvironment.development,
          baseUrl: '',
          connectTimeout: Duration.zero,
        ),
        throwsArgumentError,
      );
    });
  });
}
