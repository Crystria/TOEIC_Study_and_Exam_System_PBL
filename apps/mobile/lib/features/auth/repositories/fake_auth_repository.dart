import 'dart:math';

import '../../../shared/models/app_user.dart';
import '../models/email_action_ticket.dart';
import '../models/registration_result.dart';
import 'auth_repository.dart';

/// Repository giả lập dành riêng cho phát triển và kiểm thử UI.
///
/// - Không gửi email và không gọi Backend.
/// - Token được tạo trong bộ nhớ để mô phỏng thao tác mở liên kết.
/// - Tài khoản, mật khẩu và token mất khi ứng dụng khởi động lại.
class FakeAuthRepository extends AuthRepository {
  final Map<String, _FakeAccount> _accountsByEmail = {};
  final Map<String, _PendingEmailAction> _pendingActions = {};
  int _nextTokenId = 1;

  @override
  Future<AppUser> login({
    required String identifier,
    required String password,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));

    final normalizedIdentifier = identifier.trim().toLowerCase();
    final account = _findAccount(normalizedIdentifier);

    if (account == null) {
      throw const AuthRepositoryException(
        'Email/tên đăng nhập hoặc mật khẩu không chính xác. '
        'Vui lòng đăng ký tài khoản trước khi đăng nhập.',
      );
    }
    if (!account.user.emailVerified) {
      throw const AuthRepositoryException(
        'Tài khoản chưa xác minh email. Vui lòng kiểm tra email trước khi đăng nhập.',
      );
    }
    if (account.password != password) {
      throw const AuthRepositoryException(
        'Email/tên đăng nhập hoặc mật khẩu không chính xác.',
      );
    }
    return account.user;
  }

  @override
  Future<RegistrationResult> register({
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));

    if (password != confirmPassword) {
      throw const AuthRepositoryException('Mật khẩu xác nhận không khớp.');
    }

    final normalizedEmail = email.trim().toLowerCase();
    if (_accountsByEmail.containsKey(normalizedEmail)) {
      throw const AuthRepositoryException(
        'Email này đã được đăng ký trong phiên thử nghiệm.',
      );
    }

    final user = AppUser(
      id: _newMockUserId(),
      fullName: fullName.trim(),
      email: normalizedEmail,
      emailVerified: false,
    );
    _accountsByEmail[normalizedEmail] = _FakeAccount(
      user: user,
      password: password,
      identifiers: {normalizedEmail, user.fullName.toLowerCase()},
    );
    final ticket = _createTicket(
      email: normalizedEmail,
      type: EmailActionType.emailVerification,
    );
    return RegistrationResult(user: user, emailVerificationTicket: ticket);
  }

  @override
  Future<EmailActionTicket> requestPasswordReset({
    required String email,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));

    final normalizedEmail = email.trim().toLowerCase();
    final account = _accountsByEmail[normalizedEmail];
    if (account == null) {
      throw const AuthRepositoryException(
        'Không tìm thấy tài khoản với email này trong dữ liệu thử nghiệm.',
      );
    }
    if (!account.user.emailVerified) {
      throw const AuthRepositoryException(
        'Email chưa được xác minh. Vui lòng hoàn tất xác minh tài khoản trước.',
      );
    }

    return _createTicket(
      email: normalizedEmail,
      type: EmailActionType.passwordReset,
    );
  }

  @override
  Future<EmailActionTicket> requestEmailVerification({
    required String email,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final normalizedEmail = email.trim().toLowerCase();
    final account = _accountsByEmail[normalizedEmail];
    if (account == null) {
      throw const AuthRepositoryException(
        'Không tìm thấy tài khoản cần xác minh trong dữ liệu thử nghiệm.',
      );
    }
    if (account.user.emailVerified) {
      throw const AuthRepositoryException('Email này đã được xác minh.');
    }
    return _createTicket(
      email: normalizedEmail,
      type: EmailActionType.emailVerification,
    );
  }

  @override
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));
    final action = _takeValidAction(
      token: token,
      expectedType: EmailActionType.passwordReset,
    );
    final account = _accountsByEmail[action.email];
    if (account == null) {
      throw const AuthRepositoryException(
        'Tài khoản không còn tồn tại. Vui lòng yêu cầu liên kết mới.',
      );
    }
    account.password = newPassword;
  }

  @override
  Future<void> changePassword({
    required String userId,
    required String currentPassword,
    required String newPassword,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));

    _FakeAccount? matchedAccount;
    for (final account in _accountsByEmail.values) {
      if (account.user.id == userId) {
        matchedAccount = account;
        break;
      }
    }

    if (matchedAccount == null) {
      throw const AuthRepositoryException(
        'Không tìm thấy thông tin xác thực của tài khoản trong phiên thử nghiệm. '
        'Vui lòng đăng nhập lại bằng tài khoản đã được tạo trong phiên hiện tại.',
      );
    }
    if (matchedAccount.password != currentPassword) {
      throw const AuthRepositoryException('Mật khẩu hiện tại không chính xác.');
    }
    if (currentPassword == newPassword) {
      throw const AuthRepositoryException(
        'Mật khẩu mới phải khác mật khẩu hiện tại.',
      );
    }

    matchedAccount.password = newPassword;
  }

  @override
  Future<void> verifyEmail({required String token}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final action = _takeValidAction(
      token: token,
      expectedType: EmailActionType.emailVerification,
    );
    final account = _accountsByEmail[action.email];
    if (account == null) {
      throw const AuthRepositoryException(
        'Không tìm thấy tài khoản cần xác minh.',
      );
    }

    account.user = account.user.copyWith(emailVerified: true);
  }

  @override
  Future<AppUser> updateProfile({
    required String userId,
    required String fullName,
    required String? phoneNumber,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));

    _FakeAccount? matchedAccount;
    String? accountEmail;
    for (final entry in _accountsByEmail.entries) {
      if (entry.value.user.id == userId) {
        matchedAccount = entry.value;
        accountEmail = entry.key;
        break;
      }
    }

    if (matchedAccount == null || accountEmail == null) {
      throw const AuthRepositoryException(
        'Không tìm thấy tài khoản cần cập nhật trong phiên thử nghiệm.',
      );
    }

    matchedAccount.user = matchedAccount.user.copyWith(
      fullName: fullName.trim(),
      phoneNumber: phoneNumber,
      clearPhoneNumber: phoneNumber == null,
    );
    matchedAccount.identifiers
      ..clear()
      ..add(accountEmail)
      ..add(matchedAccount.user.fullName.toLowerCase());

    return matchedAccount.user;
  }

  _FakeAccount? _findAccount(String identifier) {
    final byEmail = _accountsByEmail[identifier];
    if (byEmail != null) return byEmail;

    for (final account in _accountsByEmail.values) {
      if (account.identifiers.contains(identifier) ||
          account.user.fullName.toLowerCase() == identifier) {
        return account;
      }
    }
    return null;
  }

  String _newMockUserId() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes
        .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
        .join();
    return 'mock-${hex.substring(0, 8)}-'
        '${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-'
        '${hex.substring(16, 20)}-'
        '${hex.substring(20, 32)}';
  }

  EmailActionTicket _createTicket({
    required String email,
    required EmailActionType type,
  }) {
    // Chỉ giữ ticket mới nhất cho cùng email và mục đích.
    _pendingActions.removeWhere(
      (_, action) => action.email == email && action.type == type,
    );
    final token = 'mock-${type.name}-${_nextTokenId++}';
    final expiresAt = DateTime.now().add(const Duration(minutes: 30));
    final ticket = EmailActionTicket(
      email: email,
      token: token,
      type: type,
      expiresAt: expiresAt,
    );
    _pendingActions[token] = _PendingEmailAction(
      email: email,
      type: type,
      expiresAt: expiresAt,
    );
    return ticket;
  }

  _PendingEmailAction _takeValidAction({
    required String token,
    required EmailActionType expectedType,
  }) {
    final action = _pendingActions[token];
    if (action == null || action.type != expectedType) {
      throw const AuthRepositoryException(
        'Liên kết không hợp lệ hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.',
      );
    }
    if (DateTime.now().isAfter(action.expiresAt)) {
      _pendingActions.remove(token);
      throw const AuthRepositoryException(
        'Liên kết đã hết hạn. Vui lòng yêu cầu liên kết mới.',
      );
    }
    _pendingActions.remove(token);
    return action;
  }


}

class _FakeAccount {
  _FakeAccount({
    required this.user,
    required this.password,
    required this.identifiers,
  });

  AppUser user;
  String password;
  final Set<String> identifiers;
}

class _PendingEmailAction {
  const _PendingEmailAction({
    required this.email,
    required this.type,
    required this.expiresAt,
  });

  final String email;
  final EmailActionType type;
  final DateTime expiresAt;
}
