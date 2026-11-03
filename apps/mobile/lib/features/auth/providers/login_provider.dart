import 'package:flutter/foundation.dart';

enum LoginStatus { idle, loading, success, error }

class LoginProvider extends ChangeNotifier {
  LoginStatus status = LoginStatus.idle;
  String? errorMessage;

  // TODO: inject AuthRepository
  Future<void> login(String identifier, String password) async {
    status = LoginStatus.loading;
    errorMessage = null;
    notifyListeners();

    await Future.delayed(
      const Duration(milliseconds: 600),
    ); // TODO: thay bằng repository.login(...)

    if (identifier.isEmpty || password.isEmpty) {
      status = LoginStatus.error;
      errorMessage = 'Vui lòng nhập đầy đủ thông tin';
    } else {
      status = LoginStatus.success; // screen lắng nghe -> điều hướng sang Home
    }
    notifyListeners();
  }

  Future<void> loginWithOAuth(String provider) async {
    status = LoginStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 600)); // TODO: OAuth flow
    status = LoginStatus.success;
    notifyListeners();
  }

  void reset() {
    status = LoginStatus.idle;
    errorMessage = null;
  }
}
