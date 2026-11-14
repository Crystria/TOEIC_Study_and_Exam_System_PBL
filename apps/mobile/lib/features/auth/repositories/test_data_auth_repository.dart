import '../../../shared/models/app_user.dart';
import '../data_sources/test_data/auth_test_data_source.dart';
import '../data_sources/test_data/test_data_auth_data_source.dart';
import '../models/email_action_ticket.dart';
import '../models/registration_result.dart';
import 'auth_repository.dart';

/// Repository adapter for Development-only Auth Test Data.
class TestDataAuthRepository extends AuthRepository {
  TestDataAuthRepository({AuthTestDataSource? dataSource})
    : _dataSource = dataSource ?? TestDataAuthDataSource();

  final AuthTestDataSource _dataSource;

  @override
  bool get supportsProfileUpdates => true;

  @override
  bool get supportsPasswordChange => true;

  @override
  bool get supportsUsernameLogin => true;

  @override
  bool get supportsPasswordReset => true;

  @override
  Future<AppUser> login({
    required String identifier,
    required String password,
  }) => _dataSource.login(identifier: identifier, password: password);

  @override
  Future<RegistrationResult> register({
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
  }) => _dataSource.register(
    fullName: fullName,
    email: email,
    password: password,
    confirmPassword: confirmPassword,
  );

  @override
  Future<EmailActionTicket> requestPasswordReset({required String email}) =>
      _dataSource.requestPasswordReset(email: email);

  @override
  Future<EmailActionTicket> requestEmailVerification({required String email}) =>
      _dataSource.requestEmailVerification(email: email);

  @override
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) => _dataSource.resetPassword(token: token, newPassword: newPassword);

  @override
  Future<void> changePassword({
    required String userId,
    required String currentPassword,
    required String newPassword,
  }) => _dataSource.changePassword(
    userId: userId,
    currentPassword: currentPassword,
    newPassword: newPassword,
  );

  @override
  Future<void> verifyEmail({required String token}) =>
      _dataSource.verifyEmail(token: token);

  @override
  Future<AppUser> updateProfile({
    required String userId,
    required String fullName,
    required String? phoneNumber,
  }) => _dataSource.updateProfile(
    userId: userId,
    fullName: fullName,
    phoneNumber: phoneNumber,
  );
}
