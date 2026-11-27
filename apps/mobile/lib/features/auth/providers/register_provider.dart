// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../models/registration_result.dart';
import '../repositories/auth_repository.dart';

enum RegisterStatus { idle, loading, success, error }

class RegisterProvider extends ChangeNotifier {
  RegisterProvider({required AuthRepository repository})
    : _repository = repository;

  final AuthRepository _repository;

  RegisterStatus status = RegisterStatus.idle;
  String? errorMessage;

  bool get isLoading => status == RegisterStatus.loading;

  Future<RegistrationResult?> register({
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
    required bool agreeTerms,
  }) async {
    if (isLoading) return null;

    final normalizedName = fullName.trim();
    final normalizedEmail = email.trim();
    if (normalizedName.isEmpty) {
      _setError('Vui lòng nhập họ và tên.');
      return null;
    }
    if (!_isValidEmail(normalizedEmail)) {
      _setError('Email không hợp lệ.');
      return null;
    }
    if (!_isStrongEnoughPassword(password)) {
      _setError(
        'Mật khẩu cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.',
      );
      return null;
    }
    if (password != confirmPassword) {
      _setError('Mật khẩu xác nhận không khớp.');
      return null;
    }
    if (!agreeTerms) {
      _setError('Bạn cần đồng ý điều khoản sử dụng và chính sách bảo mật.');
      return null;
    }

    status = RegisterStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      final result = await _repository.register(
        fullName: normalizedName,
        email: normalizedEmail,
        password: password,
        confirmPassword: confirmPassword,
      );
      status = RegisterStatus.success;
      notifyListeners();
      return result;
    } on AuthRepositoryException catch (error) {
      _setError(error.message);
    } catch (_) {
      _setError('Không thể tạo tài khoản lúc này. Vui lòng thử lại.');
    }
    return null;
  }

  Future<RegistrationResult?> registerWithOAuth(String provider) {
    _setError(
      'Đăng ký bằng ${_providerLabel(provider)} chưa được tích hợp. '
      'Vui lòng sử dụng biểu mẫu đăng ký.',
    );
    return Future<RegistrationResult?>.value(null);
  }

  void reset() {
    status = RegisterStatus.idle;
    errorMessage = null;
    notifyListeners();
  }

  bool _isValidEmail(String value) {
    return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value);
  }

  bool _isStrongEnoughPassword(String value) {
    return value.length >= 8 &&
        RegExp(r'[A-Z]').hasMatch(value) &&
        RegExp(r'[a-z]').hasMatch(value) &&
        RegExp(r'\d').hasMatch(value);
  }

  void _setError(String message) {
    status = RegisterStatus.error;
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
