import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/auth/providers/register_provider.dart';
import 'package:toeic_mobile/features/auth/screens/login_screen.dart';
import 'package:toeic_mobile/features/home/screens/home_screen.dart';
import 'package:provider/provider.dart';

import '../widgets/auth_footer_link.dart';
import '../widgets/auth_header.dart';
import '../widgets/field_label.dart';
import '../widgets/oauth_buttons_row.dart';
import '../widgets/password_field.dart';
import '../../../theme/app_colors.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  late final RegisterProvider _registerProvider;
  bool _agreeTerms = false;

  @override
  void initState() {
    super.initState();
    _registerProvider = context.read<RegisterProvider>()
      ..addListener(_onRegisterStateChanged);
  }

  @override
  void dispose() {
    _registerProvider.removeListener(_onRegisterStateChanged);
    _fullNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _onRegisterStateChanged() {
    final status = _registerProvider.status;
    if (status == RegisterStatus.loading) return;

    if (!mounted) return;

    if (status == RegisterStatus.success) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
        (route) => false,
      );
    } else if (status == RegisterStatus.error &&
        _registerProvider.errorMessage != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_registerProvider.errorMessage!)));
    }
  }

  void _onRegister() {
    final fullName = _fullNameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;
    final agreeTerms = _agreeTerms;
    _registerProvider.register(
      fullName: fullName,
      email: email,
      password: password,
      confirmPassword: confirmPassword,
      agreeTerms: agreeTerms,
    );
  }

  void _onOAuth(String provider) {
    _registerProvider.registerWithOAuth(provider);
  }

  void _onLogin() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
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
                  const AuthHeader(
                    brandLabel: 'TOEIC Master',
                    title: 'Tạo tài khoản',
                    subtitle: 'Đăng ký miễn phí để bắt đầu ôn thi TOEIC.',
                  ),
                  const SizedBox(height: 24),
                  const FieldLabel('Họ và tên'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _fullNameController,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(hintText: 'Nguyễn Văn A'),
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('Email'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      hintText: 'ban@email.com',
                    ),
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('Mật khẩu'),
                  const SizedBox(height: 6),
                  PasswordField(controller: _passwordController),
                  const SizedBox(height: 4),
                  const Text(
                    'Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.',
                    style: TextStyle(fontSize: 12, color: AppColors.slate400),
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('Xác nhận mật khẩu'),
                  const SizedBox(height: 6),
                  PasswordField(
                    controller: _confirmPasswordController,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _onRegister(),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 22,
                        height: 22,
                        child: Checkbox(
                          value: _agreeTerms,
                          activeColor: AppColors.brand,
                          onChanged: (v) =>
                              setState(() => _agreeTerms = v ?? false),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: RichText(
                          text: TextSpan(
                            style: TextStyle(
                              fontSize: 13,
                              color: AppColors.slate500,
                            ),
                            children: [
                              TextSpan(text: 'Tôi đồng ý với '),
                              TextSpan(
                                text: 'Điều khoản sử dụng',
                                style: TextStyle(
                                  color: AppColors.brand,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              TextSpan(text: ' và '),
                              TextSpan(
                                text: 'Chính sách bảo mật',
                                style: TextStyle(
                                  color: AppColors.brand,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              TextSpan(text: '.'),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _onRegister,
                    child: const Text('Tạo tài khoản'),
                  ),
                  const SizedBox(height: 20),
                  const Center(
                    child: Text(
                      'hoặc đăng ký bằng',
                      style: TextStyle(fontSize: 13, color: AppColors.slate400),
                    ),
                  ),
                  const SizedBox(height: 16),
                  OAuthButtonsRow(
                    onGoogle: () => _onOAuth('google'),
                    onFacebook: () => _onOAuth('facebook'),
                  ),
                  const SizedBox(height: 24),
                  AuthFooterLink(
                    text: 'Đã có tài khoản? ',
                    actionText: 'Đăng nhập',
                    onTap: _onLogin,
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
