import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/config/app_config.dart';
import 'package:toeic_mobile/core/network/api_client.dart';
import 'package:toeic_mobile/core/storage/token_storage.dart';
import 'package:toeic_mobile/features/learning/repositories/learning_repository.dart';
import 'package:toeic_mobile/features/learning/services/learning_api_service.dart';

void main() {
  test(
    'loads learner vocabulary topic detail from the mapped API route',
    () async {
      final tokenStorage = TokenStorage(
        secureStore: _MemorySecureKeyValueStore(),
      );
      await tokenStorage.saveTokens(
        accessToken: 'student-access-token',
        refreshToken: 'student-refresh-token',
      );
      final adapter = _TopicDetailAdapter();
      final client = ApiClient(
        config: AppConfig(
          environment: AppEnvironment.development,
          baseUrl: 'https://api.example.test/api/v1',
          authApiEnabled: true,
          learningApiEnabled: true,
          mockTestApiEnabled: false,
          analyticsApiEnabled: false,
        ),
        tokenStorage: tokenStorage,
        adapter: adapter,
      );
      addTearDown(() => client.close(force: true));

      final repository = ApiLearningRepository(
        api: LearningApiService(client: client),
        currentUserId: () => 'student-user-id',
      );

      final topic = await repository.getTopic('topic-uuid-123');

      expect(topic.id, 'topic-uuid-123');
      expect(topic.name, 'Business Meetings');
      expect(topic.vocabularyCount, 42);
      expect(adapter.lastRequest?.method, 'GET');
      expect(
        adapter.lastRequest?.uri.path,
        '/api/v1/learning/vocabulary-topics/topic-uuid-123',
      );
      String? authorization;
      for (final entry in adapter.lastRequest!.headers.entries) {
        if (entry.key.toLowerCase() == 'authorization') {
          authorization = entry.value.toString();
          break;
        }
      }
      expect(authorization, 'Bearer student-access-token');
    },
  );

  test('rejects empty topic IDs before making a request', () async {
    final client = ApiClient(
      config: AppConfig(
        environment: AppEnvironment.development,
        baseUrl: 'https://api.example.test/api/v1',
        authApiEnabled: true,
        learningApiEnabled: true,
        mockTestApiEnabled: false,
        analyticsApiEnabled: false,
      ),
      tokenStorage: TokenStorage(secureStore: _MemorySecureKeyValueStore()),
    );
    addTearDown(() => client.close(force: true));
    final repository = ApiLearningRepository(
      api: LearningApiService(client: client),
      currentUserId: () => 'student-user-id',
    );

    await expectLater(repository.getTopic('  '), throwsArgumentError);
  });
}

class _TopicDetailAdapter implements HttpClientAdapter {
  RequestOptions? lastRequest;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastRequest = options;
    return ResponseBody.fromString(
      jsonEncode(<String, Object>{
        'topicId': 'topic-uuid-123',
        'topicName': 'Business Meetings',
        'vocabularyCount': 42,
      }),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
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
