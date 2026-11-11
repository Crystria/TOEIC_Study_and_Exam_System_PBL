import 'dart:async';

/// Categories used to normalize failures across the application.
///
/// This type is transport-agnostic: the Core Network layer can map Dio/HTTP
/// failures into [AppException] without exposing transport-specific classes to
/// Providers, Repositories, or Widgets.
enum AppExceptionType {
  network,
  timeout,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  validation,
  conflict,
  rateLimited,
  serviceUnavailable,
  server,
  cancelled,
  parsing,
  unknown,
}

/// A safe, application-wide representation of an operation failure.
///
/// [message] is suitable for presentation to the user. [details] and [cause]
/// are diagnostic data and must not be displayed directly or logged if they
/// may contain credentials, personal information, or request payloads.
class AppException implements Exception {
  const AppException({
    required this.type,
    required this.message,
    this.code,
    this.statusCode,
    this.details,
    this.cause,
    this.retryAfter,
    this.correlationId,
  });

  const AppException.network({
    this.message =
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối Internet.',
    this.cause,
    this.details,
    this.code,
    this.correlationId,
  }) : type = AppExceptionType.network,
       statusCode = null,
       retryAfter = null;

  const AppException.timeout({
    this.message = 'Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.',
    this.cause,
    this.details,
    this.code,
    this.correlationId,
  }) : type = AppExceptionType.timeout,
       statusCode = null,
       retryAfter = null;

  const AppException.unauthorized({
    this.message =
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
    this.cause,
    this.details,
    this.code,
    this.correlationId,
  }) : type = AppExceptionType.unauthorized,
       statusCode = 401,
       retryAfter = null;

  const AppException.forbidden({
    this.message = 'Tài khoản không có quyền thực hiện thao tác này.',
    this.cause,
    this.details,
    this.code,
    this.correlationId,
  }) : type = AppExceptionType.forbidden,
       statusCode = 403,
       retryAfter = null;

  const AppException.validation({
    this.message = 'Dữ liệu gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.',
    this.cause,
    this.details,
    this.code,
    this.correlationId,
  }) : type = AppExceptionType.validation,
       statusCode = null,
       retryAfter = null;

  const AppException.cancelled({
    this.message = 'Yêu cầu đã bị hủy.',
    this.cause,
    this.details,
    this.code,
    this.correlationId,
  }) : type = AppExceptionType.cancelled,
       statusCode = null,
       retryAfter = null;

  const AppException.parsing({
    this.message = 'Không thể đọc dữ liệu từ máy chủ. Vui lòng thử lại sau.',
    this.cause,
    this.details,
    this.code,
    this.correlationId,
  }) : type = AppExceptionType.parsing,
       statusCode = null,
       retryAfter = null;

  const AppException.unknown({
    this.message = 'Đã xảy ra lỗi ngoài dự kiến. Vui lòng thử lại sau.',
    this.cause,
    this.details,
    this.code,
    this.correlationId,
  }) : type = AppExceptionType.unknown,
       statusCode = null,
       retryAfter = null;

  final AppExceptionType type;

  /// Message intended for user-facing UI. Do not put raw stack traces here.
  final String message;

  /// Optional stable error identifier returned by the Backend.
  final String? code;

  /// HTTP status when the failure originated from an HTTP response.
  final int? statusCode;

  /// Validation errors or other structured diagnostic information.
  /// Treat this value as untrusted and do not render it directly in the UI.
  final Object? details;

  /// Original error retained for diagnostics; it is not included in [toString].
  final Object? cause;

  /// Optional server-provided delay before a retry, for example HTTP 429.
  final Duration? retryAfter;

  /// Gateway correlation identifier for safe support/QA tracing.
  final String? correlationId;

  bool get isNetworkError => type == AppExceptionType.network;
  bool get isTimeout => type == AppExceptionType.timeout;
  bool get isUnauthorized => type == AppExceptionType.unauthorized;
  bool get isValidationError => type == AppExceptionType.validation;
  bool get isCancelled => type == AppExceptionType.cancelled;

