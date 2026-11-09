import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/errors/app_exception.dart';

void main() {
  group('AppException constructors and classification', () {
    test('creates a network failure with a user-facing message', () {
      const exception = AppException.network();

      expect(exception.type, AppExceptionType.network);
      expect(exception.isNetworkError, isTrue);
      expect(exception.isRetryable, isTrue);
      expect(exception.statusCode, isNull);
      expect(exception.message, contains('kết nối'));
    });

    test('creates timeout failure and marks it retryable', () {
      const exception = AppException.timeout();

      expect(exception.type, AppExceptionType.timeout);
      expect(exception.isTimeout, isTrue);
      expect(exception.isRetryable, isTrue);
    });

    test('creates unauthorized failure', () {
      const exception = AppException.unauthorized();

      expect(exception.statusCode, 401);
      expect(exception.isUnauthorized, isTrue);
      expect(exception.isRetryable, isFalse);
    });

    test('creates validation failure', () {
      const exception = AppException.validation();

      expect(exception.isValidationError, isTrue);
      expect(exception.isRetryable, isFalse);
    });

    test('does not expose diagnostic cause in toString', () {
      final exception = AppException(
        type: AppExceptionType.unknown,
        message: 'Có lỗi xảy ra.',
        cause: Exception('private diagnostic'),
      );

      expect(exception.toString(), contains('Có lỗi xảy ra.'));
      expect(exception.toString(), isNot(contains('private diagnostic')));
    });
  });

  group('AppException.from', () {
    test('returns an existing AppException unchanged', () {
      const original = AppException.forbidden();

      expect(AppException.from(original), same(original));
    });

    test('maps TimeoutException to timeout', () {
      final exception = AppException.from(TimeoutException('timed out'));

      expect(exception.type, AppExceptionType.timeout);
      expect(exception.isRetryable, isTrue);
    });

    test('maps FormatException to parsing without exposing raw input', () {
      final exception = AppException.from(
        const FormatException('bad json: private payload'),
      );

      expect(exception.type, AppExceptionType.parsing);
      expect(exception.message, contains('đọc dữ liệu'));
      expect(exception.message, isNot(contains('private payload')));
      expect(exception.details, 'bad json: private payload');
    });

    test('maps ArgumentError to bad request', () {
      final exception = AppException.from(ArgumentError('invalid id'));

      expect(exception.type, AppExceptionType.badRequest);
      expect(exception.message, contains('không hợp lệ'));
    });

    test('maps unknown errors to a safe generic message', () {
      final exception = AppException.from(
        Exception('sensitive request details'),
      );

      expect(exception.type, AppExceptionType.unknown);
      expect(exception.message, contains('ngoài dự kiến'));
      expect(exception.message, isNot(contains('sensitive request details')));
    });

    test('uses the supplied fallback message for unknown errors', () {
      final exception = AppException.from(
        Exception('internal'),
        fallbackMessage: 'Không thể tải dữ liệu.',
      );

      expect(exception.message, 'Không thể tải dữ liệu.');
    });
  });

  group('AppException.fromHttpResponse', () {
    test('maps NestJS string message', () {
      final exception = AppException.fromHttpResponse(
        statusCode: 400,
        responseData: <String, Object?>{
          'statusCode': 400,
          'message': 'Email không hợp lệ.',
          'error': 'Bad Request',
        },
      );

      expect(exception.type, AppExceptionType.badRequest);
      expect(exception.message, 'Email không hợp lệ.');
      expect(exception.statusCode, 400);
    });

    test('maps NestJS validation message array and retains details', () {
      final messages = <String>['email must be an email', 'password too short'];
      final exception = AppException.fromHttpResponse(
        statusCode: 422,
        responseData: <String, Object?>{
          'statusCode': 422,
          'message': messages,
          'error': 'Unprocessable Entity',
        },
      );

      expect(exception.type, AppExceptionType.validation);
      expect(exception.message, 'email must be an email\npassword too short');
      expect(exception.details, messages);
    });

    test('classifies NestJS HTTP 400 message arrays as validation', () {
      final exception = AppException.fromHttpResponse(
        statusCode: 400,
        responseData: <String, Object?>{
          'statusCode': 400,
          'message': <String>['email must be an email'],
          'error': 'Bad Request',
        },
      );

      expect(exception.type, AppExceptionType.validation);
      expect(exception.message, 'email must be an email');
    });

    test('maps FastAPI detail string', () {
      final exception = AppException.fromHttpResponse(
        statusCode: 401,
        responseData: <String, Object?>{'detail': 'Thông tin đăng nhập sai.'},
      );

      expect(exception.type, AppExceptionType.unauthorized);
      expect(exception.message, 'Thông tin đăng nhập sai.');
    });

    test('maps nested FastAPI detail and nested error code', () {
      final exception = AppException.fromHttpResponse(
        statusCode: 409,
        responseData: <String, Object?>{
          'detail': <String, Object?>{
            'message': 'Dữ liệu đã được cập nhật.',
            'code': 'REVISION_CONFLICT',
          },
        },
      );

      expect(exception.type, AppExceptionType.conflict);
      expect(exception.message, 'Dữ liệu đã được cập nhật.');
      expect(exception.code, 'REVISION_CONFLICT');
    });

    test('maps HTTP status codes to normalized types', () {
      final cases = <int, AppExceptionType>{
        401: AppExceptionType.unauthorized,
        403: AppExceptionType.forbidden,
        404: AppExceptionType.notFound,
        408: AppExceptionType.timeout,
        409: AppExceptionType.conflict,
        422: AppExceptionType.validation,
        429: AppExceptionType.rateLimited,
        503: AppExceptionType.serviceUnavailable,
        500: AppExceptionType.server,
      };

      for (final entry in cases.entries) {
        final exception = AppException.fromHttpResponse(statusCode: entry.key);
        expect(exception.type, entry.value, reason: 'HTTP ${entry.key}');
      }
    });

    test('does not expose server response body for 5xx errors', () {
      final exception = AppException.fromHttpResponse(
        statusCode: 500,
        responseData: <String, Object?>{
          'message': 'SQL connection string and internal stack details',
        },
      );

      expect(exception.type, AppExceptionType.server);
      expect(exception.message, contains('Máy chủ'));
      expect(exception.message, isNot(contains('SQL')));
    });

    test('does not expose service-unavailable response internals', () {
      final exception = AppException.fromHttpResponse(
        statusCode: 503,
        responseData: <String, Object?>{'detail': 'upstream worker crashed'},
      );

      expect(exception.type, AppExceptionType.serviceUnavailable);
      expect(exception.message, contains('không khả dụng'));
      expect(exception.message, isNot(contains('worker')));
    });

    test('retains positive Retry-After duration only', () {
      final retryable = AppException.fromHttpResponse(
        statusCode: 429,
        retryAfter: const Duration(seconds: 30),
      );
      final invalid = AppException.fromHttpResponse(
        statusCode: 429,
        retryAfter: Duration.zero,
      );

      expect(retryable.isRetryable, isTrue);
      expect(retryable.retryAfter, const Duration(seconds: 30));
      expect(invalid.retryAfter, isNull);
    });

    test('uses fallback message when response has no usable message', () {
      final exception = AppException.fromHttpResponse(
        statusCode: 400,
        responseData: <String, Object?>{'message': '  '},
        fallbackMessage: 'Dữ liệu không đúng.',
      );

      expect(exception.message, 'Dữ liệu không đúng.');
    });

    test('supports a response body that is not a map', () {
      final exception = AppException.fromHttpResponse(
        statusCode: 404,
        responseData: 'not-json',
      );

      expect(exception.type, AppExceptionType.notFound);
      expect(exception.message, contains('Không tìm thấy'));
    });
  });
}
