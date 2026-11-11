import 'auth_api_dtos.dart';

/// Backend-confirmed client-side upload limit from the Auth avatar integration
/// contract tests: files larger than 2 MiB are rejected by presign.
abstract final class AvatarUploadConstraints {
  static const int maxBytes = 2 * 1024 * 1024;
}

class AvatarPresignRequestDto {
  const AvatarPresignRequestDto({
    required this.contentType,
    required this.sizeBytes,
  });

  final String contentType;
  final int sizeBytes;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'kind': 'AVATAR',
    'contentType': contentType,
    'sizeBytes': sizeBytes,
  };
}

class AvatarUploadTicketDto {
  const AvatarUploadTicketDto({
    required this.uploadId,
    required this.objectKey,
    required this.putUrl,
    required this.expiresAt,
    required this.requiredHeaders,
  });

  final String uploadId;
  final String objectKey;
  final Uri putUrl;
  final DateTime expiresAt;
  final Map<String, String> requiredHeaders;

  factory AvatarUploadTicketDto.fromObject(Object? value) {
    final json = authJsonMap(value, context: 'Avatar presign response');
    final rawHeaders = json['requiredHeaders'];
    if (rawHeaders is! Map) {
      throw const FormatException('requiredHeaders phải là JSON object.');
    }

    final headers = <String, String>{};
    for (final entry in rawHeaders.entries) {
      if (entry.key is! String || entry.value is! String) {
        throw const FormatException(
          'requiredHeaders chứa giá trị không hợp lệ.',
        );
      }
      final rawName = (entry.key as String).trim();
      final rawValue = entry.value as String;
      if (!RegExp(r"^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$").hasMatch(rawName) ||
          rawValue.contains('\r') ||
          rawValue.contains('\n')) {
        throw const FormatException(
          'requiredHeaders chứa giá trị không hợp lệ.',
        );
      }
      final normalizedName = rawName.toLowerCase();
      if (const <String>{
        'authorization',
        'cookie',
        'host',
        'content-length',
      }.contains(normalizedName)) {
        throw const FormatException('requiredHeaders chứa header bị cấm.');
      }
      if (headers.keys.any((key) => key.toLowerCase() == normalizedName)) {
        throw const FormatException('requiredHeaders chứa header trùng lặp.');
      }
      headers[rawName] = rawValue;
    }

    final putUrl = _httpUri(json['putUrl'], 'putUrl');
    final expiresAtRaw = json['expiresAt'];
    if (expiresAtRaw is! String) {
      throw const FormatException('expiresAt phải là ISO-8601 string.');
    }
    final expiresAt = DateTime.tryParse(expiresAtRaw);
    if (expiresAt == null) {
      throw const FormatException('expiresAt không phải ISO-8601.');
    }
    if (!headers.keys.any((key) => key.toLowerCase() == 'content-type')) {
      throw const FormatException('Avatar ticket thiếu Content-Type header.');
    }

    return AvatarUploadTicketDto(
      uploadId: _requiredString(json, 'uploadId'),
      objectKey: _requiredString(json, 'objectKey'),
      putUrl: putUrl,
      expiresAt: expiresAt.toUtc(),
      requiredHeaders: Map<String, String>.unmodifiable(headers),
    );
  }
}

class AvatarConfirmRequestDto {
  const AvatarConfirmRequestDto({required this.uploadId});

  final String uploadId;

  Map<String, dynamic> toJson() => <String, dynamic>{'uploadId': uploadId};
}

class AvatarConfirmResponseDto {
  const AvatarConfirmResponseDto({required this.objectKey, required this.url});

  final String objectKey;
  final Uri url;

  factory AvatarConfirmResponseDto.fromObject(Object? value) {
    final json = authJsonMap(value, context: 'Avatar confirm response');
    return AvatarConfirmResponseDto(
      objectKey: _requiredString(json, 'objectKey'),
      url: _httpUri(json['url'], 'url'),
    );
  }
}

String _requiredString(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('Thiếu hoặc sai kiểu trường $field.');
  }
  return value.trim();
}

Uri _httpUri(Object? value, String field) {
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('$field phải là URL hợp lệ.');
  }
  final uri = Uri.tryParse(value.trim());
  if (uri == null ||
      !uri.hasAuthority ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty ||
      !const <String>{'http', 'https'}.contains(uri.scheme.toLowerCase())) {
    throw FormatException('$field phải dùng URL HTTP hoặc HTTPS hợp lệ.');
  }
  return uri;
}
