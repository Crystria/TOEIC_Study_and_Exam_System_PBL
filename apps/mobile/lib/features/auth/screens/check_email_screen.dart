import 'package:flutter/material.dart';

import '../../../shared/widgets/icon_badge_circle.dart';
import '../../../shared/widgets/text_link_button.dart';
import '../../../theme/app_colors.dart';
import 'login_screen.dart';

class CheckEmailScreen extends StatelessWidget {
  const CheckEmailScreen({super.key, required this.email});

  final String email;

  void _onOpenEmailApp() {}
  void _onBackToLogin(BuildContext context) {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => const LoginScreen(),
      ),
          (route) => false,
    );
  }

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
                  const IconBadgeCircle(icon: Icons.mail_outline, size: 72),
                  const SizedBox(height: 20),
                  const Text(
                    'Kiểm tra email của bạn',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Chúng tôi đã gửi liên kết tới $email. Liên kết có hiệu lực 30 phút.',
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.slate500,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _onOpenEmailApp,
                    child: const Text('Mở liên kết trong email'),
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
