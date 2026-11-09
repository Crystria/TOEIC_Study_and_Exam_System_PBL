// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../../../shared/models/app_user.dart';
import '../repositories/auth_repository.dart';

enum LoginStatus { idle, loading, success, error }

class LoginProvider extends ChangeNotifier {
  LoginProvider({required AuthRepository repository})
    : _repository = repository;

  final AuthRepository _repository;

  LoginStatus status = LoginStatus.idle;
  String? errorMessage;

  bool get isLoading => status == LoginStatus.loading;

  Future<AppUser?> login(String identifier, String password) async {
    if (isLoading) return null;

    final normalizedIdentifier = identifier.trim();
    if (normalizedIdentifier.isEmpty || password.isEmpty) {
      _setError('Vui lòng nhập email/tên đăng nhập và mật khẩu.');
      return null;
    }

    status = LoginStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      final user = await _repository.login(
        identifier: normalizedIdentifier,
        password: password,
      );
      status = LoginStatus.success;
      notifyListeners();
      return user;
    } on AuthRepositoryException catch (error) {
      _setError(error.message);
    } catch (_) {
      _setError('Không thể đăng nhập lúc này. Vui lòng thử lại.');
    }

    return null;
  }

  Future<AppUser?> loginWithOAuth(String provider) {
    _setError(
      'Đăng nhập ${_providerLabel(provider)} chưa được tích hợp. '
      'Vui lòng sử dụng email và mật khẩu.',
    );
    return Future<AppUser?>.value(null);
  }

  void reset() {
    status = LoginStatus.idle;
    errorMessage = null;
    notifyListeners();
  }

  void _setError(String message) {
    status = LoginStatus.error;
    errorMessage = message;
    notifyListeners();
  }

  String _providerLabel(String provider) {
    switch (provider.toLowerCase()) {
      case 'google':
        return 'Google';
      case 'facebook':
        return 'Facebook';
      default:
        return provider;
    }
  }
}
