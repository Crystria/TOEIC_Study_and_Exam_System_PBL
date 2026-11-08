import 'package:flutter/foundation.dart';

import '../models/email_action_ticket.dart';
import '../repositories/auth_repository.dart';

enum ForgotPasswordStatus { idle, loading, sent, error }

class ForgotPasswordProvider extends ChangeNotifier {
  ForgotPasswordProvider({required AuthRepository repository})
    : _repository = repository;

  final AuthRepository _repository;

  ForgotPasswordStatus status = ForgotPasswordStatus.idle;
  String? errorMessage;
  String? sentEmail;
  EmailActionTicket? ticket;

  bool get isLoading => status == ForgotPasswordStatus.loading;

  Future<EmailActionTicket?> sendResetLink(String email) async {
    if (isLoading) return null;

    final normalizedEmail = email.trim();
    if (!_isValidEmail(normalizedEmail)) {
      _setError('Email không hợp lệ.');
      return null;
    }

    status = ForgotPasswordStatus.loading;
    errorMessage = null;
    sentEmail = null;
    ticket = null;
    notifyListeners();

    try {
      final result = await _repository.requestPasswordReset(
        email: normalizedEmail,
      );
      ticket = result;
      sentEmail = result.email;
      status = ForgotPasswordStatus.sent;
      notifyListeners();
      return result;
    } on AuthRepositoryException catch (error) {
      _setError(error.message);
    } catch (_) {
      _setError('Không thể gửi liên kết lúc này. Vui lòng thử lại.');
    }
    return null;
  }

  void reset() {
    status = ForgotPasswordStatus.idle;
    errorMessage = null;
    sentEmail = null;
    ticket = null;
    notifyListeners();
  }

  bool _isValidEmail(String value) {
    return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value);
  }

  void _setError(String message) {
    status = ForgotPasswordStatus.error;
    errorMessage = message;
    notifyListeners();
  }
}
