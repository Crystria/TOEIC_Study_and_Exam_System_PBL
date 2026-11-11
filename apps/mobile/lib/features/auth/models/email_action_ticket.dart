/// Mục đích của liên kết được gửi qua email.
enum EmailActionType { passwordReset, emailVerification }

/// Mock mode có token nội bộ; Backend thật chỉ trả thông báo đã nhận yêu cầu.
class EmailActionTicket {
  const EmailActionTicket({
    required this.email,
    required this.type,
    this.token,
    this.expiresAt,
  });

  final String email;
  final String? token;
  final EmailActionType type;
  final DateTime? expiresAt;

  bool get isSimulated => token != null;
  bool get isExpired => expiresAt != null && DateTime.now().isAfter(expiresAt!);
}
