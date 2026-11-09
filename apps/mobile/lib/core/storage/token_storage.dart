import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Abstraction over an encrypted platform key-value store.
///
/// This interface is intentionally small so TokenStorage can be unit-tested
/// without invoking Android Keystore, iOS Keychain, or a platform channel.
abstract interface class SecureKeyValueStore {
  Future<String?> read({required String key});

  Future<void> write({required String key, required String value});

  Future<void> delete({required String key});
}

/// Production adapter backed by flutter_secure_storage.
///
/// The package uses platform-specific secure storage. Do not replace this with
/// SharedPreferences: access and refresh tokens are credentials, not settings.
class FlutterSecureKeyValueStore implements SecureKeyValueStore {
  FlutterSecureKeyValueStore({FlutterSecureStorage? storage})
    : _storage = storage ?? FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read({required String key}) {
    return _storage.read(key: key);
  }

  @override
  Future<void> write({required String key, required String value}) {
    return _storage.write(key: key, value: value);
  }

  @override
  Future<void> delete({required String key}) {
    return _storage.delete(key: key);
  }
}

enum TokenStorageOperation { read, write, delete, decode }

/// Safe error boundary for local credential-storage failures.
///
/// [cause] is retained for diagnostics only. Never display it in the UI or log
/// it without sanitizing platform-specific details.
class TokenStorageException implements Exception {
  const TokenStorageException({
    required this.operation,
    required this.message,
    this.cause,
  });

  final TokenStorageOperation operation;
  final String message;
  final Object? cause;

  @override
  String toString() => 'TokenStorageException(${operation.name}): $message';
}

/// Immutable token bundle returned by [TokenStorage].
class StoredTokens {
  const StoredTokens({
    required this.accessToken,
    this.refreshToken,
    this.accessTokenExpiresAt,
    this.refreshTokenExpiresAt,
  });

  final String accessToken;
  final String? refreshToken;
  final DateTime? accessTokenExpiresAt;
  final DateTime? refreshTokenExpiresAt;

  bool get hasRefreshToken => refreshToken != null;
}

/// Secure persistence for the authenticated user's token pair.
///
/// Access and refresh tokens are stored together as one versioned JSON value.
/// This avoids independently updating two secure-storage keys and leaving a
/// mismatched pair if only one write succeeds. The JSON value itself is stored
/// through [FlutterSecureKeyValueStore], not in SharedPreferences.
///
/// This class deliberately does not refresh tokens, inspect JWT claims, or
/// decide whether a session is valid. Those responsibilities belong to the
/// Auth/session layer and the API client.
class TokenStorage {
  TokenStorage({SecureKeyValueStore? secureStore})
    : _secureStore = secureStore ?? FlutterSecureKeyValueStore();

  static const String _tokenBundleKey = 'toeic_mobile.auth.token_bundle.v1';
  static const int _schemaVersion = 1;

  final SecureKeyValueStore _secureStore;

