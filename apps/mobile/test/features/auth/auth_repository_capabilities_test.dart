import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/auth/providers/forgot_password_provider.dart';
import 'package:toeic_mobile/features/auth/providers/login_provider.dart';
import 'package:toeic_mobile/features/auth/repositories/test_data_auth_repository.dart';

void main() {
  test('Auth Providers expose capabilities from the injected Repository', () {
    final repository = TestDataAuthRepository();
    final loginProvider = LoginProvider(repository: repository);
    final forgotPasswordProvider = ForgotPasswordProvider(
      repository: repository,
    );
    addTearDown(loginProvider.dispose);
    addTearDown(forgotPasswordProvider.dispose);

    expect(loginProvider.supportsUsernameLogin, isTrue);
    expect(forgotPasswordProvider.supportsPasswordReset, isTrue);
  });

  test('API Auth declares email-only login and unsupported password reset', () {
    final source = File(
      'lib/features/auth/repositories/api_auth_repository.dart',
    ).readAsStringSync();

    expect(source, contains('bool get supportsUsernameLogin => false;'));
    expect(source, contains('bool get supportsPasswordReset => false;'));
  });
}
