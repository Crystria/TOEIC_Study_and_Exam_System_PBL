import 'dart:async';

import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../errors/app_exception.dart';
import '../storage/token_storage.dart';

/// Callback invoked after an authenticated request receives HTTP 401.
/// Return the exact access token to use for one retry, or null to stop.
typedef UnauthorizedRefreshHandler = Future<String?> Function(
  String failedAccessToken,
);

/// Callback invoked when the single retry with a refreshed token also receives
/// HTTP 401. The handler should clear only that rejected token pair.
typedef UnauthorizedRetryRejectedHandler = Future<void> Function(
  String rejectedAccessToken,
);

/// Shared HTTP client for Backend API calls.
///
/// Keep one instance per application and register it in the composition root
/// (B.6). Feature Services should use this wrapper instead of constructing
/// their own Dio instances.
///
/// All request paths must be relative to [AppConfig.baseUrl] and must not
/// start with `/`. This preserves the `/api/v1` prefix configured by B.1.
class ApiClient {
  ApiClient({
    required AppConfig config,
    TokenStorage? tokenStorage,
    HttpClientAdapter? adapter,
  }) : _config = config,
       _dio = Dio(_buildBaseOptions(config)) {
    if (adapter != null) {
      _dio.httpClientAdapter = adapter;
    }

    _dio.interceptors.add(
      _BearerTokenInterceptor(tokenStorage ?? TokenStorage()),
    );
  }

  /// Set this request extra to `true` for public endpoints such as login and
  /// registration, where an old access token must not be attached.
  static const String skipAuthExtraKey = 'toeic_mobile.skip_auth';
  static const String skipAuthRefreshExtraKey =
      'toeic_mobile.skip_auth_refresh';
  static const String _retryAccessTokenExtraKey =
      'toeic_mobile.retry_access_token';

  final AppConfig _config;
  final Dio _dio;
  UnauthorizedRefreshHandler? _unauthorizedRefreshHandler;
  UnauthorizedRetryRejectedHandler? _unauthorizedRetryRejectedHandler;

  /// Installs the Auth repository's session refresh coordinator.
  /// Must be configured before the first authenticated API request.
  void setUnauthorizedRefreshHandler(
    UnauthorizedRefreshHandler handler, {
    UnauthorizedRetryRejectedHandler? onRetryRejected,
  }) {
    _unauthorizedRefreshHandler = handler;
    _unauthorizedRetryRejectedHandler = onRetryRejected;
  }