  /// Saves a complete token pair as one secure-storage record.
  ///
  /// [refreshToken] is optional because some authentication responses may not
  /// return one. Expiration timestamps are optional and should be calculated
  /// from the Backend's expires-in values by the Auth service/repository.
  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiresAt,
    DateTime? refreshTokenExpiresAt,
  }) async {
    final normalizedAccessToken = accessToken.trim();
    if (normalizedAccessToken.isEmpty) {
      throw ArgumentError.value(
        accessToken,
        'accessToken',
        'Access token must not be empty.',
      );
    }

    final normalizedRefreshToken = refreshToken?.trim();
    final storedRefreshToken =
        normalizedRefreshToken == null || normalizedRefreshToken.isEmpty
        ? null
        : normalizedRefreshToken;

    if (refreshTokenExpiresAt != null && storedRefreshToken == null) {
      throw ArgumentError.value(
        refreshTokenExpiresAt,
        'refreshTokenExpiresAt',
        'A refresh-token expiry requires a refresh token.',
      );
    }

    final payload = jsonEncode(<String, Object?>{
      'schemaVersion': _schemaVersion,
      'accessToken': normalizedAccessToken,
      'refreshToken': storedRefreshToken,
      'accessTokenExpiresAt': accessTokenExpiresAt?.toUtc().toIso8601String(),
      'refreshTokenExpiresAt': refreshTokenExpiresAt?.toUtc().toIso8601String(),
    });

    try {
      await _secureStore.write(key: _tokenBundleKey, value: payload);
    } catch (error) {
      throw TokenStorageException(
        operation: TokenStorageOperation.write,
        message: 'Không thể lưu thông tin xác thực an toàn.',
        cause: error,
      );
    }
  }

  /// Returns the stored bundle, or null when the user has no saved tokens.
  Future<StoredTokens?> readTokens() async {
    late final String? rawValue;
    try {
      rawValue = await _secureStore.read(key: _tokenBundleKey);
    } catch (error) {
      throw TokenStorageException(
        operation: TokenStorageOperation.read,
        message: 'Không thể đọc thông tin xác thực an toàn.',
        cause: error,
      );
    }

    if (rawValue == null) {
      return null;
    }

    try {
      final decoded = jsonDecode(rawValue);
      if (decoded is! Map<String, dynamic>) {
        throw const FormatException('Token payload must be a JSON object.');
      }

      final schemaVersion = decoded['schemaVersion'];
      if (schemaVersion != _schemaVersion) {
        throw FormatException(
          'Unsupported token schema version: $schemaVersion.',
        );
      }

      final rawAccessToken = decoded['accessToken'];
      if (rawAccessToken is! String || rawAccessToken.trim().isEmpty) {
        throw const FormatException('Access token is missing or invalid.');
      }

      final rawRefreshToken = decoded['refreshToken'];
      if (rawRefreshToken != null && rawRefreshToken is! String) {
        throw const FormatException('Refresh token has an invalid type.');
      }
      if (rawRefreshToken is String && rawRefreshToken.trim().isEmpty) {
        throw const FormatException('Refresh token must not be empty.');
      }

      final accessTokenExpiresAt = _parseDateTime(
        decoded['accessTokenExpiresAt'],
        'accessTokenExpiresAt',
      );
      final refreshTokenExpiresAt = _parseDateTime(
        decoded['refreshTokenExpiresAt'],
        'refreshTokenExpiresAt',
      );

      if (refreshTokenExpiresAt != null && rawRefreshToken == null) {
        throw const FormatException(
          'Refresh-token expiry exists without a refresh token.',
        );
      }

      return StoredTokens(
        accessToken: rawAccessToken.trim(),
        refreshToken: (rawRefreshToken as String?)?.trim(),
        accessTokenExpiresAt: accessTokenExpiresAt,
        refreshTokenExpiresAt: refreshTokenExpiresAt,
      );
    } catch (error) {
      throw TokenStorageException(
        operation: TokenStorageOperation.decode,
        message: 'Dữ liệu xác thực đã lưu không hợp lệ.',
        cause: error,
      );
    }
  }

  Future<String?> readAccessToken() async {
    return (await readTokens())?.accessToken;
  }

  Future<String?> readRefreshToken() async {
    return (await readTokens())?.refreshToken;
  }

  Future<bool> hasAccessToken() async {
    final tokens = await readTokens();
    return tokens?.accessToken.isNotEmpty ?? false;
  }

  /// Deletes only this application's token bundle.
  ///
  /// Do not use deleteAll(): the same secure-storage plugin may later hold
  /// unrelated credentials owned by other modules.
  Future<void> clearTokens() async {
    try {
      await _secureStore.delete(key: _tokenBundleKey);
    } catch (error) {
      throw TokenStorageException(
        operation: TokenStorageOperation.delete,
        message: 'Không thể xóa thông tin xác thực đã lưu.',
        cause: error,
      );
    }
  }

  static DateTime? _parseDateTime(Object? value, String fieldName) {
    if (value == null) {
      return null;
    }
    if (value is! String) {
      throw FormatException('$fieldName must be an ISO-8601 string.');
    }

    final parsed = DateTime.tryParse(value);
    if (parsed == null) {
      throw FormatException('$fieldName is not a valid date-time.');
    }
    return parsed.toUtc();
  }
}
