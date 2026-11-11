import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/config/app_config.dart';
import 'package:toeic_mobile/core/network/api_client.dart';
import 'package:toeic_mobile/core/storage/token_storage.dart';
import 'package:toeic_mobile/features/auth/repositories/api_auth_repository.dart';
import 'package:toeic_mobile/features/auth/services/auth_api_service.dart';
import 'package:toeic_mobile/features/auth/services/device_id_provider.dart';

void main() {
  group('ApiAuthRepository shared refresh coordinator', () {
    late TokenStorage tokenStorage;
    late _ControlledHttpClientAdapter adapter;
    late ApiClient apiClient;
    late ApiAuthRepository repository;

    setUp(() {
      tokenStorage = TokenStorage(secureStore: _MemorySecureKeyValueStore());
      adapter = _ControlledHttpClientAdapter();
      apiClient = ApiClient(
        config: AppConfig(
          environment: AppEnvironment.development,
          baseUrl: 'https://api.example.test/api/v1',
          apiEnabled: false,
          authApiEnabled: true,
          learningApiEnabled: false,
          mockTestApiEnabled: false,
          analyticsApiEnabled: false,
        ),
        tokenStorage: tokenStorage,
        adapter: adapter,
      );
      repository = ApiAuthRepository(
        apiService: AuthApiService(client: apiClient),
        tokenStorage: tokenStorage,
        deviceIdProvider: _FakeDeviceIdProvider(),
      );
    });

    tearDown(() => apiClient.close(force: true));

    test(
      'coalesces concurrent 401 refreshes into one rotating request',
      () async {
        await _saveOldTokenPair(tokenStorage);
        final releaseRefresh = Completer<void>();
        var refreshCallCount = 0;
        adapter.responseFactory = (options) async {
          refreshCallCount++;
          expect(options.path, 'auth/refresh');
          expect(options.extra[ApiClient.skipAuthExtraKey], isTrue);
          await releaseRefresh.future;
          return _tokenResponse('new-access', 'new-refresh');
        };

        final first = repository.refreshAfterUnauthorized('old-access');
        final second = repository.refreshAfterUnauthorized('old-access');
        await Future<void>.delayed(Duration.zero);
        releaseRefresh.complete();

        final results = await Future.wait<String?>(<Future<String?>>[
          first,
          second,
        ]);
        final stored = await tokenStorage.readTokens();

        expect(results, <String?>['new-access', 'new-access']);
        expect(refreshCallCount, 1);
        expect(stored?.accessToken, 'new-access');
        expect(stored?.refreshToken, 'new-refresh');
      },
    );

    test('does not replay an old request after an account switch', () async {
      await tokenStorage.saveTokens(
        accessToken: 'new-user-access',
        refreshToken: 'new-user-refresh',
      );

      final mayRetry = await repository.refreshAfterUnauthorized('old-access');

      expect(mayRetry, isNull);
      expect(adapter.requestCount, 0);
      expect((await tokenStorage.readTokens())?.accessToken, 'new-user-access');
    });

    test(
      'does not overwrite a session changed while refresh is in flight',
      () async {
        await _saveOldTokenPair(tokenStorage);
        final refreshStarted = Completer<void>();
        final releaseRefresh = Completer<void>();
        adapter.responseFactory = (_) async {
          refreshStarted.complete();
          await releaseRefresh.future;
          return _tokenResponse('old-user-new-access', 'old-user-new-refresh');
        };

        final pending = repository.refreshAfterUnauthorized('old-access');
        await refreshStarted.future;
        await tokenStorage.saveTokens(
          accessToken: 'new-user-access',
          refreshToken: 'new-user-refresh',
        );
        releaseRefresh.complete();

        expect(await pending, isNull);
        final stored = await tokenStorage.readTokens();
        expect(stored?.accessToken, 'new-user-access');
        expect(stored?.refreshToken, 'new-user-refresh');
      },
    );

    test(
      'session restore cannot clear credentials from a newer login',
      () async {
        await tokenStorage.saveTokens(
          accessToken: 'restore-user-access',
          refreshToken: 'restore-user-refresh',
        );
        final requestStarted = Completer<void>();
        final releaseRequest = Completer<void>();
        adapter.responseFactory = (_) async {
          requestStarted.complete();
          await releaseRequest.future;
          return _unauthorizedResponse();
        };

        final pendingRestore = repository.restoreSession();
        await requestStarted.future;
        await tokenStorage.saveTokens(
          accessToken: 'new-user-access',
          refreshToken: 'new-user-refresh',
        );
        releaseRequest.complete();

        expect(await pendingRestore, isNull);
        final stored = await tokenStorage.readTokens();
        expect(stored?.accessToken, 'new-user-access');
        expect(stored?.refreshToken, 'new-user-refresh');
      },
    );

    test('logout cannot clear credentials from a newer login', () async {
      var loginCount = 0;
      final logoutStarted = Completer<void>();
      final releaseLogout = Completer<void>();
      adapter.responseFactory = (options) async {
        if (options.path == 'auth/login') {
          loginCount++;
          return loginCount == 1
              ? _tokenResponse('user-a-access', 'user-a-refresh')
              : _tokenResponse(
                  'user-b-access',
                  'user-b-refresh',
                  userId: 'e9ce7ac7-4cd2-4e56-a9d9-4fcd9cdebc21',
                );
        }
        if (options.path == 'auth/logout') {
          logoutStarted.complete();
          await releaseLogout.future;
          return ResponseBody.fromString(
            jsonEncode(<String, Object?>{'success': true}),
            200,
            headers: <String, List<String>>{
              Headers.contentTypeHeader: <String>[Headers.jsonContentType],
            },
          );
        }
        throw StateError('Unexpected request path: ${options.path}');
      };

      await repository.login(
        identifier: 'qa-user@example.test',
        password: 'qa-password',
      );
      final pendingLogout = repository.logout();
      await logoutStarted.future;

      await repository.login(
        identifier: 'qa-user@example.test',
        password: 'qa-password',
      );
      releaseLogout.complete();

      expect(await pendingLogout, isTrue);
      final stored = await tokenStorage.readTokens();
      expect(stored?.accessToken, 'user-b-access');
      expect(stored?.refreshToken, 'user-b-refresh');
    });

    test(
      'invalidates the matching UI session when refresh is rejected',
      () async {
        adapter.responseFactory = (options) async {
          if (options.path == 'auth/login') {
            return _tokenResponse('old-access', 'old-refresh');
          }
          return _unauthorizedResponse();
        };

        await repository.login(
          identifier: 'qa-user@example.test',
          password: 'qa-password',
        );
        final invalidatedUsers = <String>[];
        repository.setSessionInvalidationHandler((userId) async {
          invalidatedUsers.add(userId);
        });

        final mayRetry = await repository.refreshAfterUnauthorized(
          'old-access',
        );

        expect(mayRetry, isNull);
        expect(await tokenStorage.readTokens(), isNull);
        expect(invalidatedUsers, <String>[
          'f06b8d1a-3e86-4a99-ae66-8e2ac9c35201',
        ]);
      },
    );

    test(
      'clears only the access token rejected after the single retry',
      () async {
        adapter.responseFactory = (_) async =>
            _tokenResponse('old-access', 'old-refresh');
        await repository.login(
          identifier: 'qa-user@example.test',
          password: 'qa-password',
        );
        final invalidatedUsers = <String>[];
        repository.setSessionInvalidationHandler((userId) async {
          invalidatedUsers.add(userId);
        });

        await repository.clearRejectedSessionIfCurrent('different-access');
        expect((await tokenStorage.readTokens())?.accessToken, 'old-access');
        expect(invalidatedUsers, isEmpty);

        await repository.clearRejectedSessionIfCurrent('old-access');
        expect(await tokenStorage.readTokens(), isNull);
        expect(invalidatedUsers, <String>[
          'f06b8d1a-3e86-4a99-ae66-8e2ac9c35201',
        ]);
      },
    );

    test(
      'returns null and clears a rejected token without refresh credential',
      () async {
        await tokenStorage.saveTokens(accessToken: 'access-without-refresh');

        final mayRetry = await repository.refreshAfterUnauthorized(
          'access-without-refresh',
        );

        expect(mayRetry, isNull);
        expect(adapter.requestCount, 0);
        expect(await tokenStorage.readTokens(), isNull);
      },
    );
  });
}

