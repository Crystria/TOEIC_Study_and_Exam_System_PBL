import 'package:flutter/foundation.dart';

enum ForgotPasswordStatus { idle, loading, sent, error }

class ForgotPasswordProvider extends ChangeNotifier {
  ForgotPasswordStatus status = ForgotPasswordStatus.idle;
  String? errorMessage;
  String? sentEmail;

  Future<void> sendResetLink(String email) async {
    if (!email.contains('@')) {
      status = ForgotPasswordStatus.error;
      errorMessage = 'Email không hợp lệ';
      notifyListeners();
      return;
    }
    status = ForgotPasswordStatus.loading;
    notifyListeners();
    await Future.delayed(
      const Duration(milliseconds: 500),
    ); // TODO: repository.requestPasswordReset(email)
    sentEmail = email;
    status = ForgotPasswordStatus
        .sent; // screen điều hướng sang CheckEmailScreen(email: sentEmail)
    notifyListeners();
  }
}
