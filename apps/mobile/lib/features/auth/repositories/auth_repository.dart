import '../../../shared/models/app_user.dart';
import '../models/email_action_ticket.dart';
import '../models/registration_result.dart';

/// Feature boundary for Auth/Profile data.
///
/// Mock and API implementations share this contract. Methods not supported by
/// the current Backend deliberately fail instead of pretending to succeed.
abstract class AuthRepository {
  Future<AppUser> login({
    required String identifier,
    required String password,
  });

  Future<RegistrationResult> register({
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
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

  /// Backend verify-email returns a message, not an AppUser or session.
  Future<void> verifyEmail({required String token});

  /// Mock repository has no persistent session; API repository overrides this.
  Future<AppUser?> restoreSession() async => null;

  /// Returns whether server-side logout was confirmed.
  Future<bool> logout() async => true;

  Future<AppUser> updateProfile({
    required String userId,
    required String fullName,
    required String? phoneNumber,
  }) async {
    throw const AuthRepositoryException(
      'Repository hiện chưa hỗ trợ cập nhật hồ sơ.',
    );
  }
}

class AuthRepositoryException implements Exception {
  const AuthRepositoryException(this.message);

  final String message;

  @override
  String toString() => message;
}
