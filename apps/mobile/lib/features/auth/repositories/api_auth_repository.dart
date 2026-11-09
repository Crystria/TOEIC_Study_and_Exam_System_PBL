// ignore_for_file: prefer_initializing_formals
import '../../../core/errors/app_exception.dart';
import '../../../core/storage/token_storage.dart';
import '../../../shared/models/app_user.dart';
import '../models/auth_api_dtos.dart';
import '../models/email_action_ticket.dart';
import '../models/registration_result.dart';
import '../requests/auth_request_dtos.dart';
import '../services/auth_api_service.dart';
import '../services/device_id_provider.dart';
import 'auth_repository.dart';

/// Repository adapter for the Auth Service contracts available in Backend.
class ApiAuthRepository extends AuthRepository {
  ApiAuthRepository({
    required AuthApiService apiService,
    required TokenStorage tokenStorage,
    required DeviceIdProvider deviceIdProvider,
  }) : _api = apiService,
       _tokenStorage = tokenStorage,
       _deviceIdProvider = deviceIdProvider;

  final AuthApiService _api;
  final TokenStorage _tokenStorage;
  final DeviceIdProvider _deviceIdProvider;
  Future<void>? _refreshInFlight;

  static const Duration _refreshWindow = Duration(seconds: 30);

  @override
  Future<AppUser> login({
    required String identifier,
    required String password,
  }) async {
    final email = identifier.trim().toLowerCase();
    if (!_isValidEmail(email)) {
      throw const AuthRepositoryException(
        'Backend yêu cầu đăng nhập bằng địa chỉ email hợp lệ.',
      );
    }

    try {
      final deviceId = await _deviceIdProvider.getOrCreate();
      final response = await _api.login(
        LoginRequestDto(
          email: email,
          password: password,
          deviceId: deviceId,
        ),
      );
      if (response.user.status.toUpperCase() != 'ACTIVE') {
        throw const AuthRepositoryException(
          'Tài khoản chưa kích hoạt. Vui lòng xác minh email trước khi đăng nhập.',
        );
      }
      await _saveTokenResponse(response);
      return response.user.toDomain();
    } catch (error) {
      throw _toRepositoryException(error);
    }
  }

  @override
  Future<RegistrationResult> register({
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
  }) async {
    if (password != confirmPassword) {
      throw const AuthRepositoryException('Mật khẩu xác nhận không khớp.');
    }

    try {
      final response = await _api.register(
        RegisterRequestDto(
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password: password,
          confirmPassword: confirmPassword,
        ),
      );

      if (!response.activationRequired) {
        throw const AuthRepositoryException(
          'Backend trả về trạng thái đăng ký không được hỗ trợ. '
          'Không thể tạo phiên đăng nhập tự động.',
        );
      }

      return RegistrationResult(
        user: response.user.toDomain(),
        emailVerificationTicket: EmailActionTicket(
          email: response.user.email,
          type: EmailActionType.emailVerification,
        ),
      );
    } catch (error) {
      throw _toRepositoryException(error);
    }
  }

  @override
  Future<EmailActionTicket> requestEmailVerification({
    required String email,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    try {
      await _api.resendVerification(
        ResendVerificationRequestDto(email: normalizedEmail),
      );
      return EmailActionTicket(
        email: normalizedEmail,
        type: EmailActionType.emailVerification,
      );
    } catch (error) {
      throw _toRepositoryException(error);
    }
  }

  @override
  Future<void> verifyEmail({required String token}) async {
    final normalizedToken = token.trim();
    if (normalizedToken.isEmpty) {
      throw const AuthRepositoryException('Token xác minh email không hợp lệ.');
    }
    try {
      await _api.verifyEmail(VerifyEmailRequestDto(token: normalizedToken));
    } catch (error) {
      throw _toRepositoryException(error);
    }
  }

  @override
  Future<AppUser?> restoreSession() async {
    try {
      final tokens = await _tokenStorage.readTokens();
      if (tokens == null) return null;

      if (!tokens.hasRefreshToken) {
        await _tokenStorage.clearTokens();
        return null;
      }

      final now = DateTime.now().toUtc();
      final refreshExpiry = tokens.refreshTokenExpiresAt;
      if (refreshExpiry != null && !refreshExpiry.isAfter(now)) {
        await _tokenStorage.clearTokens();
        return null;
      }

      final accessExpiry = tokens.accessTokenExpiresAt;
      if (accessExpiry != null &&
          !accessExpiry.isAfter(now.add(_refreshWindow))) {
        await _refreshTokensSingleFlight();
      }

      final user = await _withAuthRefresh(_api.getCurrentUser);
      if (user.status.toUpperCase() != 'ACTIVE') {
        await _tokenStorage.clearTokens();
        return null;
      }
      return user.toDomain();
    } on AppException catch (error) {
      if (error.isUnauthorized) {
        await _tokenStorage.clearTokens();
        return null;
      }
      throw _toRepositoryException(error);
    } catch (error) {
      throw _toRepositoryException(error);
    }
  }

  @override
  Future<AppUser> updateProfile({
    required String userId,
    required String fullName,
    required String? phoneNumber,
  }) async {
    try {
      final dto = await _withAuthRefresh(
        () => _api.updateCurrentUser(
          UpdateProfileRequestDto(
            fullName: fullName.trim(),
            phoneNumber: phoneNumber?.trim().isEmpty == true
                ? null
                : phoneNumber?.trim(),
          ),
        ),
      );
      if (dto.userId != userId) {
        throw const AuthRepositoryException(
          'Backend trả về hồ sơ không khớp với tài khoản đang đăng nhập.',
        );
      }
      return dto.toDomain();
    } catch (error) {
      throw _toRepositoryException(error);
    }
  }

  @override
  Future<bool> logout() async {
    var serverConfirmed = false;
    try {
      final tokens = await _tokenStorage.readTokens();
      if (tokens == null || !tokens.hasRefreshToken) {
        serverConfirmed = true;
      } else {
        await _withAuthRefresh(() async {
          final latest = await _tokenStorage.readTokens();
          final refreshToken = latest?.refreshToken;
          if (refreshToken == null) return;
          await _api.logout(RefreshRequestDto(refreshToken: refreshToken));
        });
        serverConfirmed = true;
      }
    } catch (_) {
      serverConfirmed = false;
    }

    try {
      await _tokenStorage.clearTokens();
    } catch (_) {
      serverConfirmed = false;
    }
    return serverConfirmed;
  }

  @override
  Future<EmailActionTicket> requestPasswordReset({
    required String email,
  }) async {
    throw const AuthRepositoryException(
      'Backend hiện chưa cung cấp API đặt lại mật khẩu.',
    );
  }

  @override
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    throw const AuthRepositoryException(
      'Backend hiện chưa cung cấp API đặt lại mật khẩu.',
    );
  }

