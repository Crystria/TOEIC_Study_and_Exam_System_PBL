/// Mục đích của liên kết email trong luồng xác thực.
enum EmailActionType { passwordReset, emailVerification }

/// Ticket đại diện cho liên kết được gửi qua email.
///
/// Trong FakeAuthRepository, token chỉ phục vụ mô phỏng thao tác nhấn liên kết.
/// Backend thật sẽ cấp token và gửi URL qua email.
class EmailActionTicket {
  const EmailActionTicket({
    required this.email,
    required this.token,
    required this.type,
    required this.expiresAt,
  });

  final String email;
  final String token;
  final EmailActionType type;
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}
