import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:toeic_mobile/features/auth/providers/reset_password_provider.dart';
import 'package:toeic_mobile/features/auth/screens/reset_password_success_screen.dart';

import '../widgets/field_label.dart';
import '../widgets/password_field.dart';
import '../../../shared/widgets/text_link_button.dart';
import '../../../theme/app_colors.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, required this.token});

  final String token;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _onSubmit() async {
    final provider = context.read<ResetPasswordProvider>();
    final status = provider.status;
    if (status == ResetPasswordStatus.loading) return;

    final password = _passwordController.text;
    final confirmPassword = _confirmController.text;
    final token = widget.token;
    await provider.resetPassword(
      token: token,
      newPassword: password,
      confirmPassword: confirmPassword,
    );

    if (!mounted) return;

    if (status == ResetPasswordStatus.success) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => ResetPasswordSuccessScreen()),
        (route) => false,
      );
    } else if (status == ResetPasswordStatus.error &&
        provider.errorMessage != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(provider.errorMessage!)));
    }
  }

  void _onBackToLogin(BuildContext context) =>
      Navigator.of(context).popUntil((route) => route.isFirst);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
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
                    style: TextStyle(fontSize: 14, color: AppColors.slate500),
                  ),
                  const SizedBox(height: 24),
                  const FieldLabel('Mật khẩu mới'),
                  const SizedBox(height: 6),
                  PasswordField(controller: _passwordController),
                  const SizedBox(height: 16),
                  const FieldLabel('Nhập lại mật khẩu'),
                  const SizedBox(height: 6),
                  PasswordField(
                    controller: _confirmController,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _onSubmit(),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _onSubmit,
                    child: const Text('Cập nhật mật khẩu'),
                  ),
                  const SizedBox(height: 16),
                  TextLinkButton(
                    label: '← Quay lại đăng nhập',
                    onTap: () => _onBackToLogin(context),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
