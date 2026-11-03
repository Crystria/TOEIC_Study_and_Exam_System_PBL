import 'package:flutter/foundation.dart';

enum ResetPasswordStatus { idle, loading, success, error }

class ResetPasswordProvider extends ChangeNotifier {
  ResetPasswordStatus status = ResetPasswordStatus.idle;
  String? errorMessage;

  Future<void> resetPassword({
    required String token,
    required String newPassword,
    required String confirmPassword,
  }) async {
    if (newPassword != confirmPassword) {
      status = ResetPasswordStatus.error;
      errorMessage = 'Mật khẩu xác nhận không khớp';
      notifyListeners();
      return;
    }
    status = ResetPasswordStatus.loading;
    notifyListeners();
    await Future.delayed(
      const Duration(milliseconds: 500),
    ); // TODO: repository.resetPassword(token, newPassword)
    status = ResetPasswordStatus
        .success; // screen điều hướng sang ResetPasswordSuccessScreen
    notifyListeners();
  }
}
