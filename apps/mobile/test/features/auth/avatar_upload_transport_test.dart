import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/auth/services/avatar_upload_transport.dart';

void main() {
  test(
    'uploads raw bytes without forwarding an API Authorization token',
    () async {
      final adapter = _CaptureUploadAdapter();
      final transport = DioAvatarUploadTransport(adapter: adapter);
      final bytes = <int>[137, 80, 78, 71, 1, 2, 3];

      await transport.put(
        uri: Uri.parse('https://storage.example.test/avatar?signature=opaque'),
        headers: const <String, String>{'Content-Type': 'image/png'},
        contentType: 'image/png',
        bytes: bytes,
      );

      expect(adapter.method, 'PUT');
      expect(adapter.receivedBytes, bytes);
      expect(adapter.authorizationHeader, isNull);
      expect(adapter.contentType, 'image/png');
    },
  );

  test(
    'rejects an Authorization header supplied by an upload ticket',
    () async {
      final transport = DioAvatarUploadTransport();

      await expectLater(
        transport.put(
          uri: Uri.parse('https://storage.example.test/object'),
          headers: const <String, String>{
            'Content-Type': 'image/png',
            'Authorization': 'Bearer must-not-leak',
          },
          contentType: 'image/png',
          bytes: <int>[1],
        ),
        throwsArgumentError,
      );
    },
  );

  test('rejects upload URLs containing embedded credentials', () async {
    final transport = DioAvatarUploadTransport();

    await expectLater(
      transport.put(
        uri: Uri.parse('https://user:password@storage.example.test/object'),
        headers: const <String, String>{'Content-Type': 'image/png'},
        contentType: 'image/png',
        bytes: <int>[1],
      ),
      throwsArgumentError,
    );
  });
}

class _CaptureUploadAdapter implements HttpClientAdapter {
  String? method;
  List<int>? receivedBytes;
  String? authorizationHeader;
  String? contentType;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    method = options.method;
    authorizationHeader = _header(options.headers, 'authorization');
    contentType = _header(options.headers, 'content-type');
    if (requestStream != null) {
      receivedBytes = await requestStream.fold<List<int>>(
        <int>[],
        (all, chunk) => all..addAll(chunk),
      );
    } else if (options.data is Uint8List) {
      receivedBytes = List<int>.of(options.data as Uint8List);
    }
    return ResponseBody.fromString('', 200);
  }

  @override
  void close({bool force = false}) {}
}

String? _header(Map<String, dynamic> headers, String requestedName) {
  for (final entry in headers.entries) {
    if (entry.key.toLowerCase() == requestedName) {
      return entry.value?.toString();
    }
  }
  return null;
}
