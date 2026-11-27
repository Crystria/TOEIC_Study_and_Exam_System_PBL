import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/storage/token_storage.dart';
import 'package:toeic_mobile/features/auth/data_sources/local/secure_auth_local_data_source.dart';
import 'package:toeic_mobile/features/auth/data_sources/test_data/test_data_auth_data_source.dart';
import 'package:toeic_mobile/features/auth/repositories/test_data_auth_repository.dart';

void main() {
  group('Auth Test Data repository', () {
    test(
      'registers, verifies email, and authenticates through Test Data',
      () async {
        final repository = TestDataAuthRepository(
          dataSource: TestDataAuthDataSource(),
        );

        final registration = await repository.register(
          fullName: 'TOEIC Learner',
          email: 'learner@example.test',
          password: 'StrongPass1',
          confirmPassword: 'StrongPass1',
        );

        expect(registration.user.email, 'learner@example.test');
        expect(registration.emailVerificationTicket.isSimulated, isTrue);

        await repository.verifyEmail(
          token: registration.emailVerificationTicket.token!,
        );
        final user = await repository.login(
          identifier: 'learner@example.test',
          password: 'StrongPass1',
        );

        expect(user.id, registration.user.id);
        expect(user.emailVerified, isTrue);
      },
    );

    test('keeps password reset tickets inside the Test Data source', () async {
      final repository = TestDataAuthRepository();
      final registration = await repository.register(
        fullName: 'Reset Learner',
        email: 'reset@example.test',
        password: 'StrongPass1',
        confirmPassword: 'StrongPass1',
      );
      await repository.verifyEmail(
        token: registration.emailVerificationTicket.token!,
      );

      final ticket = await repository.requestPasswordReset(
        email: 'reset@example.test',
      );
      expect(ticket.isSimulated, isTrue);
      await repository.resetPassword(
        token: ticket.token!,
        newPassword: 'ChangedPass2',
      );
      final user = await repository.login(
        identifier: 'reset@example.test',
        password: 'ChangedPass2',
      );
      expect(user.id, registration.user.id);
    });
  });

  group('SecureAuthLocalDataSource', () {
    test('stores and compare-and-set rotates the token pair', () async {
      final storage = TokenStorage(secureStore: _MemorySecureKeyValueStore());
      final localDataSource = SecureAuthLocalDataSource(tokenStorage: storage);

      await localDataSource.saveTokens(
        accessToken: 'access-old',
        refreshToken: 'refresh-old',
      );
      final replaced = await localDataSource.replaceTokensIfRefreshTokenMatches(
        expectedRefreshToken: 'refresh-old',
        accessToken: 'access-new',
        refreshToken: 'refresh-new',
      );

      expect(replaced, isTrue);
      expect((await localDataSource.readTokens())?.accessToken, 'access-new');

      final staleWrite = await localDataSource
          .replaceTokensIfRefreshTokenMatches(
            expectedRefreshToken: 'refresh-old',
            accessToken: 'stale-access',
            refreshToken: 'stale-refresh',
          );
      expect(staleWrite, isFalse);
      expect((await localDataSource.readTokens())?.accessToken, 'access-new');
    });

    test('does not clear a token pair that belongs to a newer login', () async {
      final localDataSource = SecureAuthLocalDataSource(
        tokenStorage: TokenStorage(secureStore: _MemorySecureKeyValueStore()),
      );
      await localDataSource.saveTokens(
        accessToken: 'user-b-access',
        refreshToken: 'user-b-refresh',
      );

      final cleared = await localDataSource.clearTokensIfAccessTokenMatches(
        'user-a-access',
      );

      expect(cleared, isFalse);
      expect(
        (await localDataSource.readTokens())?.accessToken,
        'user-b-access',
      );
    });
  });
}

class _MemorySecureKeyValueStore implements SecureKeyValueStore {
  final Map<String, String> _values = <String, String>{};

  @override
  Future<String?> read({required String key}) async => _values[key];

  @override
  Future<void> write({required String key, required String value}) async {
    _values[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    _values.remove(key);
  }
}
