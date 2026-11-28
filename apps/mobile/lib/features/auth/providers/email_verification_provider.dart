// ignore_for_file: prefer_initializing_formals
import 'package:flutter/foundation.dart';

import '../models/email_action_ticket.dart';
import '../repositories/auth_repository.dart';

enum EmailVerificationStatus { idle, sending, loading, success, error }

class EmailVerificationProvider extends ChangeNotifier {
  EmailVerificationProvider({required AuthRepository repository})
    : _repository = repository;

  final AuthRepository _repository;

  EmailVerificationStatus status = EmailVerificationStatus.idle;
  String? errorMessage;

  bool get isLoading =>
      status == EmailVerificationStatus.sending ||
      status == EmailVerificationStatus.loading;

  Future<EmailActionTicket?> requestVerificationLink(String email) async {
    if (isLoading) return null;

    status = EmailVerificationStatus.sending;
    errorMessage = null;
    notifyListeners();

    try {
      final ticket = await _repository.requestEmailVerification(email: email);
      status = EmailVerificationStatus.idle;
      notifyListeners();
      return ticket;
    } on AuthRepositoryException catch (error) {
      _setError(error.message);
    } catch (_) {
      _setError('Không thể gửi lại email xác minh lúc này. Vui lòng thử lại.');
    }
    return null;
  }

  Future<bool> verifyEmail(String token) async {
    if (isLoading) return false;
    if (token.trim().isEmpty) {
      _setError('Liên kết xác minh email không hợp lệ.');
      return false;
    }

    status = EmailVerificationStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      await _repository.verifyEmail(token: token);
      status = EmailVerificationStatus.success;
      notifyListeners();
      return true;
    } on AuthRepositoryException catch (error) {
      _setError(error.message);
    } catch (_) {
      _setError('Không thể xác minh email lúc này. Vui lòng thử lại.');
    }
    return false;
  }

  void reset() {
    status = EmailVerificationStatus.idle;
    errorMessage = null;
    notifyListeners();
  }

  void _setError(String message) {
    status = EmailVerificationStatus.error;
    errorMessage = message;
    notifyListeners();
  }
}