  @override
  Future<void> changePassword({
    required String userId,
    required String currentPassword,
    required String newPassword,
  }) async {
    throw const AuthRepositoryException(
      'Backend hiện chưa cung cấp API đổi mật khẩu.',
    );
  }

  Future<T> _withAuthRefresh<T>(Future<T> Function() request) async {
    final accessTokenBeforeRequest = await _tokenStorage.readAccessToken();
    try {
      return await request();
    } on AppException catch (error) {
      if (!error.isUnauthorized) rethrow;

      final latest = await _tokenStorage.readTokens();
      if (latest == null || !latest.hasRefreshToken) rethrow;

      // A parallel request may already have rotated the token pair.
      if (latest.accessToken == accessTokenBeforeRequest) {
        await _refreshTokensSingleFlight();
      }
      // Retry once only. If the refreshed token is rejected too, discard the
      // unusable token pair so the next startup cannot restore a dead session.
      try {
        return await request();
      } on AppException catch (retryError) {
        if (retryError.isUnauthorized) {
          await _tokenStorage.clearTokens();
        }
        rethrow;
      }
    }
  }

  Future<void> _refreshTokensSingleFlight() {
    final pending = _refreshInFlight;
    if (pending != null) return pending;

    final refresh = _refreshTokens();
    _refreshInFlight = refresh;
    return refresh.whenComplete(() {
      if (identical(_refreshInFlight, refresh)) _refreshInFlight = null;
    });
  }

  Future<void> _refreshTokens() async {
    final current = await _tokenStorage.readTokens();
    if (current == null || !current.hasRefreshToken) {
      throw const AppException.unauthorized();
    }

    final expiry = current.refreshTokenExpiresAt;
    if (expiry != null && !expiry.isAfter(DateTime.now().toUtc())) {
      await _tokenStorage.clearTokens();
      throw const AppException.unauthorized(
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    try {
      final next = await _api.refresh(
        RefreshRequestDto(refreshToken: current.refreshToken!),
      );
      final latest = await _tokenStorage.readTokens();
      if (latest?.refreshToken != current.refreshToken) {
        // A different login/session has replaced this credential while the
        // refresh request was in flight. Never overwrite that newer account.
        return;
      }
      await _saveTokenResponse(next);
    } on AppException catch (error) {
      if (error.isUnauthorized) await _tokenStorage.clearTokens();
      rethrow;
    }
  }

  Future<void> _saveTokenResponse(AuthTokenResponseDto response) async {
    final now = DateTime.now().toUtc();
    await _tokenStorage.saveTokens(
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      accessTokenExpiresAt: now.add(Duration(seconds: response.expiresIn)),
      refreshTokenExpiresAt: now.add(
        Duration(seconds: response.refreshExpiresIn),
      ),
    );
  }

  bool _isValidEmail(String value) =>
      RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value);

  AuthRepositoryException _toRepositoryException(Object error) {
    if (error is AuthRepositoryException) return error;
    if (error is AppException) return AuthRepositoryException(error.message);
    if (error is TokenStorageException) {
      return AuthRepositoryException(error.message);
    }
    if (error is FormatException) {
      return const AuthRepositoryException(
        'Dữ liệu Auth nhận được từ máy chủ không hợp lệ.',
      );
    }
    return const AuthRepositoryException(
      'Không thể hoàn tất thao tác Auth/Profile. Vui lòng thử lại.',
    );
  }
}
