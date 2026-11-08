import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../shared/widgets/text_link_button.dart';
import '../../../theme/app_colors.dart';
import '../providers/reset_password_provider.dart';
import '../widgets/field_label.dart';
import '../widgets/password_field.dart';
import 'login_screen.dart';
import 'reset_password_success_screen.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, required this.token});

  final String token;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _onSubmit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final provider = context.read<ResetPasswordProvider>();
    if (provider.isLoading) return;

    final success = await provider.resetPassword(
      token: widget.token,
      newPassword: _passwordController.text,
      confirmPassword: _confirmController.text,
    );
    if (!mounted) return;

    if (success) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute<void>(
          builder: (_) => const ResetPasswordSuccessScreen(),
        ),
        (route) => false,
      );
    } else {
      final message = provider.errorMessage;
      if (message != null) _showMessage(message);
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

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.length < 8 ||
        !RegExp(r'[A-Z]').hasMatch(password) ||
        !RegExp(r'[a-z]').hasMatch(password) ||
        !RegExp(r'\d').hasMatch(password)) {
      return 'Cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số';
    }
    return null;
  }

  String? _validateConfirmPassword(String? value) {
    if (value == null || value.isEmpty) return 'Vui lòng xác nhận mật khẩu';
    if (value != _passwordController.text)
      return 'Mật khẩu xác nhận không khớp';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = context.watch<ResetPasswordProvider>().isLoading;

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
                child: Form(
                  key: _formKey,
                  child: AutofillGroup(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Đặt mật khẩu mới',
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            color: AppColors.slate900,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Tạo mật khẩu mới cho tài khoản của bạn.',
                          style: TextStyle(
                            fontSize: 14,
                            color: AppColors.slate500,
                          ),
                        ),
                        const SizedBox(height: 24),
                        const FieldLabel('Mật khẩu mới'),
                        const SizedBox(height: 6),
                        PasswordField(
                          controller: _passwordController,
                          autofillHints: const [AutofillHints.newPassword],
                          validator: _validatePassword,
                          enabled: !isLoading,
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.slate400,
                          ),
                        ),
                        const SizedBox(height: 16),
                        const FieldLabel('Nhập lại mật khẩu'),
                        const SizedBox(height: 6),
                        PasswordField(
                          controller: _confirmController,
                          textInputAction: TextInputAction.done,
                          onSubmitted: (_) => _onSubmit(),
                          autofillHints: const [AutofillHints.newPassword],
                          validator: _validateConfirmPassword,
                          enabled: !isLoading,
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: isLoading ? null : _onSubmit,
                          child: isLoading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text('Cập nhật mật khẩu'),
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
        ),
      ),
    );
  }
}
