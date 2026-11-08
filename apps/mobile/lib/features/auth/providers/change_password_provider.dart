import 'package:flutter/foundation.dart';

import '../repositories/auth_repository.dart';

enum ChangePasswordStatus { idle, loading, success, error }

/// Điều phối nghiệp vụ đổi mật khẩu cho User đang đăng nhập.
class ChangePasswordProvider extends ChangeNotifier {
  ChangePasswordProvider({required AuthRepository repository})
    : _repository = repository;

  final AuthRepository _repository;

  ChangePasswordStatus status = ChangePasswordStatus.idle;
  String? errorMessage;

  bool get isLoading => status == ChangePasswordStatus.loading;
  bool get isSuccess => status == ChangePasswordStatus.success;

  Future<bool> changePassword({
    required String userId,
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    if (isLoading) return false;

    if (userId.trim().isEmpty) {
      _setError('Không xác định được tài khoản đang đăng nhập.');
      return false;
    }
    if (currentPassword.isEmpty) {
      _setError('Vui lòng nhập mật khẩu hiện tại.');
      return false;
    }
    if (!_isStrongEnoughPassword(newPassword)) {
      _setError(
        'Mật khẩu mới cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.',
      );
      return false;
    }
    if (newPassword == currentPassword) {
      _setError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return false;
    }
    if (newPassword != confirmPassword) {
      _setError('Mật khẩu xác nhận không khớp.');
      return false;
    }

    status = ChangePasswordStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      await _repository.changePassword(
        userId: userId,
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
      status = ChangePasswordStatus.success;
      notifyListeners();
      return true;
    } on AuthRepositoryException catch (error) {
      _setError(error.message);
    } catch (_) {
      _setError('Không thể đổi mật khẩu lúc này. Vui lòng thử lại.');
    }
    return false;
  }

  void reset() {
    status = ChangePasswordStatus.idle;
    errorMessage = null;
    notifyListeners();
  }

  bool _isStrongEnoughPassword(String value) {
    return value.length >= 8 &&
        RegExp(r'[A-Z]').hasMatch(value) &&
        RegExp(r'[a-z]').hasMatch(value) &&
        RegExp(r'\d').hasMatch(value);
  }

  void _setError(String message) {
    status = ChangePasswordStatus.error;
    errorMessage = message;
    notifyListeners();
  }
}
