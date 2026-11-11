import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/config/app_config.dart';
import 'package:toeic_mobile/core/network/api_client.dart';
import 'package:toeic_mobile/core/storage/token_storage.dart';
import 'package:toeic_mobile/features/auth/models/avatar_api_dtos.dart';
import 'package:toeic_mobile/features/auth/repositories/api_auth_repository.dart';
import 'package:toeic_mobile/features/auth/repositories/auth_repository.dart';
import 'package:toeic_mobile/features/auth/services/auth_api_service.dart';
import 'package:toeic_mobile/features/auth/services/avatar_upload_transport.dart';
import 'package:toeic_mobile/features/auth/services/device_id_provider.dart';

void main() {
  group('ApiAuthRepository avatar upload', () {
    late _MemorySecureKeyValueStore secureStore;
    late TokenStorage tokenStorage;
    late _ApiAdapter apiAdapter;
    late ApiClient apiClient;
    late _RecordingAvatarTransport uploadTransport;
    late ApiAuthRepository repository;

    setUp(() async {
      secureStore = _MemorySecureKeyValueStore();
      tokenStorage = TokenStorage(secureStore: secureStore);
      await tokenStorage.saveTokens(
        accessToken: 'student-access-token',
        refreshToken: 'student-refresh-token',
      );
      apiAdapter = _ApiAdapter();
      apiClient = ApiClient(
        config: _apiConfig(),
        tokenStorage: tokenStorage,
        adapter: apiAdapter,
      );
      uploadTransport = _RecordingAvatarTransport();
      repository = ApiAuthRepository(
        apiService: AuthApiService(
          client: apiClient,
          avatarUploadTransport: uploadTransport,
        ),
        tokenStorage: tokenStorage,
        deviceIdProvider: _FakeDeviceIdProvider(),
      );
      final user = await repository.restoreSession();
      expect(user?.id, _userId);
    });

    tearDown(() => apiClient.close(force: true));

    test(
      'runs presign, raw PUT, confirm, then reloads authoritative profile',
      () async {
        final bytes = <int>[137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3];

        final updated = await repository.updateAvatar(
          userId: _userId,
          imageBytes: bytes,
          contentType: 'image/png',
        );

        expect(updated.id, _userId);
        expect(updated.avatarKey, _objectKey);
        expect(updated.avatarUrl, 'https://cdn.example.test/signed-avatar');
        expect(uploadTransport.calls, 1);
        expect(uploadTransport.lastUri?.host, 'storage.example.test');
        expect(uploadTransport.lastHeaders, <String, String>{
          'Content-Type': 'image/png',
        });
        expect(uploadTransport.lastBytes, bytes);
        expect(apiAdapter.requests.map((item) => item.method).toList(), [
          'GET',
          'PATCH',
          'POST',
          'GET',
        ]);
        expect(
          apiAdapter.requests[1].uri.path,
          '/api/v1/users/me/avatar/presign',
        );
        expect(apiAdapter.requestBodies[1], <String, Object>{
          'kind': 'AVATAR',
          'contentType': 'image/png',
          'sizeBytes': bytes.length,
        });
        expect(
          apiAdapter.requests[2].uri.path,
          '/api/v1/users/me/avatar/confirm',
        );
        expect(apiAdapter.requestBodies[2], <String, String>{
          'uploadId': _uploadId,
        });
        expect(apiAdapter.requests[3].uri.path, '/api/v1/users/me');
      },
    );

    test(
      'validates upload ticket expiry and signed Content-Type before PUT',
      () async {
        final service = AuthApiService(
          client: apiClient,
          avatarUploadTransport: uploadTransport,
        );
        final expiredTicket = AvatarUploadTicketDto(
          uploadId: _uploadId,
          objectKey: _objectKey,
          putUrl: Uri.parse('https://storage.example.test/upload'),
          expiresAt: DateTime.now().toUtc().subtract(
            const Duration(minutes: 1),
          ),
          requiredHeaders: const <String, String>{'Content-Type': 'image/png'},
        );
        await expectLater(
          service.uploadAvatar(
            ticket: expiredTicket,
            expectedContentType: 'image/png',
            bytes: <int>[1, 2, 3],
          ),
          throwsFormatException,
        );

        final activeTicket = AvatarUploadTicketDto(
          uploadId: _uploadId,
          objectKey: _objectKey,
          putUrl: Uri.parse('https://storage.example.test/upload'),
          expiresAt: DateTime.now().toUtc().add(const Duration(minutes: 5)),
          requiredHeaders: const <String, String>{'Content-Type': 'image/png'},
        );
        await expectLater(
          service.uploadAvatar(
            ticket: activeTicket,
            expectedContentType: 'image/jpeg',
            bytes: <int>[1, 2, 3],
          ),
          throwsFormatException,
        );
        expect(uploadTransport.calls, 0);
      },
    );

    test('rejects credential headers in the presign response', () {
      expect(
        () => AvatarUploadTicketDto.fromObject(<String, Object>{
          'uploadId': _uploadId,
          'objectKey': _objectKey,
          'putUrl': 'https://storage.example.test/upload?signature=opaque',
          'expiresAt': DateTime.now()
              .toUtc()
              .add(const Duration(minutes: 5))
              .toIso8601String(),
          'requiredHeaders': <String, String>{
            'Content-Type': 'image/png',
            'Authorization': 'Bearer do-not-forward',
          },
        }),
        throwsFormatException,
      );
    });

    test(
      'does not confirm an upload after the signed-in account changes',
      () async {
        final putStarted = Completer<void>();
        final finishPut = Completer<void>();
        uploadTransport.beforeComplete = () async {
          putStarted.complete();
          await finishPut.future;
        };

        final pending = repository.updateAvatar(
          userId: _userId,
          imageBytes: <int>[1, 2, 3, 4],
          contentType: 'image/png',
        );
        await putStarted.future;
        await tokenStorage.saveTokens(
          accessToken: 'different-account-access-token',
          refreshToken: 'different-account-refresh-token',
        );
        finishPut.complete();

        await expectLater(pending, throwsA(isA<AuthRepositoryException>()));
        expect(
          apiAdapter.requests.any(
            (request) => request.path.endsWith('/avatar/confirm'),
          ),
          isFalse,
        );
      },
    );

    test('rejects files larger than 2 MiB before contacting Backend', () async {
      final before = apiAdapter.requests.length;
      await expectLater(
        repository.updateAvatar(
          userId: _userId,
          imageBytes: List<int>.filled(2 * 1024 * 1024 + 1, 0),
          contentType: 'image/png',
        ),
        throwsA(isA<AuthRepositoryException>()),
      );
      await Future<void>.delayed(Duration.zero);
      expect(apiAdapter.requests.length, before);
      expect(uploadTransport.calls, 0);
    });

    test('rejects an upload request for a different user', () async {
      await expectLater(
        repository.updateAvatar(
          userId: 'another-user',
          imageBytes: <int>[1, 2, 3],
          contentType: 'image/png',
        ),
        throwsA(isA<AuthRepositoryException>()),
      );
      await Future<void>.delayed(Duration.zero);
      expect(uploadTransport.calls, 0);
      expect(apiAdapter.requests.length, 1); // Only restoreSession GET.
    });
  });
}

