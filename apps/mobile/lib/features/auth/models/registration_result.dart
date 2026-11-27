import '../../../shared/models/app_user.dart';
import 'email_action_ticket.dart';

/// Kết quả đăng ký: tài khoản được tạo nhưng cần xác minh email trước Login.
class RegistrationResult {
  const RegistrationResult({
    required this.user,
    required this.emailVerificationTicket,
  });

  final AppUser user;
  final EmailActionTicket emailVerificationTicket;
}