  /// Sends a GET request and returns Dio's response metadata and decoded data.
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) {
    return _execute<T>(path, (requestOptions) {
      return _dio.get<T>(
        path,
        queryParameters: queryParameters,
        options: requestOptions,
        cancelToken: cancelToken,
        onReceiveProgress: onReceiveProgress,
      );
    }, options: options);
  }

  /// Sends a POST request.
  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) {
    return _execute<T>(path, (requestOptions) {
      return _dio.post<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: requestOptions,
        cancelToken: cancelToken,
        onSendProgress: onSendProgress,
        onReceiveProgress: onReceiveProgress,
      );
    }, options: options);
  }

  /// Sends a PUT request.
  Future<Response<T>> put<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) {
    return _execute<T>(path, (requestOptions) {
      return _dio.put<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: requestOptions,
        cancelToken: cancelToken,
        onSendProgress: onSendProgress,
        onReceiveProgress: onReceiveProgress,
      );
    }, options: options);
  }

  /// Sends a PATCH request.
  Future<Response<T>> patch<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) {
    return _execute<T>(path, (requestOptions) {
      return _dio.patch<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: requestOptions,
        cancelToken: cancelToken,
        onSendProgress: onSendProgress,
        onReceiveProgress: onReceiveProgress,
      );
    }, options: options);
  }

  /// Sends a DELETE request.
  Future<Response<T>> delete<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) {
    return _execute<T>(path, (requestOptions) {
      return _dio.delete<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: requestOptions,
        cancelToken: cancelToken,
      );
    }, options: options);
  }

  /// Closes the underlying transport. The composition root owns this client.
  void close({bool force = false}) {
    _dio.close(force: force);
  }

  Future<Response<T>> _execute<T>(
    String path,
    Future<Response<T>> Function(Options? requestOptions) request, {
    Options? options,
    bool allowAuthRefresh = true,
  }) async {
    if (!_config.isAnyApiEnabled) {
      throw const AppException(
        type: AppExceptionType.unknown,
        code: 'api_disabled',
        message: 'API mode đang tắt. Yêu cầu chưa được gửi đến máy chủ.',
      );
    }

    _validateRelativePath(path);

    try {
      return await request(options);
    } on AppException {
      rethrow;
    } on DioException catch (error) {
      final requestExtras = options?.extra;
      final skipAuth = requestExtras?[skipAuthExtraKey] == true;
      final skipRefresh = requestExtras?[skipAuthRefreshExtraKey] == true;
      final statusCode = error.response?.statusCode;
      final handler = _unauthorizedRefreshHandler;
      final failedAccessToken = _bearerTokenFrom(error.requestOptions.headers);

      if (!allowAuthRefresh && statusCode == 401 && failedAccessToken != null) {
        try {
          await _unauthorizedRetryRejectedHandler?.call(failedAccessToken);
        } on AppException {
          rethrow;
        } on TokenStorageException catch (storageError) {
          throw _mapTokenStorageException(storageError);
        } catch (cleanupError) {
          throw AppException.from(cleanupError);
        }
      }

      if (allowAuthRefresh &&
          !skipAuth &&
          !skipRefresh &&
          statusCode == 401 &&
          handler != null &&
          failedAccessToken != null) {
        try {
          final refreshedAccessToken = await handler(failedAccessToken);
          if (refreshedAccessToken != null && refreshedAccessToken.isNotEmpty) {
            // Pin the retry to the exact token rotated for this request. If a
            // different account logs in immediately afterwards, the stale
            // request cannot be replayed with that newer account's token.
            final retryOptions = _withRetryAccessToken(
              options,
              refreshedAccessToken,
            );
            return await _execute<T>(
              path,
              request,
              options: retryOptions,
              allowAuthRefresh: false,
            );
          }
        } on AppException {
          rethrow;
        } on TokenStorageException catch (refreshError) {
          throw _mapTokenStorageException(refreshError);
        } on DioException catch (refreshError) {
          throw _mapDioException(refreshError);
        } catch (refreshError) {
          throw AppException.from(refreshError);
        }
      }
      throw _mapDioException(error);
    } on TokenStorageException catch (error) {
      throw _mapTokenStorageException(error);
    } on FormatException catch (error) {
      throw AppException.parsing(cause: error);
    } on TimeoutException catch (error) {
      throw AppException.timeout(cause: error);
    } catch (error) {
      throw AppException.from(error);
    }
  }

  static Options _withRetryAccessToken(Options? options, String accessToken) {
    final extra = <String, dynamic>{
      ...?options?.extra,
      _retryAccessTokenExtraKey: accessToken,
    };
    return options == null
        ? Options(extra: extra)
        : options.copyWith(extra: extra);
  }

  static BaseOptions _buildBaseOptions(AppConfig config) {
    final baseUrl = config.baseUrl.isEmpty ? '' : '${config.baseUrl}/';

    return BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: config.connectTimeout,
      sendTimeout: config.sendTimeout,
      receiveTimeout: config.receiveTimeout,
      contentType: Headers.jsonContentType,
      responseType: ResponseType.json,
      headers: const <String, dynamic>{
        Headers.acceptHeader: Headers.jsonContentType,
        Headers.contentTypeHeader: Headers.jsonContentType,
      },
    );
  }

  static void _validateRelativePath(String path) {
    final normalizedPath = path.trim();
    final uri = Uri.tryParse(normalizedPath);

    if (normalizedPath.isEmpty ||
        normalizedPath.startsWith('/') ||
        uri == null ||
        uri.hasScheme ||
        uri.hasAuthority) {
      throw ArgumentError.value(
        path,
        'path',
        'API path must be a non-empty relative path without a leading slash.',
      );
    }
  }

  static String? _bearerTokenFrom(Map<String, dynamic> headers) {
    for (final entry in headers.entries) {
      if (entry.key.toLowerCase() != 'authorization') continue;
      final value = entry.value?.toString().trim();
      if (value == null || value.isEmpty) return null;
      final match = RegExp(
        r'^Bearer\s+(.+)$',
        caseSensitive: false,
      ).firstMatch(value);
      return match?.group(1)?.trim();
    }
    return null;
  }

  static AppException _mapDioException(DioException error) {
    final innerError = error.error;

    if (innerError is AppException) {
      return innerError;
    }
    if (innerError is TokenStorageException) {
      return _mapTokenStorageException(innerError);
    }
    if (innerError is FormatException) {
      return AppException.parsing(cause: error);
    }
    if (innerError is TimeoutException) {
      return AppException.timeout(cause: error);
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return AppException.timeout(cause: error);
      case DioExceptionType.connectionError:
        return AppException.network(cause: error);
      case DioExceptionType.cancel:
        return AppException.cancelled(cause: error);
      case DioExceptionType.badCertificate:
        return AppException.network(
          message: 'Không thể thiết lập kết nối bảo mật đến máy chủ.',
          cause: error,
        );
      case DioExceptionType.badResponse:
        final response = error.response;
        final statusCode = response?.statusCode;
        if (statusCode == null) {
          return AppException.unknown(cause: error);
        }
        return AppException.fromHttpResponse(
          statusCode: statusCode,
          responseData: response?.data,
          retryAfter: _parseRetryAfter(response?.headers),
          correlationId: _safeCorrelationId(
            response?.headers.value('x-correlation-id'),
          ),
          cause: error,
        );
      case DioExceptionType.unknown:
        return AppException.from(innerError ?? error);
    }
  }

  static AppException _mapTokenStorageException(TokenStorageException error) {
    return AppException.unknown(
      code: 'token_storage_failure',
      message: error.message,
      cause: error,
    );
  }

  /// Supports the delta-seconds form of the standard Retry-After header.
  /// HTTP-date values are intentionally ignored rather than guessed.
  static String? _safeCorrelationId(String? value) {
    final normalized = value?.trim();
    if (normalized == null ||
        !RegExp(r'^[A-Za-z0-9._:-]{1,128}$').hasMatch(normalized)) {
      return null;
    }
    return normalized;
  }

  static Duration? _parseRetryAfter(Headers? headers) {
    final rawValue = headers?.value('retry-after')?.trim();
    if (rawValue == null || rawValue.isEmpty) {
      return null;
    }

    final seconds = int.tryParse(rawValue);
    if (seconds == null || seconds <= 0) {
      return null;
    }
    return Duration(seconds: seconds);
  }
}

class _BearerTokenInterceptor extends Interceptor {
  _BearerTokenInterceptor(this._tokenStorage);

  final TokenStorage _tokenStorage;

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.extra[ApiClient.skipAuthExtraKey] == true) {
      options.headers.removeWhere(
        (key, value) => key.toLowerCase() == 'authorization',
      );
      handler.next(options);
      return;
    }

    final retryAccessToken = options.extra[ApiClient._retryAccessTokenExtraKey];
    if (retryAccessToken is String && retryAccessToken.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $retryAccessToken';
      handler.next(options);
      return;
    }

    try {
      final accessToken = await _tokenStorage.readAccessToken();
      if (accessToken != null && accessToken.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $accessToken';
      }
      handler.next(options);
    } catch (error, stackTrace) {
      handler.reject(
        DioException(
          requestOptions: options,
          error: error,
          stackTrace: stackTrace,
        ),
      );
    }
  }
}
