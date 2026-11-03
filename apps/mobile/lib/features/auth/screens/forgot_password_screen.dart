import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:toeic_mobile/features/auth/providers/forgot_password_provider.dart';
import 'package:toeic_mobile/features/auth/screens/check_email_screen.dart';

import '../widgets/field_label.dart';
import '../../../shared/widgets/text_link_button.dart';
import '../../../theme/app_colors.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _onSendLink() async {
    final provider = context.read<ForgotPasswordProvider>();
    final status = provider.status;
    if (status == ForgotPasswordStatus.loading) return;

    final email = _emailController.text;
    await provider.sendResetLink(email);

    if (!mounted) return;

    if (status == ForgotPasswordStatus.sent) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => CheckEmailScreen(email: email)),
        (route) => false,
      );
    } else if (status == ForgotPasswordStatus.error &&
        provider.errorMessage != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(provider.errorMessage!)));
    }
  }

  void _onBackToLogin(BuildContext context) => Navigator.of(context).maybePop();

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
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _onSendLink(),
                    decoration: const InputDecoration(
                      hintText: 'ban@email.com',
                    ),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _onSendLink,
                    child: const Text('Gửi liên kết đặt lại'),
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
