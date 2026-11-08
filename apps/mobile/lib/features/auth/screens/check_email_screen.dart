import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../shared/widgets/icon_badge_circle.dart';
import '../../../shared/widgets/text_link_button.dart';
import '../../../theme/app_colors.dart';
import '../models/email_action_ticket.dart';
import '../providers/email_verification_provider.dart';
import '../providers/forgot_password_provider.dart';
import 'email_verification_success_screen.dart';
import 'reset_password_screen.dart';
import 'login_screen.dart';

/// Màn hình xác nhận email chung cho hai luồng:
/// - Xác minh email sau đăng ký.
/// - Xác nhận đã gửi yêu cầu đặt lại mật khẩu.
class CheckEmailScreen extends StatefulWidget {
  const CheckEmailScreen({super.key, required this.ticket});

  final EmailActionTicket ticket;

  @override
  State<CheckEmailScreen> createState() => _CheckEmailScreenState();
}

class _CheckEmailScreenState extends State<CheckEmailScreen> {
  late EmailActionTicket _ticket;
  bool _openingLink = false;
  bool _resendingLink = false;

  @override
  void initState() {
    super.initState();
    _ticket = widget.ticket;
  }

  bool get _isVerification => _ticket.type == EmailActionType.emailVerification;

  Future<void> _onOpenEmailLink() async {
    if (_openingLink || _ticket.isExpired) {
      if (_ticket.isExpired) {
        _showMessage(
          'Liên kết đã hết hạn. Vui lòng quay lại và yêu cầu liên kết mới.',
        );
      }
      return;
    }

    if (!_isVerification) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => ResetPasswordScreen(token: _ticket.token),
        ),
      );
      return;
    }

    setState(() => _openingLink = true);
    final provider = context.read<EmailVerificationProvider>();
    final user = await provider.verifyEmail(_ticket.token);
    if (!mounted) return;
    setState(() => _openingLink = false);

    if (user != null) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute<void>(
          builder: (_) => const EmailVerificationSuccessScreen(),
        ),
        (route) => false,
      );
      return;
    }

    final message = provider.errorMessage;
    if (message != null) _showMessage(message);
  }

  Future<void> _onResendLink() async {
    if (_resendingLink || _openingLink) return;
    setState(() => _resendingLink = true);

    EmailActionTicket? newTicket;
    String? errorMessage;
    if (_isVerification) {
      final provider = context.read<EmailVerificationProvider>();
      newTicket = await provider.requestVerificationLink(_ticket.email);
      errorMessage = provider.errorMessage;
    } else {
      final provider = context.read<ForgotPasswordProvider>();
      newTicket = await provider.sendResetLink(_ticket.email);
      errorMessage = provider.errorMessage;
    }

    if (!mounted) return;
    setState(() {
      _resendingLink = false;
      if (newTicket != null) _ticket = newTicket;
    });

    if (newTicket != null) {
      _showMessage('Đã tạo liên kết mới trong môi trường mô phỏng.');
    } else if (errorMessage != null) {
      _showMessage(errorMessage);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  void _onBackToLogin() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final verificationLoading = _isVerification
        ? context.watch<EmailVerificationProvider>().isLoading
        : false;
    final resetLoading = !_isVerification
        ? context.watch<ForgotPasswordProvider>().isLoading
        : false;
    final isLoading =
        _openingLink || _resendingLink || verificationLoading || resetLoading;
    final expired = _ticket.isExpired;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _onBackToLogin();
      },
      child: Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const IconBadgeCircle(icon: Icons.mail_outline, size: 72),
                    const SizedBox(height: 20),
                    Text(
                      _isVerification
                          ? 'Xác minh email của bạn'
                          : 'Kiểm tra email của bạn',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _isVerification
                          ? 'Liên kết xác minh tài khoản được tạo cho ${_ticket.email}. Liên kết có hiệu lực trong 30 phút.'
                          : 'Liên kết đặt lại mật khẩu được tạo cho ${_ticket.email}. Liên kết có hiệu lực trong 30 phút.',
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.slate500,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Đây là luồng mô phỏng: ứng dụng không gửi email thật. '
                      'Nút bên dưới mô phỏng thao tác mở liên kết nhận được trong email.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.warning,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: isLoading || expired ? null : _onOpenEmailLink,
                      child: isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              expired
                                  ? 'Liên kết đã hết hạn'
                                  : _isVerification
                                  ? 'Xác minh email (mô phỏng)'
                                  : 'Mở liên kết đặt lại (mô phỏng)',
                            ),
                    ),
                    const SizedBox(height: 8),
                    Center(
                      child: TextButton(
                        onPressed: isLoading ? null : _onResendLink,
                        child: Text(
                          _isVerification
                              ? 'Gửi lại email xác minh'
                              : 'Gửi lại liên kết đặt lại',
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextLinkButton(
                      label: '← Quay lại đăng nhập',
                      onTap: _onBackToLogin,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
