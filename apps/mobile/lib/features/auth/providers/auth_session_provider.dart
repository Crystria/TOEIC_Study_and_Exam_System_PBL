// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../core/session/user_scoped_data_coordinator.dart';
import '../../../shared/models/app_user.dart';
import '../models/auth_session.dart';
import '../repositories/auth_repository.dart';

enum AuthSessionStatus { initializing, unauthenticated, authenticated, error }

/// Application-wide authenticated user/session state.
class AuthSessionProvider extends ChangeNotifier {
  AuthSessionProvider({
    required AuthRepository repository,
    required UserScopedDataCoordinator userDataCoordinator,
  }) : _repository = repository,
       _userDataCoordinator = userDataCoordinator;

  final AuthRepository _repository;
  final UserScopedDataCoordinator _userDataCoordinator;

  AppUser? _currentUser;
  AuthSession? _currentSession;
  AuthSessionStatus _status = AuthSessionStatus.initializing;
  String? _errorMessage;
  bool _isUpdatingProfile = false;
  bool _isUpdatingAvatar = false;
  int _userRevision = 0;
  int _authTransitionRevision = 0;

  AppUser? get currentUser => _currentUser;
  String? get currentUserId => _currentUser?.id;
  AuthSession? get currentSession => _currentSession;
  AuthSessionStatus get status => _status;
  String? get errorMessage => _errorMessage;
  bool get isInitializing => _status == AuthSessionStatus.initializing;
  bool get hasCurrentUser => _currentUser != null;
  bool get hasActiveSession => _currentSession != null;
  bool get isUpdatingProfile => _isUpdatingProfile;
  bool get isUpdatingAvatar => _isUpdatingAvatar;
  bool get isAuthenticated =>
      _status == AuthSessionStatus.authenticated &&
      _currentUser != null &&
      _currentSession?.userId == _currentUser?.id;

  Future<void> restoreSession() async {
    final transitionRevision = ++_authTransitionRevision;
    _status = AuthSessionStatus.initializing;
    _errorMessage = null;
    notifyListeners();

    try {
      final user = await _repository.restoreSession();
      if (transitionRevision != _authTransitionRevision) return;

      if (user == null) {
        await _userDataCoordinator.clearCurrentUser();
        if (transitionRevision != _authTransitionRevision) return;
        _clearSessionState(AuthSessionStatus.unauthenticated);
      } else {
        await _activateUser(user, transitionRevision: transitionRevision);
        if (transitionRevision != _authTransitionRevision) return;
      }
    } on AuthRepositoryException catch (error) {
      if (transitionRevision != _authTransitionRevision) return;
      try {
        await _userDataCoordinator.clearCurrentUser();
      } catch (_) {
        // The coordinator always unbinds storage in its finally path.
      }
      if (transitionRevision != _authTransitionRevision) return;
      _clearSessionState(AuthSessionStatus.error, message: error.message);
    } catch (_) {
      if (transitionRevision != _authTransitionRevision) return;
      try {
        await _userDataCoordinator.clearCurrentUser();
      } catch (_) {
        // Fail closed even if one feature reset callback reports an error.
      }
      if (transitionRevision != _authTransitionRevision) return;
      _clearSessionState(
        AuthSessionStatus.error,
        message: 'Không thể khôi phục phiên đăng nhập. Vui lòng thử lại.',
      );
    }
    if (transitionRevision == _authTransitionRevision) notifyListeners();
  }

  /// Called by LoginScreen after the repository has authenticated the user.
  Future<void> setCurrentUser(AppUser user) async {
    final transitionRevision = ++_authTransitionRevision;
    try {
      await _activateUser(user, transitionRevision: transitionRevision);
      if (transitionRevision != _authTransitionRevision) return;
      notifyListeners();
    } catch (_) {
      // A failed older login must never clear credentials or user state that
      // belongs to a newer authentication transition.
      if (transitionRevision != _authTransitionRevision) return;
      try {
        await _repository.logout();
      } catch (_) {
        // The local credential clear is attempted by the API repository.
      }
      if (transitionRevision != _authTransitionRevision) return;
      try {
        await _userDataCoordinator.clearCurrentUser();
      } catch (_) {
        // The provider still fails closed below.
      }
      if (transitionRevision != _authTransitionRevision) return;
      _clearSessionState(
        AuthSessionStatus.error,
        message:
            'Không thể khởi tạo dữ liệu cho tài khoản. Vui lòng đăng nhập lại.',
      );
      notifyListeners();
      rethrow;
    }
  }