const String _userId = '8f4e9b11-1d27-4bdb-a17b-2e6a8a4e81a4';
const String _uploadId = 'c1bb2d5e-0e75-4b5b-b8ac-4a1f7e9b0101';
const String _objectKey = 'avatars/8f4e9b11/avatar.png';

AppConfig _apiConfig() => AppConfig(
  environment: AppEnvironment.development,
  baseUrl: 'https://api.example.test/api/v1',
  authApiEnabled: true,
  learningApiEnabled: false,
  mockTestApiEnabled: false,
  analyticsApiEnabled: false,
);

Map<String, Object?> _user({bool avatarUploaded = false}) => <String, Object?>{
  'userId': _userId,
  'email': 'student@example.test',
  'fullName': 'Test Student',
  'status': 'ACTIVE',
  'roles': <String>['STUDENT'],
  'createdAt': '2026-01-01T00:00:00.000Z',
  'updatedAt': '2026-01-01T00:00:00.000Z',
  'phoneNumber': null,
  'avatarKey': avatarUploaded ? _objectKey : null,
  'avatarUrl': avatarUploaded ? 'https://cdn.example.test/signed-avatar' : null,
};

class _ApiAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = <RequestOptions>[];
  final List<Map<String, dynamic>?> requestBodies = <Map<String, dynamic>?>[];
  int currentUserReads = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    Map<String, dynamic>? requestBody;
    if (requestStream != null) {
      final bytes = await requestStream.fold<List<int>>(
        <int>[],
        (all, chunk) => all..addAll(chunk),
      );
      final decoded = jsonDecode(utf8.decode(bytes));
      if (decoded is Map) requestBody = Map<String, dynamic>.from(decoded);
    } else if (options.data is Map) {
      requestBody = Map<String, dynamic>.from(options.data as Map);
    } else if (options.data is String) {
      final decoded = jsonDecode(options.data as String);
      if (decoded is Map) requestBody = Map<String, dynamic>.from(decoded);
    }
    requestBodies.add(requestBody);
    final path = options.uri.path;
    if (options.method == 'GET' && path.endsWith('/users/me')) {
      currentUserReads++;
      return _jsonResponse(_user(avatarUploaded: currentUserReads > 1));
    }
    if (options.method == 'PATCH' && path.endsWith('/avatar/presign')) {
      return _jsonResponse(<String, Object?>{
        'uploadId': _uploadId,
        'objectKey': _objectKey,
        'putUrl': 'https://storage.example.test/upload?signature=opaque',
        'expiresAt': DateTime.now()
            .toUtc()
            .add(const Duration(minutes: 5))
            .toIso8601String(),
        'requiredHeaders': <String, String>{'Content-Type': 'image/png'},
      });
    }
    if (options.method == 'POST' && path.endsWith('/avatar/confirm')) {
      return _jsonResponse(<String, String>{
        'objectKey': _objectKey,
        'url': 'https://cdn.example.test/signed-avatar',
      });
    }
    throw StateError(
      'Unexpected API request: ${options.method} ${options.uri}',
    );
  }

  @override
  void close({bool force = false}) {}
}

