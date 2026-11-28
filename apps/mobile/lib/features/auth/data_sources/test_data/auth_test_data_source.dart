import '../../models/email_action_ticket.dart';
import '../../models/registration_result.dart';
import '../../../../shared/models/app_user.dart';

/// Contract for Development-only Auth Test Data.
///
/// This source is selected only by the composition root. It must not be used
/// as an error fallback for failed Backend requests.
abstract interface class AuthTestDataSource {
  Future<AppUser> login({required String identifier, required String password});

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

  Future<void> verifyEmail({required String token});

  Future<AppUser> updateProfile({
    required String userId,
    required String fullName,
    required String? phoneNumber,
  });
}
