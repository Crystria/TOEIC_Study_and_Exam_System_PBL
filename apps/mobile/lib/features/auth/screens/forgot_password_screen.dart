import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../shared/widgets/text_link_button.dart';
import '../../../theme/app_colors.dart';
import '../models/email_action_ticket.dart';
import '../providers/forgot_password_provider.dart';
import '../widgets/field_label.dart';
import 'check_email_screen.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _onSendLink() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final provider = context.read<ForgotPasswordProvider>();
    if (provider.isLoading) return;

    final EmailActionTicket? ticket = await provider.sendResetLink(
      _emailController.text.trim(),
    );
    if (!mounted) return;

    if (ticket != null) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute<void>(
          builder: (_) => CheckEmailScreen(ticket: ticket),
        ),
        (route) => false,
      );
      return;
    }

    final message = provider.errorMessage;
    if (message != null) _showMessage(message);
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  void _onBackToLogin() => Navigator.of(context).maybePop();

  @override
  Widget build(BuildContext context) {
    final isLoading = context.watch<ForgotPasswordProvider>().isLoading;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Quên mật khẩu?',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.slate500,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const FieldLabel('Email'),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.done,
                      enabled: !isLoading,
                      onFieldSubmitted: (_) => _onSendLink(),
                      decoration: const InputDecoration(
                        hintText: 'ban@email.com',
                      ),
                      validator: (value) {
                        final email = value?.trim() ?? '';
                        if (email.isEmpty) return 'Vui lòng nhập email';
                        if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                            .hasMatch(email)) {
                          return 'Email không hợp lệ';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: isLoading ? null : _onSendLink,
                      child: isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Gửi liên kết đặt lại'),
                    ),
                    const SizedBox(height: 16),
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