  Future<AppUser?> updateProfile({
    required String fullName,
    required String? phoneNumber,
  }) async {
    final previousUser = _currentUser;
    if (previousUser == null || !isAuthenticated) {
      _errorMessage = 'Phiên đăng nhập không còn hợp lệ.';
      notifyListeners();
      return null;
    }
    if (_isUpdatingProfile || _isUpdatingAvatar) return null;

    final revision = _userRevision;
    _isUpdatingProfile = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final updatedUser = await _repository.updateProfile(
        userId: previousUser.id,
        fullName: fullName,
        phoneNumber: phoneNumber,
      );
      if (revision != _userRevision || _currentUser?.id != previousUser.id) {
        return null;
      }
      _currentUser = updatedUser;
      return updatedUser;
    } on AuthRepositoryException catch (error) {
      if (revision != _userRevision) return null;
      _errorMessage = error.message;
      return null;
    } catch (_) {
      if (revision != _userRevision) return null;
      _errorMessage = 'Không thể cập nhật thông tin cá nhân. Vui lòng thử lại.';
      return null;
    } finally {
      // A completion from a previous account must not change the loading state
      // of a profile operation started by the newly authenticated account.
      if (revision == _userRevision) {
        _isUpdatingProfile = false;
        notifyListeners();
      }
    }
  }

  /// Updates the authenticated user's avatar through the configured
  /// AuthRepository. A late response from a previous account is discarded.
  Future<AppUser?> updateAvatar({
    required List<int> imageBytes,
    required String contentType,
  }) async {
    final previousUser = _currentUser;
    if (previousUser == null || !isAuthenticated) {
      _errorMessage = 'Phiên đăng nhập không còn hợp lệ.';
      notifyListeners();
      return null;
    }
    if (_isUpdatingAvatar || _isUpdatingProfile) return null;

    final revision = _userRevision;
    _isUpdatingAvatar = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final updatedUser = await _repository.updateAvatar(
        userId: previousUser.id,
        imageBytes: imageBytes,
        contentType: contentType,
      );
      if (revision != _userRevision ||
          _currentUser?.id != previousUser.id ||
          !isAuthenticated) {
        return null;
      }
      if (updatedUser.id != previousUser.id) {
        throw const AuthRepositoryException(
          'Backend trả về ảnh đại diện không thuộc tài khoản hiện tại.',
        );
      }
      _currentUser = updatedUser;
      return updatedUser;
    } on AuthRepositoryException catch (error) {
      if (revision != _userRevision) return null;
      _errorMessage = error.message;
      return null;
    } catch (_) {
      if (revision != _userRevision) return null;
      _errorMessage = 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.';
      return null;
    } finally {
      // A completion from an older account must not clear the loading state
      // of an avatar upload started by the newly authenticated account.
      if (revision == _userRevision) {
        _isUpdatingAvatar = false;
        notifyListeners();
      }
    }
  }

  /// Clears the local account scope before waiting for the remote revoke.
  /// A slow/offline Backend must not leave the previous user's app state active.
  Future<bool> logout() async {
    // Invalidate pending restore/login work, remove the active user from UI
    // state immediately, then reset local feature state before Backend revoke.
    _authTransitionRevision++;
    _clearSessionState(AuthSessionStatus.unauthenticated);
    notifyListeners();

    var localResetConfirmed = true;
    try {
      await _userDataCoordinator.clearCurrentUser();
    } catch (_) {
      // The coordinator still unbinds storage in its finally path.
      localResetConfirmed = false;
    }

    var serverConfirmed = false;
    try {
      serverConfirmed = await _repository.logout();
    } catch (_) {
      serverConfirmed = false;
    }

    return localResetConfirmed && serverConfirmed;
  }

  /// Invalidates the active UI session after ApiAuthRepository has confirmed
  /// that the matching user's token pair is no longer usable.
  /// A late 401 from an older account cannot sign out a newer account.
  Future<void> invalidateSessionForUser(String userId) async {
    if (_currentUser?.id != userId) return;

    _authTransitionRevision++;
    _clearSessionState(AuthSessionStatus.unauthenticated);
    notifyListeners();

    try {
      await _userDataCoordinator.clearCurrentUser();
    } catch (_) {
      // The coordinator still unbinds storage in its finally path.
    }
  }

  /// Compatibility path for callers that only need to clear local state.
  /// New logout flows must use [logout] so token storage is also cleared.
  Future<void> clearCurrentUser() async {
    final transitionRevision = ++_authTransitionRevision;
    await _userDataCoordinator.clearCurrentUser();
    if (transitionRevision != _authTransitionRevision) return;
    _clearSessionState(AuthSessionStatus.unauthenticated);
    notifyListeners();
  }

  Future<void> _activateUser(
    AppUser user, {
    required int transitionRevision,
  }) async {
    final isSameActiveUser =
        _currentUser?.id == user.id &&
        _currentSession?.userId == user.id &&
        _userDataCoordinator.activeUserId == user.id;

    if (!isSameActiveUser) {
      await _userDataCoordinator.activateUser(user.id);
      if (transitionRevision != _authTransitionRevision) return;
      _userRevision++;
      _isUpdatingProfile = false;
      _isUpdatingAvatar = false;
    }
    if (transitionRevision != _authTransitionRevision) return;

    _currentUser = user;
    if (!isSameActiveUser) {
      final now = DateTime.now();
      // This is device-local metadata, not the Backend JWT sid.
      _currentSession = AuthSession(
        id: 'local-session-${now.microsecondsSinceEpoch}',
        userId: user.id,
        startedAt: now,
      );
    }
    _status = AuthSessionStatus.authenticated;
    _errorMessage = null;
  }

  void _clearSessionState(AuthSessionStatus status, {String? message}) {
    _userRevision++;
    _currentUser = null;
    _currentSession = null;
    _status = status;
    _errorMessage = message;
    _isUpdatingProfile = false;
    _isUpdatingAvatar = false;
  }
}
