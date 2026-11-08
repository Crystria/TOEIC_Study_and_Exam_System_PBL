import 'dart:async';

enum AiChatFailureKind {
  network,
  timeout,
  unauthenticated,
  forbidden,
  dailyQuotaExceeded,
  rateLimited,
  invalidRequest,
  conversationNotFound,
  serviceUnavailable,
  server,
  invalidResponse,
  unknown,
}

/// Normalized failure boundary between the AI Chat data layer and UI.
///
/// A future HTTP service should map status/code/Retry-After into this model
/// rather than exposing Dio/HTTP exceptions to Widgets or Providers.
class AiChatFailure implements Exception {
  const AiChatFailure({
    required this.kind,
    required this.message,
    this.retryAfterSeconds,
    this.statusCode,
    this.details,
  });

  final AiChatFailureKind kind;
  final String message;
  final int? retryAfterSeconds;
  final int? statusCode;
  final String? details;

  bool get isRetryable => switch (kind) {
    AiChatFailureKind.network ||
    AiChatFailureKind.timeout ||
    AiChatFailureKind.rateLimited ||
    AiChatFailureKind.serviceUnavailable ||
    AiChatFailureKind.server ||
    AiChatFailureKind.unknown => true,
    _ => false,
  };

  bool get blocksSending => switch (kind) {
    AiChatFailureKind.unauthenticated ||
    AiChatFailureKind.forbidden ||
    AiChatFailureKind.dailyQuotaExceeded ||
    AiChatFailureKind.conversationNotFound => true,
    _ => false,
  };

  String get title => switch (kind) {
    AiChatFailureKind.network => 'Không có kết nối mạng',
    AiChatFailureKind.timeout => 'Yêu cầu đã hết thời gian chờ',
    AiChatFailureKind.unauthenticated => 'Phiên đăng nhập không còn hợp lệ',
    AiChatFailureKind.forbidden => 'Không có quyền sử dụng tính năng này',
    AiChatFailureKind.dailyQuotaExceeded => 'Đã hết lượt AI hôm nay',
    AiChatFailureKind.rateLimited => 'Bạn đang gửi yêu cầu quá nhanh',
    AiChatFailureKind.invalidRequest => 'Yêu cầu chưa hợp lệ',
    AiChatFailureKind.conversationNotFound => 'Không tìm thấy cuộc trò chuyện',
    AiChatFailureKind.serviceUnavailable => 'Dịch vụ AI tạm thời gián đoạn',
    AiChatFailureKind.server => 'Máy chủ AI đang gặp sự cố',
    AiChatFailureKind.invalidResponse => 'Phản hồi từ máy chủ không hợp lệ',
    AiChatFailureKind.unknown => 'Không thể hoàn thành yêu cầu',
  };

  String get userMessage => switch (kind) {
    AiChatFailureKind.network =>
      'Kiểm tra kết nối Internet rồi thử gửi lại tin nhắn.',
    AiChatFailureKind.timeout => 'Máy chủ phản hồi quá lâu. Kiểm tra lịch sử trước khi gửi lại để tránh gửi trùng.',
    AiChatFailureKind.unauthenticated =>
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    AiChatFailureKind.forbidden =>
      'Tài khoản hiện không có quyền thực hiện thao tác này.',
    AiChatFailureKind.dailyQuotaExceeded => 'Bạn đã sử dụng hết hạn mức AI trong ngày. Hãy thử lại sau thời điểm làm mới hạn mức.',
    AiChatFailureKind.rateLimited =>
      retryAfterSeconds == null
          ? 'Hệ thống đang giới hạn tần suất yêu cầu. Vui lòng chờ rồi thử lại.'
          : 'Hệ thống đang giới hạn tần suất yêu cầu. Hãy chờ khoảng $retryAfterSeconds giây rồi thử lại.',
    AiChatFailureKind.invalidRequest =>
      'Nội dung gửi chưa đúng định dạng hoặc vượt giới hạn cho phép.',
    AiChatFailureKind.conversationNotFound =>
      'Cuộc trò chuyện có thể đã bị xóa. Hãy tải lại danh sách lịch sử.',
    AiChatFailureKind.serviceUnavailable =>
      'Dịch vụ AI hiện chưa sẵn sàng. Vui lòng thử lại sau.',
    AiChatFailureKind.server =>
      'Máy chủ không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.',
    AiChatFailureKind.invalidResponse =>
      'Ứng dụng không đọc được phản hồi từ máy chủ. Vui lòng thử lại sau.',
    AiChatFailureKind.unknown =>
      'Đã xảy ra lỗi ngoài dự kiến. Bạn có thể thử lại nếu kết nối ổn định.',
  };

  factory AiChatFailure.from(Object error) {
    if (error is AiChatFailure) return error;
    if (error is TimeoutException) {
      return const AiChatFailure(
        kind: AiChatFailureKind.timeout,
        message: 'Request timed out.',
      );
    }

    final normalized = error.toString().toLowerCase();
    if (normalized.contains('socketexception') ||
        normalized.contains('failed host lookup') ||
        normalized.contains('network is unreachable') ||
        normalized.contains('connection refused')) {
      return AiChatFailure(
        kind: AiChatFailureKind.network,
        message: error.toString(),
        details: error.toString(),
      );
    }
    if (error is FormatException) {
      return AiChatFailure(
        kind: AiChatFailureKind.invalidResponse,
        message: error.message,
        details: error.toString(),
      );
    }
    if (normalized.contains('không còn tồn tại') ||
        normalized.contains('không tìm thấy cuộc trò chuyện')) {
      return AiChatFailure(
        kind: AiChatFailureKind.conversationNotFound,
        message: error.toString(),
        details: error.toString(),
      );
    }
    if (error is ArgumentError) {
      return AiChatFailure(
        kind: AiChatFailureKind.invalidRequest,
        message: error.toString(),
        details: error.toString(),
      );
    }

    return AiChatFailure(
      kind: AiChatFailureKind.unknown,
      message: error.toString(),
      details: error.toString(),
    );
  }

  factory AiChatFailure.fromHttpStatus({
    required int statusCode,
    String? code,
    String? message,
    int? retryAfterSeconds,
  }) {
    final normalizedCode = code?.trim().toLowerCase();
    final kind = switch (statusCode) {
      401 => AiChatFailureKind.unauthenticated,
      403 => AiChatFailureKind.forbidden,
      404 => AiChatFailureKind.conversationNotFound,
      408 || 504 => AiChatFailureKind.timeout,
      400 || 422 => AiChatFailureKind.invalidRequest,
      429 when normalizedCode == 'daily_quota_exceeded' =>
        AiChatFailureKind.dailyQuotaExceeded,
      429 => AiChatFailureKind.rateLimited,
      503 => AiChatFailureKind.serviceUnavailable,
      >= 500 => AiChatFailureKind.server,
      _ => AiChatFailureKind.unknown,
    };

    return AiChatFailure(
      kind: kind,
      message: message ?? 'HTTP $statusCode',
      statusCode: statusCode,
      retryAfterSeconds: retryAfterSeconds != null && retryAfterSeconds > 0
          ? retryAfterSeconds
          : null,
      details: code,
    );
  }

  @override
  String toString() => userMessage;
}
