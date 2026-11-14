// ignore_for_file: prefer_initializing_formals
import '../../../core/errors/app_exception.dart';
import '../data_sources/auth_remote_data_source.dart';
import '../data_sources/local/auth_local_data_source.dart';
import '../../../shared/models/app_user.dart';
import '../models/auth_api_dtos.dart';
import '../models/avatar_api_dtos.dart';
import '../models/email_action_ticket.dart';
import '../models/registration_result.dart';
import '../requests/auth_request_dtos.dart';
import '../services/device_id_provider.dart';
import 'auth_repository.dart';

/// Repository adapter for the Auth Service contracts available in Backend.
class ApiAuthRepository extends AuthRepository {
  ApiAuthRepository({
    required AuthRemoteDataSource remoteDataSource,
    required AuthLocalDataSource localDataSource,
    required DeviceIdProvider deviceIdProvider,
  }) : _remoteDataSource = remoteDataSource,
       _localDataSource = localDataSource,
       _deviceIdProvider = deviceIdProvider;

  final AuthRemoteDataSource _remoteDataSource;
  final AuthLocalDataSource _localDataSource;
  final DeviceIdProvider _deviceIdProvider;
  Future<void>? _refreshInFlight;
  String? _lastRefreshFromAccessToken;
  String? _lastRefreshToAccessToken;
  String? _activeUserId;
  Future<void> Function(String userId)? _sessionInvalidationHandler;

  @override
  bool get supportsProfileUpdates => true;

  @override
  bool get supportsAvatarUpload => true;

  @override
  bool get supportsPasswordChange => false;

  @override
  bool get supportsUsernameLogin => false;

  @override
  bool get supportsPasswordReset => false;

  static const Duration _refreshWindow = Duration(seconds: 30);

  /// Called when this repository has invalidated the active user's token pair.
  /// The composition root connects this to AuthSessionProvider so account
  /// scoped UI and caches are reset together with secure token storage.
  void setSessionInvalidationHandler(
    Future<void> Function(String userId) handler,
  ) {
    _sessionInvalidationHandler = handler;
  }

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
      final response = await _remoteDataSource.login(
        LoginRequestDto(email: email, password: password, deviceId: deviceId),
      );
      if (response.user.status.toUpperCase() != 'ACTIVE') {
        throw const AuthRepositoryException(
          'Tài khoản chưa kích hoạt. Vui lòng xác minh email trước khi đăng nhập.',
        );
      }
      await _saveTokenResponse(response);
      _resetRefreshMarker();
      _activeUserId = response.user.userId;
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
      final response = await _remoteDataSource.register(
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
      await _remoteDataSource.resendVerification(
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
      await _remoteDataSource.verifyEmail(
        VerifyEmailRequestDto(token: normalizedToken),
      );
    } catch (error) {
      throw _toRepositoryException(error);
    }
  }

