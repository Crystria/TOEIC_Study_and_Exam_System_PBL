import 'dart:typed_data';

import 'package:dio/dio.dart';

abstract interface class AvatarUploadTransport {
  Future<void> put({
    required Uri uri,
    required Map<String, String> headers,
    required String contentType,
    required List<int> bytes,
  });
}

/// Uploads raw image bytes to the presigned object-storage URL.
///
/// A fresh Dio instance is used for every PUT. It has no API base URL,
/// interceptors, token storage or Authorization header, so the Gateway's
/// Bearer token cannot leak to the object-storage host.
class DioAvatarUploadTransport implements AvatarUploadTransport {
  DioAvatarUploadTransport({
    this.adapter,
    this.connectTimeout = const Duration(seconds: 15),
    this.sendTimeout = const Duration(seconds: 30),
    this.receiveTimeout = const Duration(seconds: 30),
  });

  final HttpClientAdapter? adapter;
  final Duration connectTimeout;
  final Duration sendTimeout;
  final Duration receiveTimeout;

  @override
  Future<void> put({
    required Uri uri,
    required Map<String, String> headers,
    required String contentType,
    required List<int> bytes,
  }) async {
    if (!const <String>{'http', 'https'}.contains(uri.scheme) ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty) {
      throw ArgumentError.value(uri, 'uri', 'Invalid presigned upload URL.');
    }
    if (bytes.isEmpty) {
      throw ArgumentError.value(bytes, 'bytes', 'Avatar file is empty.');
    }

    String? signedContentType;
    for (final entry in headers.entries) {
      final name = entry.key.trim();
      if (!RegExp(r"^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$").hasMatch(name) ||
          entry.value.contains('\r') ||
          entry.value.contains('\n')) {
        throw ArgumentError.value(headers, 'headers', 'Invalid upload header.');
      }
      final normalizedName = name.toLowerCase();
      if (const <String>{
        'authorization',
        'cookie',
        'host',
        'content-length',
      }.contains(normalizedName)) {
        throw ArgumentError.value(
          headers,
          'headers',
          'Credential and hop-by-hop headers are not allowed.',
        );
      }
      if (normalizedName == 'content-type') signedContentType = entry.value;
    }
    if (signedContentType == null ||
        signedContentType.toLowerCase() != contentType.toLowerCase()) {
      throw ArgumentError.value(
        headers,
        'headers',
        'Content-Type must match the presigned ticket.',
      );
    }

    final dio = Dio(
      BaseOptions(
        connectTimeout: connectTimeout,
        sendTimeout: sendTimeout,
        receiveTimeout: receiveTimeout,
        followRedirects: false,
        headers: const <String, dynamic>{},
      ),
    );
    if (adapter != null) {
      dio.httpClientAdapter = adapter!;
    }

    try {
      await dio.putUri<Object?>(
        uri,
        data: Uint8List.fromList(bytes),
        options: Options(
          contentType: contentType,
          headers: headers,
          responseType: ResponseType.plain,
          validateStatus: (status) =>
              status != null && status >= 200 && status < 300,
        ),
      );
    } finally {
      dio.close(force: true);
    }
  }
}
