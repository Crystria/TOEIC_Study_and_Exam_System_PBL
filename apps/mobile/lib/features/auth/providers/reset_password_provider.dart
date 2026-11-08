import 'package:flutter/foundation.dart';

import '../repositories/auth_repository.dart';

enum ResetPasswordStatus { idle, loading, success, error }

class ResetPasswordProvider extends ChangeNotifier {
  ResetPasswordProvider({required AuthRepository repository})
    : _repository = repository;

  final AuthRepository _repository;

  ResetPasswordStatus status = ResetPasswordStatus.idle;
  String? errorMessage;

  bool get isLoading => status == ResetPasswordStatus.loading;

  Future<bool> resetPassword({
    required String token,
    required String newPassword,
    required String confirmPassword,
  }) async {
    if (isLoading) return false;

    if (token.trim().isEmpty) {
      _setError('Liên kết đặt lại mật khẩu không hợp lệ.');
      return false;
    }
    if (!_isStrongEnoughPassword(newPassword)) {
      _setError(
        'Mật khẩu cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.',
      );
      return false;
    }
    if (newPassword != confirmPassword) {
      _setError('Mật khẩu xác nhận không khớp.');
      return false;
    }

    status = ResetPasswordStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      await _repository.resetPassword(token: token, newPassword: newPassword);
      status = ResetPasswordStatus.success;
      notifyListeners();
      return true;
    } on AuthRepositoryException catch (error) {
      _setError(error.message);
    } catch (_) {
      _setError('Không thể cập nhật mật khẩu lúc này. Vui lòng thử lại.');
    }
    return false;
  }

  void reset() {
    status = ResetPasswordStatus.idle;
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
    status = ResetPasswordStatus.error;
    errorMessage = message;
    notifyListeners();
  }
}