  @override
  Future<AppUser?> restoreSession() async {
    AuthStoredTokens? sessionTokens;
    try {
      sessionTokens = await _localDataSource.readTokens();
      if (sessionTokens == null) {
        _resetRefreshMarker();
        _activeUserId = null;
        return null;
      }

      if (!sessionTokens.hasRefreshToken) {
        await _clearRestoreSessionIfStillCurrent(sessionTokens);
        return null;
      }

      final now = DateTime.now().toUtc();
      final refreshExpiry = sessionTokens.refreshTokenExpiresAt;
      if (refreshExpiry != null && !refreshExpiry.isAfter(now)) {
        await _clearRestoreSessionIfStillCurrent(sessionTokens);
        return null;
      }

      final accessExpiry = sessionTokens.accessTokenExpiresAt;
      if (accessExpiry != null &&
          !accessExpiry.isAfter(now.add(_refreshWindow))) {
        await _refreshTokensSingleFlight();
      }

      final user = await _remoteDataSource.getCurrentUser();
      if (user.status.toUpperCase() != 'ACTIVE') {
        await _clearRestoreSessionIfStillCurrent(sessionTokens);
        return null;
      }
      _activeUserId = user.userId;
      return user.toDomain();
    } on AppException catch (error) {
      if (error.isUnauthorized) {
        final expectedTokens = sessionTokens;
        if (expectedTokens != null) {
          await _clearRestoreSessionIfStillCurrent(expectedTokens);
        }
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
      final dto = await _remoteDataSource.updateCurrentUser(
        UpdateProfileRequestDto(
          fullName: fullName.trim(),
          phoneNumber: phoneNumber?.trim().isEmpty == true
              ? null
              : phoneNumber?.trim(),
          includePhoneNumber: true,
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
  Future<AppUser> updateAvatar({
    required String userId,
    required List<int> imageBytes,
    required String contentType,
  }) async {
    final normalizedContentType = contentType.trim().toLowerCase();
    if (imageBytes.isEmpty ||
        imageBytes.length > AvatarUploadConstraints.maxBytes) {
      throw const AuthRepositoryException(
        'Ảnh đại diện phải có dung lượng từ 1 byte đến 2 MiB.',
      );
    }
    if (!RegExp(r'^image/[a-z0-9][a-z0-9.+-]*$')
        .hasMatch(normalizedContentType)) {
      throw const AuthRepositoryException(
        'Định dạng tệp ảnh đại diện không hợp lệ.',
      );
    }
    final uploadBytes = List<int>.unmodifiable(imageBytes);
    if (uploadBytes.any((byte) => byte < 0 || byte > 255)) {
      throw const AuthRepositoryException(
        'Dữ liệu ảnh đại diện chứa byte không hợp lệ.',
      );
    }

    try {
      final tokens = await _localDataSource.readTokens();
      if (tokens == null || _activeUserId != userId) {
        throw const AuthRepositoryException(
          'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
        );
      }

      final ticket = await _remoteDataSource.presignAvatar(
        AvatarPresignRequestDto(
          contentType: normalizedContentType,
          sizeBytes: uploadBytes.length,
        ),
      );
      await _ensureAvatarSession(userId: userId, snapshot: tokens);
      await _remoteDataSource.uploadAvatar(
        ticket: ticket,
        expectedContentType: normalizedContentType,
        bytes: uploadBytes,
      );
      await _ensureAvatarSession(userId: userId, snapshot: tokens);
      final confirmation = await _remoteDataSource.confirmAvatar(
        AvatarConfirmRequestDto(uploadId: ticket.uploadId),
      );
      await _ensureAvatarSession(userId: userId, snapshot: tokens);
      if (confirmation.objectKey != ticket.objectKey) {
        throw const FormatException(
          'Avatar confirm trả về objectKey không khớp upload ticket.',
        );
      }

      // Re-read the authoritative UserPresenter after confirm. It contains the
      // newly signed avatarUrl; the signed URL is not synthesized on-device.
      final currentUser = await _remoteDataSource.getCurrentUser();
      await _ensureAvatarSession(userId: userId, snapshot: tokens);
      if (currentUser.userId != userId ||
          currentUser.avatarKey != ticket.objectKey ||
          currentUser.avatarUrl == null ||
          currentUser.avatarUrl!.isEmpty) {
        throw const FormatException(
          'Backend chưa xác nhận ảnh đại diện cho tài khoản hiện tại.',
        );
      }
      return currentUser.toDomain();
    } catch (error) {
      throw _toRepositoryException(error);
    }
  }

  Future<void> _ensureAvatarSession({
    required String userId,
    required AuthStoredTokens snapshot,
  }) async {
    final latest = await _localDataSource.readTokens();
    final accessTokenUnchanged = latest?.accessToken == snapshot.accessToken;
    final accessTokenRotatedByThisRepository =
        latest != null &&
        _lastRefreshFromAccessToken == snapshot.accessToken &&
        _lastRefreshToAccessToken == latest.accessToken;

    if (latest == null ||
        (!accessTokenUnchanged && !accessTokenRotatedByThisRepository) ||
        _activeUserId != userId) {
      throw const AuthRepositoryException(
        'Tài khoản đã thay đổi trong lúc cập nhật ảnh đại diện. Vui lòng thử lại.',
      );
    }
  }

  @override
  Future<bool> logout() async {
    var serverConfirmed = false;
    String? accessTokenToClear;
    AuthStoredTokens? tokensAtLogoutStart;
    final userIdAtStart = _activeUserId;

    try {
      final initialTokens = await _localDataSource.readTokens();
      tokensAtLogoutStart = initialTokens;
      if (initialTokens == null) {
        serverConfirmed = true;
        if (_activeUserId == userIdAtStart) _activeUserId = null;
      } else if (!initialTokens.hasRefreshToken) {
        // No refresh credential exists to revoke remotely. Clear only the
        // exact access-token pair observed at logout start.
        accessTokenToClear = initialTokens.accessToken;
        serverConfirmed = true;
      } else {
        accessTokenToClear = await _withAuthRefresh<String?>(() async {
          final latest = await _localDataSource.readTokens();
          if (latest == null ||
              !latest.hasRefreshToken ||
              !_belongsToLogoutSession(initialTokens, latest)) {
            return null;
          }
          final requestAccessToken = latest.accessToken;
          await _remoteDataSource.logout(
            RefreshRequestDto(refreshToken: latest.refreshToken!),
          );
          return requestAccessToken;
        });
        serverConfirmed = accessTokenToClear != null;
      }
    } catch (_) {
      serverConfirmed = false;
    }

    // Even when Backend revoke fails, forget the exact local session observed
    // at logout start. A newer login is protected by the session comparison
    // and the conditional token delete below.
    if (accessTokenToClear == null && tokensAtLogoutStart != null) {
      try {
        final latestTokens = await _localDataSource.readTokens();
        if (latestTokens != null &&
            _belongsToLogoutSession(tokensAtLogoutStart, latestTokens)) {
          accessTokenToClear = latestTokens.accessToken;
        }
      } catch (_) {
        serverConfirmed = false;
      }
    }

    if (accessTokenToClear != null) {
      try {
        final cleared = await _clearTokensIfAccessTokenMatches(
          accessTokenToClear,
        );
        if (cleared && _activeUserId == userIdAtStart) {
          _activeUserId = null;
        }
      } catch (_) {
        serverConfirmed = false;
      }
    }

    return serverConfirmed;
  }

  bool _belongsToLogoutSession(
    AuthStoredTokens initialTokens,
    AuthStoredTokens latestTokens,
  ) {
    if (initialTokens.refreshToken == latestTokens.refreshToken) {
      return true;
    }
    return _lastRefreshFromAccessToken == initialTokens.accessToken &&
        _lastRefreshToAccessToken == latestTokens.accessToken;
  }

  Future<bool> _clearRestoreSessionIfStillCurrent(
    AuthStoredTokens expectedTokens,
  ) async {
    final latest = await _localDataSource.readTokens();
    if (latest == null) return true;

    final sameSession =
        latest.accessToken == expectedTokens.accessToken ||
        (expectedTokens.refreshToken != null &&
            latest.refreshToken == expectedTokens.refreshToken) ||
        (_lastRefreshFromAccessToken == expectedTokens.accessToken &&
            _lastRefreshToAccessToken == latest.accessToken);
    if (!sameSession) return false;

    final cleared = await _clearTokensIfAccessTokenMatches(latest.accessToken);
    if (cleared) _activeUserId = null;
    return cleared;
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

  /// Shared ApiClient callback for authenticated requests rejected with 401.
  /// Returns the exact rotated access token when one retry is safe, or null
  /// when no usable session exists. Network/server refresh failures propagate
  /// instead of being disguised as the original 401.
  Future<String?> refreshAfterUnauthorized(String failedAccessToken) async {
    final current = await _localDataSource.readTokens();
    if (current == null) return null;

    // Retry only when this exact access token was rotated by this repository.
    // A login/account switch must not replay an old user's request as a new user.
    if (current.accessToken != failedAccessToken) {
      return _lastRefreshFromAccessToken == failedAccessToken &&
              _lastRefreshToAccessToken == current.accessToken
          ? current.accessToken
          : null;
    }

    final expectedUserId = _activeUserId;
    if (!current.hasRefreshToken) {
      final cleared = await _clearTokensIfAccessTokenMatches(failedAccessToken);
      if (cleared) await _invalidateSessionIfCurrent(expectedUserId);
      return null;
    }

    try {
      await _refreshTokensSingleFlight();
      final latest = await _localDataSource.readTokens();
      if (latest == null ||
          _lastRefreshFromAccessToken != failedAccessToken ||
          _lastRefreshToAccessToken != latest.accessToken) {
        return null;
      }
      return latest.accessToken;
    } on AppException catch (error) {
      if (error.isUnauthorized) {
        await _invalidateSessionIfTokenPairWasCleared(expectedUserId);
        return null;
      }
      rethrow;
    }
  }

  /// Clears only the credential pair rejected after the one refresh retry.
  /// A concurrent login/account switch is never cleared by an old request.
  Future<void> clearRejectedSessionIfCurrent(String rejectedAccessToken) async {
    final expectedUserId = _activeUserId;
    final cleared = await _clearTokensIfAccessTokenMatches(rejectedAccessToken);
    if (cleared) {
      await _invalidateSessionIfCurrent(expectedUserId);
    }
  }

  Future<T> _withAuthRefresh<T>(Future<T> Function() request) async {
    final accessTokenBeforeRequest = await _localDataSource.readAccessToken();
    try {
      return await request();
    } on AppException catch (error) {
      if (!error.isUnauthorized) rethrow;

      final latest = await _localDataSource.readTokens();
      if (latest == null || !latest.hasRefreshToken) rethrow;

      // A parallel request may already have rotated the token pair.
      if (latest.accessToken == accessTokenBeforeRequest) {
        await _refreshTokensSingleFlight();
      }
      // Retry once only. If the refreshed token is rejected too, discard the
      // unusable token pair so the next startup cannot restore a dead session.
      final accessTokenForRetry = await _localDataSource.readAccessToken();
      try {
        return await request();
      } on AppException catch (retryError) {
        if (retryError.isUnauthorized && accessTokenForRetry != null) {
          final expectedUserId = _activeUserId;
          final cleared = await _clearTokensIfAccessTokenMatches(
            accessTokenForRetry,
          );
          if (cleared) {
            await _invalidateSessionIfCurrent(expectedUserId);
          }
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
    final current = await _localDataSource.readTokens();
    if (current == null || !current.hasRefreshToken) {
      throw const AppException.unauthorized();
    }

    final expiry = current.refreshTokenExpiresAt;
    if (expiry != null && !expiry.isAfter(DateTime.now().toUtc())) {
      await _clearTokensIfRefreshTokenMatches(current.refreshToken!);
      throw const AppException.unauthorized(
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }

    try {
      final next = await _remoteDataSource.refresh(
        RefreshRequestDto(refreshToken: current.refreshToken!),
      );
      final now = DateTime.now().toUtc();
      final replaced = await _localDataSource
          .replaceTokensIfRefreshTokenMatches(
            expectedRefreshToken: current.refreshToken!,
            accessToken: next.accessToken,
            refreshToken: next.refreshToken,
            accessTokenExpiresAt: now.add(Duration(seconds: next.expiresIn)),
            refreshTokenExpiresAt: now.add(
              Duration(seconds: next.refreshExpiresIn),
            ),
          );
      if (!replaced) {
        // A different login/session has replaced this credential while the
        // refresh request was in flight. The local data-source compare-and-set
        // prevents this late response from overwriting that newer session.
        return;
      }
      _lastRefreshFromAccessToken = current.accessToken;
      _lastRefreshToAccessToken = next.accessToken;
    } on AppException catch (error) {
      if (error.isUnauthorized) {
        await _clearTokensIfRefreshTokenMatches(current.refreshToken!);
      }
      rethrow;
    }
  }

  Future<bool> _clearTokensIfRefreshTokenMatches(
    String expectedRefreshToken,
  ) async {
    final cleared = await _localDataSource.clearTokensIfRefreshTokenMatches(
      expectedRefreshToken,
    );
    if (cleared) _resetRefreshMarker();
    return cleared;
  }

  Future<bool> _clearTokensIfAccessTokenMatches(
    String expectedAccessToken,
  ) async {
    final cleared = await _localDataSource.clearTokensIfAccessTokenMatches(
      expectedAccessToken,
    );
    if (cleared) _resetRefreshMarker();
    return cleared;
  }

  Future<void> _invalidateSessionIfTokenPairWasCleared(
    String? expectedUserId,
  ) async {
    if (expectedUserId == null || _activeUserId != expectedUserId) return;
    final latest = await _localDataSource.readTokens();
    if (latest == null && _activeUserId == expectedUserId) {
      _activeUserId = null;
      await _sessionInvalidationHandler?.call(expectedUserId);
    }
  }

  Future<void> _invalidateSessionIfCurrent(String? expectedUserId) async {
    if (expectedUserId == null || _activeUserId != expectedUserId) return;
    final latest = await _localDataSource.readTokens();
    if (latest != null || _activeUserId != expectedUserId) return;
    _activeUserId = null;
    await _sessionInvalidationHandler?.call(expectedUserId);
  }

  void _resetRefreshMarker() {
    _lastRefreshFromAccessToken = null;
    _lastRefreshToAccessToken = null;
  }

  Future<void> _saveTokenResponse(AuthTokenResponseDto response) async {
    final now = DateTime.now().toUtc();
    await _localDataSource.saveTokens(
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
    if (error is AuthLocalDataSourceException) {
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