  /// Whether retrying may succeed without changing the request.
  ///
  /// This is guidance only. Non-idempotent requests still require an
  /// idempotency strategy before a caller is allowed to retry them.
  bool get isRetryable => switch (type) {
    AppExceptionType.network ||
    AppExceptionType.timeout ||
    AppExceptionType.rateLimited ||
    AppExceptionType.serviceUnavailable ||
    AppExceptionType.server => true,
    _ => false,
  };

  /// Converts the HTTP response formats observed in the Backend services.
  ///
  /// Supports NestJS/Gateway payloads such as
  /// `{'message': '...', 'statusCode': 400}` and validation arrays such as
  /// `{'message': ['field is required'], 'error': 'Bad Request'}`. It also
  /// supports FastAPI payloads such as `{'detail': '...'}` or
  /// `{'detail': {'message': '...', 'code': '...'}}`.
  ///
  /// Server-side 5xx response bodies are intentionally not exposed as the
  /// display message because they may contain internal implementation data.
  factory AppException.fromHttpResponse({
    required int statusCode,
    Object? responseData,
    String? fallbackMessage,
    Duration? retryAfter,
    String? correlationId,
    Object? cause,
  }) {
    final type = _typeForStatusCode(statusCode, responseData);
    final payload = _asStringKeyedMap(responseData);
    final nestedDetail = _asStringKeyedMap(payload?['detail']);
    final code =
        _readString(payload, 'code') ??
        _readString(payload, 'errorCode') ??
        _readString(nestedDetail, 'code');

    final parsedMessage =
        type == AppExceptionType.server ||
            type == AppExceptionType.serviceUnavailable
        ? null
        : _extractMessage(payload) ?? _extractMessage(nestedDetail);

    final details = _extractDetails(payload, nestedDetail);
    final safeRetryAfter = retryAfter != null && retryAfter > Duration.zero
        ? retryAfter
        : null;

    return AppException(
      type: type,
      message:
          parsedMessage ?? _nonEmpty(fallbackMessage) ?? _defaultMessage(type),
      code: code,
      statusCode: statusCode,
      details: details,
      cause: cause,
      retryAfter: safeRetryAfter,
      correlationId: _nonEmpty(correlationId),
    );
  }

  /// Normalizes common Dart failures without depending on Dio or dart:io.
  ///
  /// Transport adapters should call [fromHttpResponse] for HTTP responses and
  /// map socket/client-specific failures to [network] in B.5.
  factory AppException.from(Object error, {String? fallbackMessage}) {
    if (error is AppException) {
      return error;
    }

    if (error is TimeoutException) {
      return AppException.timeout(cause: error);
    }

    if (error is FormatException) {
      return AppException(
        type: AppExceptionType.parsing,
        message: 'Không thể đọc dữ liệu từ máy chủ. Vui lòng thử lại sau.',
        cause: error,
        details: error.message,
      );
    }

    if (error is ArgumentError) {
      return AppException(
        type: AppExceptionType.badRequest,
        message:
            _nonEmpty(fallbackMessage) ??
            'Tham số yêu cầu không hợp lệ. Vui lòng kiểm tra lại.',
        cause: error,
      );
    }

    return AppException(
      type: AppExceptionType.unknown,
      message:
          _nonEmpty(fallbackMessage) ??
          _defaultMessage(AppExceptionType.unknown),
      cause: error,
    );
  }

  @override
  String toString() {
    final status = statusCode == null ? '' : ', statusCode: $statusCode';
    final errorCode = code == null ? '' : ', code: $code';
    return 'AppException(type: ${type.name}$status$errorCode): $message';
  }

