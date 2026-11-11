import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/config/app_config.dart';
import 'package:toeic_mobile/core/errors/app_exception.dart';
import 'package:toeic_mobile/core/network/api_client.dart';
import 'package:toeic_mobile/core/network/endpoints.dart';
import 'package:toeic_mobile/core/storage/token_storage.dart';

void main() {
  group('ApiClient', () {
    late _MemorySecureKeyValueStore secureStore;
    late TokenStorage tokenStorage;
    late _FakeHttpClientAdapter adapter;
    late ApiClient client;

    setUp(() {
      secureStore = _MemorySecureKeyValueStore();
      tokenStorage = TokenStorage(secureStore: secureStore);
      adapter = _FakeHttpClientAdapter(
        (_) async => _jsonResponse(<String, Object?>{'ok': true}),
      );
      client = ApiClient(
        config: _testConfig(),
        tokenStorage: tokenStorage,
        adapter: adapter,
      );
    });

    tearDown(() {
      client.close(force: true);
    });

    test(
      'appends a relative endpoint below the configured API prefix',
      () async {
        await client.get<Object?>(
          Endpoints.learning.listVocabularyTopics,
          queryParameters: <String, dynamic>{'page': 2, 'size': 10},
        );

        expect(
          adapter.lastRequest?.uri.toString(),
          'https://api.example.test/api/v1/learning/vocabulary-topics'
          '?page=2&size=10',
        );
      },
    );

    test('sets JSON accept and content-type headers', () async {
      await client.get<Object?>(Endpoints.auth.getCurrentUser);

      expect(
        adapter.lastRequest?.headers[Headers.acceptHeader],
        Headers.jsonContentType,
      );
      expect(
        adapter.lastRequest?.headers[Headers.contentTypeHeader],
        Headers.jsonContentType,
      );
    });

    test('adds the stored access token as a Bearer header', () async {
      await tokenStorage.saveTokens(accessToken: 'access-token-123');

      await client.get<Object?>(Endpoints.auth.getCurrentUser);

      expect(
        _authorizationHeader(adapter.lastRequest?.headers),
        'Bearer access-token-123',
      );
    });

    test('does not add an Authorization header when no token exists', () async {
      await client.get<Object?>(Endpoints.auth.getCurrentUser);

      expect(_authorizationHeader(adapter.lastRequest?.headers), isNull);
    });

    test(
      'skip-auth removes an explicitly supplied Authorization header',
      () async {
        await tokenStorage.saveTokens(accessToken: 'stored-access-token');

        await client.get<Object?>(
          Endpoints.auth.login,
          options: Options(
            headers: <String, Object>{'Authorization': 'Bearer manual-token'},
            extra: <String, Object>{ApiClient.skipAuthExtraKey: true},
          ),
        );

        expect(_authorizationHeader(adapter.lastRequest?.headers), isNull);
      },
    );

    test(
      'supports POST and passes its method and payload to the adapter',
      () async {
        await client.post<Object?>(
          Endpoints.auth.login,
          data: <String, Object>{'email': 'student@example.test'},
          options: Options(
            extra: <String, Object>{ApiClient.skipAuthExtraKey: true},
          ),
        );

        expect(adapter.lastRequest?.method, 'POST');
        expect(adapter.lastRequest?.path, 'auth/login');
      },
    );

    test('does not send requests while API mode is disabled', () async {
      final disabledAdapter = _FakeHttpClientAdapter(
        (_) async => _jsonResponse(<String, Object?>{'ok': true}),
      );
      final disabledClient = ApiClient(
        config: AppConfig(
          environment: AppEnvironment.development,
          baseUrl: '',
          apiEnabled: false,
        ),
        tokenStorage: tokenStorage,
        adapter: disabledAdapter,
      );
      addTearDown(() => disabledClient.close(force: true));

      await expectLater(
        disabledClient.get<Object?>(Endpoints.auth.getCurrentUser),
        throwsA(
          isA<AppException>()
              .having((error) => error.code, 'code', 'api_disabled')
              .having((error) => error.type, 'type', AppExceptionType.unknown),
        ),
      );
      expect(disabledAdapter.requestCount, 0);
    });

    test('refreshes a rejected access token and retries once', () async {
      await tokenStorage.saveTokens(
        accessToken: 'expired-access-token',
        refreshToken: 'refresh-token',
      );
      var refreshCalls = 0;
      adapter.responseFactory = (options) async {
        final authorization = _authorizationHeader(options.headers);
        if (authorization == 'Bearer expired-access-token') {
          return _jsonResponse(<String, Object?>{
            'code': 'TOKEN_EXPIRED',
          }, statusCode: 401);
        }
        return _jsonResponse(<String, Object?>{'ok': true});
      };
      client.setUnauthorizedRefreshHandler((failedAccessToken) async {
        refreshCalls++;
        expect(failedAccessToken, 'expired-access-token');
        await tokenStorage.saveTokens(
          accessToken: 'fresh-access-token',
          refreshToken: 'rotated-refresh-token',
        );
        return 'fresh-access-token';
      });

      final response = await client.get<Map<String, dynamic>>(
        Endpoints.analytics.progress,
      );

      expect(response.data?['ok'], isTrue);
      expect(adapter.requestCount, 2);
      expect(refreshCalls, 1);
      expect(
        _authorizationHeader(adapter.lastRequest?.headers),
        'Bearer fresh-access-token',
      );
    });

    test(
      'pins retry to the token returned by the refresh coordinator',
      () async {
        await tokenStorage.saveTokens(
          accessToken: 'expired-access-token',
          refreshToken: 'refresh-token',
        );
        adapter.responseFactory = (options) async {
          final authorization = _authorizationHeader(options.headers);
          if (authorization == 'Bearer expired-access-token') {
            return _jsonResponse(<String, Object?>{
              'code': 'TOKEN_EXPIRED',
            }, statusCode: 401);
          }
          return _jsonResponse(<String, Object?>{
            'authorization': authorization,
          });
        };
        client.setUnauthorizedRefreshHandler((_) async {
          await tokenStorage.saveTokens(
            accessToken: 'rotated-access-token',
            refreshToken: 'rotated-refresh-token',
          );
          // Simulate another account logging in between refresh completion and
          // the stale request retry. The retry must retain the rotated token.
          await tokenStorage.saveTokens(
            accessToken: 'different-user-access-token',
            refreshToken: 'different-user-refresh-token',
          );
          return 'rotated-access-token';
        });

        final response = await client.get<Map<String, dynamic>>(
          Endpoints.analytics.progress,
        );

        expect(response.data?['authorization'], 'Bearer rotated-access-token');
        expect(
          (await tokenStorage.readTokens())?.accessToken,
          'different-user-access-token',
        );
        expect(adapter.requestCount, 2);
      },
    );

    test('does not refresh public requests', () async {
      var refreshCalls = 0;
      adapter.responseFactory = (_) async => _jsonResponse(<String, Object?>{
        'message': 'Invalid credentials',
      }, statusCode: 401);
      client.setUnauthorizedRefreshHandler((_) async {
        refreshCalls++;
        return 'unused-fresh-token';
      });

      await expectLater(
        client.post<Object?>(
          Endpoints.auth.login,
          options: Options(
            extra: <String, dynamic>{ApiClient.skipAuthExtraKey: true},
          ),
        ),
        throwsA(
          isA<AppException>().having(
            (error) => error.isUnauthorized,
            'isUnauthorized',
            isTrue,
          ),
        ),
      );

      expect(refreshCalls, 0);
      expect(adapter.requestCount, 1);
    });

    test(
      'does not retry more than once after a refreshed request is rejected',
      () async {
        await tokenStorage.saveTokens(
          accessToken: 'old-access-token',
          refreshToken: 'refresh-token',
        );
        var refreshCalls = 0;
        var rejectedCalls = 0;
        adapter.responseFactory = (_) async => _jsonResponse(<String, Object?>{
          'message': 'Unauthorized',
        }, statusCode: 401);
        client.setUnauthorizedRefreshHandler(
          (_) async {
            refreshCalls++;
            await tokenStorage.saveTokens(
              accessToken: 'new-access-token',
              refreshToken: 'new-refresh-token',
            );
            return 'new-access-token';
          },
          onRetryRejected: (_) async {
            rejectedCalls++;
          },
        );

        await expectLater(
          client.get<Object?>(Endpoints.auth.getCurrentUser),
          throwsA(
            isA<AppException>().having(
              (error) => error.isUnauthorized,
              'isUnauthorized',
              isTrue,
            ),
          ),
        );
        expect(adapter.requestCount, 2);
        expect(refreshCalls, 1);
        expect(rejectedCalls, 1);
      },
    );

    test('does not auto-refresh a logout request', () async {
      await tokenStorage.saveTokens(
        accessToken: 'logout-access-token',
        refreshToken: 'logout-refresh-token',
      );
      var refreshCalls = 0;
      adapter.responseFactory = (_) async => _jsonResponse(<String, Object?>{
        'message': 'Unauthorized',
      }, statusCode: 401);
      client.setUnauthorizedRefreshHandler((_) async {
        refreshCalls++;
        return 'unused-fresh-token';
      });

      await expectLater(
        client.post<Object?>(
          Endpoints.auth.logout,
          data: <String, String>{'refreshToken': 'logout-refresh-token'},
          options: Options(
            extra: <String, dynamic>{ApiClient.skipAuthRefreshExtraKey: true},
          ),
        ),
        throwsA(
          isA<AppException>().having(
            (error) => error.isUnauthorized,
            'isUnauthorized',
            isTrue,
          ),
        ),
      );

      expect(refreshCalls, 0);
      expect(adapter.requestCount, 1);
    });

    test('maps HTTP 401 to unauthorized AppException', () async {
      adapter.responseFactory = (_) async => _jsonResponse(<String, Object?>{
        'message': 'Invalid credentials',
      }, statusCode: 401);

      await expectLater(
        client.get<Object?>(Endpoints.auth.getCurrentUser),
        throwsA(
          isA<AppException>()
              .having(
                (error) => error.type,
                'type',
                AppExceptionType.unauthorized,
              )
              .having((error) => error.statusCode, 'statusCode', 401),
        ),
      );
    });

    test('maps NestJS validation arrays to validation AppException', () async {
      adapter.responseFactory = (_) async => _jsonResponse(<String, Object?>{
        'statusCode': 400,
        'message': <String>['email must be an email', 'password is required'],
        'error': 'Bad Request',
      }, statusCode: 400);

      await expectLater(
        client.post<Object?>(Endpoints.auth.login),
        throwsA(
          isA<AppException>().having(
            (error) => error.type,
            'type',
            AppExceptionType.validation,
          ),
        ),
      );
    });

    test('maps Retry-After delta-seconds to AppException metadata', () async {
      adapter.responseFactory = (_) async => _jsonResponse(
        <String, Object?>{'message': 'Too many requests'},
        statusCode: 429,
        headers: <String, List<String>>{
          'retry-after': <String>['30'],
        },
      );

      await expectLater(
        client.get<Object?>(Endpoints.analytics.progress),
        throwsA(
          isA<AppException>()
              .having(
                (error) => error.type,
                'type',
                AppExceptionType.rateLimited,
              )
              .having(
                (error) => error.retryAfter,
                'retryAfter',
                const Duration(seconds: 30),
              ),
        ),
      );
    });

    test(
      'retains Gateway correlation id from error response headers',
      () async {
        adapter.responseFactory = (_) async => _jsonResponse(
          <String, Object?>{
            'code': 'ENTITY_REVISION_CONFLICT',
            'message': 'Dữ liệu đã thay đổi.',
          },
          statusCode: 409,
          headers: <String, List<String>>{
            'x-correlation-id': <String>['corr-test-409'],
          },
        );

        await expectLater(
          client.get<Object?>(Endpoints.learning.progress),
          throwsA(
            isA<AppException>().having(
              (error) => error.correlationId,
              'correlationId',
              'corr-test-409',
            ),
          ),
        );
      },
    );

    test('ignores unsafe Gateway correlation identifiers', () async {
      adapter.responseFactory = (_) async => _jsonResponse(
        <String, Object?>{'code': 'BAD_REQUEST'},
        statusCode: 400,
        headers: <String, List<String>>{
          'x-correlation-id': <String>['bad\r\nid'],
        },
      );

      await expectLater(
        client.get<Object?>(Endpoints.analytics.progress),
        throwsA(
          isA<AppException>().having(
            (error) => error.correlationId,
            'correlationId',
            isNull,
          ),
        ),
      );
    });

    test('does not expose Backend response details for HTTP 500', () async {
      adapter.responseFactory = (_) async => _jsonResponse(<String, Object?>{
        'message': 'database password leaked',
      }, statusCode: 500);

      await expectLater(
        client.get<Object?>(Endpoints.analytics.progress),
        throwsA(
          isA<AppException>()
              .having((error) => error.type, 'type', AppExceptionType.server)
              .having(
                (error) => error.message.contains('database password'),
                'does not expose raw server message',
                isFalse,
              ),
        ),
      );
    });

    test('maps connection errors to network AppException', () async {
      adapter.responseFactory = (options) async {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.connectionError,
          error: StateError('socket detail'),
        );
      };

      await expectLater(
        client.get<Object?>(Endpoints.auth.getCurrentUser),
        throwsA(
          isA<AppException>().having(
            (error) => error.type,
            'type',
            AppExceptionType.network,
          ),
        ),
      );
    });

    test('maps timeout errors to timeout AppException', () async {
      adapter.responseFactory = (options) async {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.receiveTimeout,
        );
      };

      await expectLater(
        client.get<Object?>(Endpoints.auth.getCurrentUser),
        throwsA(
          isA<AppException>().having(
            (error) => error.type,
            'type',
            AppExceptionType.timeout,
          ),
        ),
      );
    });

    test('maps cancelled requests to cancelled AppException', () async {
      adapter.responseFactory = (options) async {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.cancel,
        );
      };

      await expectLater(
        client.get<Object?>(Endpoints.auth.getCurrentUser),
        throwsA(
          isA<AppException>().having(
            (error) => error.type,
            'type',
            AppExceptionType.cancelled,
          ),
        ),
      );
    });

    test(
      'maps secure token read errors without exposing platform details',
      () async {
        secureStore.readError = StateError('private keystore detail');

        await expectLater(
          client.get<Object?>(Endpoints.auth.getCurrentUser),
          throwsA(
            isA<AppException>()
                .having((error) => error.code, 'code', 'token_storage_failure')
                .having(
                  (error) => error.message.contains('private keystore detail'),
                  'does not expose secure storage detail',
                  isFalse,
                ),
          ),
        );
        expect(adapter.requestCount, 0);
      },
    );

    test('rejects paths with a leading slash to preserve API prefix', () async {
      await expectLater(
        client.get<Object?>('/auth/login'),
        throwsA(isA<ArgumentError>()),
      );
      expect(adapter.requestCount, 0);
    });
  });
}