class _RecordingAvatarTransport implements AvatarUploadTransport {
  int calls = 0;
  Uri? lastUri;
  Map<String, String>? lastHeaders;
  List<int>? lastBytes;
  Future<void> Function()? beforeComplete;

  @override
  Future<void> put({
    required Uri uri,
    required Map<String, String> headers,
    required String contentType,
    required List<int> bytes,
  }) async {
    calls++;
    lastUri = uri;
    lastHeaders = Map<String, String>.of(headers);
    lastBytes = List<int>.of(bytes);
    await beforeComplete?.call();
  }
}

class _FakeDeviceIdProvider implements DeviceIdProvider {
  @override
  Future<String> getOrCreate() async => 'test-device';
}

class _MemorySecureKeyValueStore implements SecureKeyValueStore {
  final Map<String, String> values = <String, String>{};

  @override
  Future<String?> read({required String key}) async => values[key];

  @override
  Future<void> write({required String key, required String value}) async {
    values[key] = value;
  }

  @override
  Future<void> delete({required String key}) async {
    values.remove(key);
  }
}

ResponseBody _jsonResponse(Object? data) => ResponseBody.fromString(
  jsonEncode(data),
  200,
  headers: <String, List<String>>{
    Headers.contentTypeHeader: <String>[Headers.jsonContentType],
  },
);