Future<void> _saveOldTokenPair(TokenStorage tokenStorage) {
  final now = DateTime.now().toUtc();
  return tokenStorage.saveTokens(
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    accessTokenExpiresAt: now.add(const Duration(minutes: 1)),
    refreshTokenExpiresAt: now.add(const Duration(days: 1)),
  );
}

ResponseBody _tokenResponse(
  String accessToken,
  String refreshToken, {
  String userId = 'f06b8d1a-3e86-4a99-ae66-8e2ac9c35201',
}) {
  final now = DateTime.now().toUtc().toIso8601String();
  return ResponseBody.fromString(
    jsonEncode(<String, Object?>{
      'user': <String, Object?>{
        'userId': userId,
        'email': 'qa-user@example.test',
        'fullName': 'QA User',
        'status': 'ACTIVE',
        'roles': <String>['USER'],
        'createdAt': now,
        'updatedAt': now,
      },
      'accessToken': accessToken,
      'tokenType': 'Bearer',
      'expiresIn': 900,
      'refreshToken': refreshToken,
      'refreshExpiresIn': 604800,
    }),
    200,
    headers: <String, List<String>>{
      Headers.contentTypeHeader: <String>[Headers.jsonContentType],
    },
  );
}

ResponseBody _unauthorizedResponse() {
  return ResponseBody.fromString(
    jsonEncode(<String, Object?>{
      'statusCode': 401,
      'message': 'Refresh token is invalid',
    }),
    401,
    headers: <String, List<String>>{
      Headers.contentTypeHeader: <String>[Headers.jsonContentType],
    },
  );
}

class _FakeDeviceIdProvider implements DeviceIdProvider {
  @override
  Future<String> getOrCreate() async => 'device-id-test';
}

class _ControlledHttpClientAdapter implements HttpClientAdapter {
  Future<ResponseBody> Function(RequestOptions options)? responseFactory;
  int requestCount = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    requestCount++;
    final factory = responseFactory;
    if (factory == null) {
      throw StateError('No fake response configured for ${options.path}.');
    }
    return factory(options);
  }

  @override
  void close({bool force = false}) {}
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
