import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/storage/token_storage.dart';

void main() {
  group('TokenStorage', () {
    late _MemorySecureKeyValueStore secureStore;
    late TokenStorage tokenStorage;

    setUp(() {
      secureStore = _MemorySecureKeyValueStore();
      tokenStorage = TokenStorage(secureStore: secureStore);
    });

    test('saves token pair in one versioned secure record', () async {
      await tokenStorage.saveTokens(
        accessToken: ' access-123 ',
        refreshToken: ' refresh-456 ',
      );

      expect(secureStore.values, hasLength(1));
      final storedJson = jsonDecode(
        secureStore.values['toeic_mobile.auth.token_bundle.v1']!,
      ) as Map<String, dynamic>;
      expect(storedJson['schemaVersion'], 1);
      expect(storedJson['accessToken'], 'access-123');
      expect(storedJson['refreshToken'], 'refresh-456');
    });

    test('reads access and refresh tokens after saving', () async {
      await tokenStorage.saveTokens(
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      );

      expect(await tokenStorage.readAccessToken(), 'access-123');
      expect(await tokenStorage.readRefreshToken(), 'refresh-456');
      expect(await tokenStorage.hasAccessToken(), isTrue);
    });

    test('round-trips optional expiry timestamps as UTC', () async {
      final accessExpiry = DateTime.parse('2026-11-08T10:00:00+07:00');
      final refreshExpiry = DateTime.parse('2026-12-08T10:00:00+07:00');

      await tokenStorage.saveTokens(
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        accessTokenExpiresAt: accessExpiry,
        refreshTokenExpiresAt: refreshExpiry,
      );

      final tokens = await tokenStorage.readTokens();
      expect(tokens?.accessTokenExpiresAt, accessExpiry.toUtc());
      expect(tokens?.refreshTokenExpiresAt, refreshExpiry.toUtc());
      expect(tokens?.accessTokenExpiresAt?.isUtc, isTrue);
      expect(tokens?.refreshTokenExpiresAt?.isUtc, isTrue);
    });

    test('supports an access token without a refresh token', () async {
      await tokenStorage.saveTokens(accessToken: 'access-only');

      final tokens = await tokenStorage.readTokens();
      expect(tokens?.accessToken, 'access-only');
      expect(tokens?.refreshToken, isNull);
      expect(tokens?.hasRefreshToken, isFalse);
    });

    test('replacing the bundle does not retain an old refresh token', () async {
      await tokenStorage.saveTokens(
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
      );
      await tokenStorage.saveTokens(accessToken: 'new-access');

      final tokens = await tokenStorage.readTokens();
      expect(tokens?.accessToken, 'new-access');
      expect(tokens?.refreshToken, isNull);
    });

    test('returns null when no token record exists', () async {
      expect(await tokenStorage.readTokens(), isNull);
      expect(await tokenStorage.readAccessToken(), isNull);
      expect(await tokenStorage.readRefreshToken(), isNull);
      expect(await tokenStorage.hasAccessToken(), isFalse);
    });

    test('rejects an empty access token without writing', () async {
      await expectLater(
        tokenStorage.saveTokens(accessToken: '   '),
        throwsA(isA<ArgumentError>()),
      );
      expect(secureStore.values, isEmpty);
    });

    test('rejects refresh expiry when no refresh token is supplied', () async {
      await expectLater(
        tokenStorage.saveTokens(
          accessToken: 'access-123',
          refreshTokenExpiresAt: DateTime.utc(2026, 12, 1),
        ),
        throwsA(isA<ArgumentError>()),
      );
      expect(secureStore.values, isEmpty);
    });

    test('clearTokens deletes only the token bundle', () async {
      secureStore.values['unrelated.setting'] = 'keep-me';
      await tokenStorage.saveTokens(
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
      );

      await tokenStorage.clearTokens();

      expect(secureStore.values, {'unrelated.setting': 'keep-me'});
      expect(await tokenStorage.readTokens(), isNull);
    });

    test('throws a decode exception for malformed JSON', () async {
      secureStore.values['toeic_mobile.auth.token_bundle.v1'] = '{invalid';

      await expectLater(
        tokenStorage.readTokens(),
        throwsA(
          isA<TokenStorageException>().having(
            (error) => error.operation,
            'operation',
            TokenStorageOperation.decode,
          ),
        ),
      );
    });

    test('throws a decode exception for an unsupported schema', () async {
      secureStore.values['toeic_mobile.auth.token_bundle.v1'] = jsonEncode({
        'schemaVersion': 99,
        'accessToken': 'access-123',
      });

      await expectLater(
        tokenStorage.readTokens(),
        throwsA(isA<TokenStorageException>()),
      );
    });

    test('throws a decode exception when access token is missing', () async {
      secureStore.values['toeic_mobile.auth.token_bundle.v1'] = jsonEncode({
        'schemaVersion': 1,
        'refreshToken': 'refresh-456',
      });

      await expectLater(
        tokenStorage.readTokens(),
        throwsA(isA<TokenStorageException>()),
      );
    });

    test('wraps secure-store read failures', () async {
      secureStore.readError = StateError('private platform detail');

      await expectLater(
        tokenStorage.readTokens(),
        throwsA(
          isA<TokenStorageException>().having(
            (error) => error.operation,
            'operation',
            TokenStorageOperation.read,
          ),
        ),
      );
    });

    test('wraps secure-store write failures', () async {
      secureStore.writeError = StateError('private platform detail');

      await expectLater(
        tokenStorage.saveTokens(accessToken: 'access-123'),
        throwsA(
          isA<TokenStorageException>().having(
            (error) => error.operation,
            'operation',
            TokenStorageOperation.write,
          ),
        ),
      );
    });

    test('wraps secure-store delete failures', () async {
      secureStore.deleteError = StateError('private platform detail');

      await expectLater(
        tokenStorage.clearTokens(),
        throwsA(
          isA<TokenStorageException>().having(
            (error) => error.operation,
            'operation',
            TokenStorageOperation.delete,
          ),
        ),
      );
    });
  });
}

class _MemorySecureKeyValueStore implements SecureKeyValueStore {
  final Map<String, String> values = <String, String>{};

  Object? readError;
  Object? writeError;
  Object? deleteError;

  @override
  Future<String?> read({required String key}) async {
    if (readError != null) {
      throw readError!;
    }
    return values[key];
  }

  @override
  Future<void> write({required String key, required String value}) async {
    if (writeError != null) {
      throw writeError!;
    }
    values[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    if (deleteError != null) {
      throw deleteError!;
    }
    values.remove(key);
  }
}