AppConfig _testConfig({bool apiEnabled = true}) {
  return AppConfig(
    environment: AppEnvironment.development,
    baseUrl: apiEnabled ? 'https://api.example.test/api/v1' : '',
    apiEnabled: apiEnabled,
  );
}

String? _authorizationHeader(Map<String, dynamic>? headers) {
  if (headers == null) {
    return null;
  }
  for (final entry in headers.entries) {
    if (entry.key.toLowerCase() == 'authorization') {
      return entry.value?.toString();
    }
  }
  return null;
}

ResponseBody _jsonResponse(
  Object? data, {
  int statusCode = 200,
  Map<String, List<String>>? headers,
}) {
  return ResponseBody.fromString(
    jsonEncode(data),
    statusCode,
    headers: <String, List<String>>{
      Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      ...?headers,
    },
  );
}

class _FakeHttpClientAdapter implements HttpClientAdapter {
  _FakeHttpClientAdapter(this.responseFactory);

  Future<ResponseBody> Function(RequestOptions options) responseFactory;

  RequestOptions? lastRequest;
  int requestCount = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    lastRequest = options;
    requestCount++;
    return responseFactory(options);
  }

  @override
  void close({bool force = false}) {}
}

class _MemorySecureKeyValueStore implements SecureKeyValueStore {
  final Map<String, String> values = <String, String>{};
  Object? readError;

  @override
  Future<String?> read({required String key}) async {
    if (readError != null) {
      throw readError!;
    }
    return values[key];
  }

  @override
  Future<void> write({required String key, required String value}) async {
    values[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    values.remove(key);
  }
}