  static AppExceptionType _typeForStatusCode(
    int statusCode,
    Object? responseData,
  ) {
    final payload = _asStringKeyedMap(responseData);
    if (statusCode == 400 && payload?['message'] is List) {
      // NestJS ValidationPipe commonly returns HTTP 400 with message[].
      return AppExceptionType.validation;
    }

    return switch (statusCode) {
      400 => AppExceptionType.badRequest,
      401 => AppExceptionType.unauthorized,
      403 => AppExceptionType.forbidden,
      404 => AppExceptionType.notFound,
      408 || 504 => AppExceptionType.timeout,
      409 => AppExceptionType.conflict,
      422 => AppExceptionType.validation,
      429 => AppExceptionType.rateLimited,
      503 => AppExceptionType.serviceUnavailable,
      >= 500 && <= 599 => AppExceptionType.server,
      _ => AppExceptionType.unknown,
    };
  }

  static String _defaultMessage(AppExceptionType type) {
    return switch (type) {
      AppExceptionType.network =>
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối Internet.',
      AppExceptionType.timeout =>
        'Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.',
      AppExceptionType.unauthorized =>
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      AppExceptionType.forbidden =>
        'Tài khoản không có quyền thực hiện thao tác này.',
      AppExceptionType.notFound => 'Không tìm thấy dữ liệu được yêu cầu.',
      AppExceptionType.badRequest =>
        'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.',
      AppExceptionType.validation =>
        'Dữ liệu gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.',
      AppExceptionType.conflict =>
        'Dữ liệu đã thay đổi. Vui lòng tải lại rồi thử lại.',
      AppExceptionType.rateLimited =>
        'Bạn đang gửi yêu cầu quá nhanh. Vui lòng chờ rồi thử lại.',
      AppExceptionType.serviceUnavailable =>
        'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.',
      AppExceptionType.server =>
        'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.',
      AppExceptionType.cancelled => 'Yêu cầu đã bị hủy.',
      AppExceptionType.parsing =>
        'Không thể đọc dữ liệu từ máy chủ. Vui lòng thử lại sau.',
      AppExceptionType.unknown =>
        'Đã xảy ra lỗi ngoài dự kiến. Vui lòng thử lại sau.',
    };
  }

  static Map<String, Object?>? _asStringKeyedMap(Object? value) {
    if (value is! Map) {
      return null;
    }

    final result = <String, Object?>{};
    for (final entry in value.entries) {
      final key = entry.key;
      if (key is String) {
        result[key] = entry.value;
      }
    }
    return result;
  }

  static String? _readString(Map<String, Object?>? map, String key) {
    if (map == null) {
      return null;
    }
    return _nonEmpty(map[key]?.toString());
  }

  static String? _extractMessage(Map<String, Object?>? payload) {
    if (payload == null) {
      return null;
    }

    for (final key in const ['message', 'detail', 'error_description']) {
      final message = _messageFromValue(payload[key]);
      if (message != null) {
        return message;
      }
    }
    return null;
  }

  static String? _messageFromValue(Object? value) {
    final directMessage = _nonEmpty(value is String ? value : null);
    if (directMessage != null) {
      return directMessage;
    }

    if (value is List) {
      final messages = value
          .map(_messageFromValue)
          .whereType<String>()
          .toList(growable: false);
      return messages.isEmpty ? null : messages.join('\n');
    }

    final nested = _asStringKeyedMap(value);
    if (nested != null) {
      return _extractMessage(nested);
    }
    return null;
  }

  static Object? _extractDetails(
    Map<String, Object?>? payload,
    Map<String, Object?>? nestedDetail,
  ) {
    if (payload == null) {
      return nestedDetail;
    }

    final details =
        payload['errors'] ??
        payload['details'] ??
        payload['validationErrors'] ??
        payload['currentProgress'];
    if (details != null) {
      return details;
    }

    final message = payload['message'];
    if (message is List) {
      return message;
    }

    if (nestedDetail != null) {
      return nestedDetail['errors'] ??
          nestedDetail['details'] ??
          nestedDetail['currentProgress'] ??
          nestedDetail;
    }

    final detail = payload['detail'];
    return detail is String ? null : detail;
  }

  static String? _nonEmpty(String? value) {
    final normalized = value?.trim();
    return normalized == null || normalized.isEmpty ? null : normalized;
  }
}
