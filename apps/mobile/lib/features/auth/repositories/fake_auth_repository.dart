import '../../../shared/models/app_user.dart';
import '../models/email_action_ticket.dart';
import '../models/registration_result.dart';
import 'auth_repository.dart';

/// Repository giả lập dành riêng cho phát triển và kiểm thử UI.
///
/// - Không gửi email và không gọi Backend.
/// - Token được tạo trong bộ nhớ để mô phỏng thao tác mở liên kết.
/// - Tài khoản, mật khẩu và token mất khi ứng dụng khởi động lại.
class FakeAuthRepository implements AuthRepository {
  final Map<String, _FakeAccount> _accountsByEmail = {};
  final Map<String, _PendingEmailAction> _pendingActions = {};
  int _nextUserId = 1;
  int _nextTokenId = 1;

  @override
  Future<AppUser> login({
    required String identifier,
    required String password,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));

    final normalizedIdentifier = identifier.trim().toLowerCase();
    final account = _findAccount(normalizedIdentifier);

    if (account != null) {
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

    // Hành vi đăng nhập nhanh mock được giữ lại cho identifier chưa đăng ký.
    final email = normalizedIdentifier.contains('@')
        ? normalizedIdentifier
        : '$normalizedIdentifier@demo.toeic.local';
    final accountBySyntheticEmail = _accountsByEmail[email];
    if (accountBySyntheticEmail != null) {
      if (accountBySyntheticEmail.password != password) {
        throw const AuthRepositoryException(
          'Email/tên đăng nhập hoặc mật khẩu không chính xác.',
        );
      }
      return accountBySyntheticEmail.user;
    }

    // Tạo tài khoản mock tạm trong bộ nhớ để các thao tác đổi mật khẩu
    // và đăng nhập lại có thể kiểm tra cùng một thông tin xác thực.
    final mockUser = AppUser(
      id: 'mock-login-${Uri.encodeComponent(normalizedIdentifier)}',
      fullName: _displayNameFromIdentifier(identifier.trim()),
      email: email,
      emailVerified: true,
    );
    _accountsByEmail[email] = _FakeAccount(
      user: mockUser,
      password: password,
      identifiers: {
        normalizedIdentifier,
        email,
        mockUser.fullName.toLowerCase(),
      },
    );
    return mockUser;
  }

  @override
  Future<RegistrationResult> register({
    required String fullName,
    required String email,
    required String password,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));

    final normalizedEmail = email.trim().toLowerCase();
    if (_accountsByEmail.containsKey(normalizedEmail)) {
      throw const AuthRepositoryException(
        'Email này đã được đăng ký trong phiên thử nghiệm.',
      );
    }

    final user = AppUser(
      id: 'mock-user-${_nextUserId++}',
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
  Future<AppUser> verifyEmail({required String token}) async {
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
    return account.user;
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

  String _displayNameFromIdentifier(String identifier) {
    final localPart = identifier.contains('@')
        ? identifier.split('@').first
        : identifier;
    final words = localPart
        .replaceAll(RegExp(r'[._-]+'), ' ')
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty);
    final name = words
        .map((word) => '${word[0].toUpperCase()}${word.substring(1)}')
        .join(' ');
    return name.isEmpty ? 'Học viên TOEIC' : name;
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
