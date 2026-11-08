import '../../../shared/models/app_user.dart';
import '../models/email_action_ticket.dart';
import '../models/registration_result.dart';

/// Contract cho các thao tác xác thực.
///
/// Provider chỉ điều phối trạng thái và gọi repository. Mock/Backend có thể
/// thay thế implementation mà không phải đưa logic dữ liệu vào Screen.
abstract interface class AuthRepository {
  Future<AppUser> login({required String identifier, required String password});

  Future<RegistrationResult> register({
    required String fullName,
    required String email,
    required String password,
  });

  Future<EmailActionTicket> requestPasswordReset({required String email});

  Future<EmailActionTicket> requestEmailVerification({required String email});

  Future<void> resetPassword({
    required String token,
    required String newPassword,
  });

  Future<void> changePassword({
    required String userId,
    required String currentPassword,
    required String newPassword,
  });

  Future<AppUser> verifyEmail({required String token});
}

class AuthRepositoryException implements Exception {
  const AuthRepositoryException(this.message);

  final String message;

  @override
  String toString() => message;
}
