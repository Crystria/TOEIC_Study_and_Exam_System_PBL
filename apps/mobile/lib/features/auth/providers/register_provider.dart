import 'package:flutter/foundation.dart';

enum RegisterStatus { idle, loading, success, error }

class RegisterProvider extends ChangeNotifier {
  RegisterStatus status = RegisterStatus.idle;
  String? errorMessage;

  Future<void> register({
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
    required bool agreeTerms,
  }) async {
    if (!agreeTerms) {
      status = RegisterStatus.error;
      errorMessage = 'Bạn cần đồng ý điều khoản sử dụng';
      notifyListeners();
      return;
    }
    if (password != confirmPassword) {
      status = RegisterStatus.error;
      errorMessage = 'Mật khẩu xác nhận không khớp';
      notifyListeners();
      return;
    }

    status = RegisterStatus.loading;
    notifyListeners();
    await Future.delayed(
      const Duration(milliseconds: 600),
    ); // TODO: repository.register(...)
    status = RegisterStatus.success;
    notifyListeners();
  }

  Future<void> registerWithOAuth(String provider) async {
    status = RegisterStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 600)); // TODO
    status = RegisterStatus.success;
    notifyListeners();
  }
}
