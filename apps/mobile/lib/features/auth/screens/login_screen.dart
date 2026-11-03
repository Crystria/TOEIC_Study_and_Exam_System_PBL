import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/auth/providers/login_provider.dart';
import 'package:provider/provider.dart';
import 'package:toeic_mobile/features/auth/screens/forgot_password_screen.dart';
import 'package:toeic_mobile/features/auth/screens/register_screen.dart';
import 'package:toeic_mobile/features/home/screens/home_screen.dart';

import '../widgets/auth_footer_link.dart';
import '../widgets/auth_header.dart';
import '../widgets/field_label.dart';
import '../widgets/oauth_buttons_row.dart';
import '../widgets/password_field.dart';
import '../../../theme/app_colors.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  late final LoginProvider _loginProvider;

  @override
  void initState() {
    super.initState();
    _loginProvider = context.read<LoginProvider>()
      ..addListener(_onLoginStateChanged);
  }

  @override
  void dispose() {
    _loginProvider.removeListener(_onLoginStateChanged);
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _onLoginStateChanged() {
    final status = _loginProvider.status;
    if (status == LoginStatus.loading) return;
    if (!mounted) return;

    if (status == LoginStatus.success) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
        (route) => false,
      );
    } else if (status == LoginStatus.error &&
        _loginProvider.errorMessage != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(_loginProvider.errorMessage!)));
    }
  }

  void _onLogin() {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;
    _loginProvider.login(identifier, password);
  }

  void _onOAuth(String provider) {
    _loginProvider.loginWithOAuth(provider);
  }

  void _onForgotPassword() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
    );
  }

  void _onRegister() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const RegisterScreen()),
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
                    title: 'TOEIC Master',
                    subtitle: 'Ôn thi TOEIC Listening & Reading mỗi ngày, trên Web và Mobile.',
                  ),
                  const SizedBox(height: 28),
                  const FieldLabel('Email hoặc tên đăng nhập'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _identifierController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.username],
                    decoration: const InputDecoration(
                      hintText: 'ban@email.com',
                    ),
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('Mật khẩu'),
                  const SizedBox(height: 6),
                  PasswordField(
                    controller: _passwordController,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _onLogin(),
                    autofillHints: const [AutofillHints.password],
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: _onForgotPassword,
                      child: const Text(
                        'Quên mật khẩu?',
                        style: TextStyle(
                          color: AppColors.brand,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  ElevatedButton(
                    onPressed: _onLogin,
                    child: const Text('Đăng nhập'),
                  ),
                  const SizedBox(height: 20),
                  const Center(
                    child: Text(
                      'hoặc đăng nhập bằng',
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
                    text: 'Chưa có tài khoản? ',
                    actionText: 'Đăng ký',
                    onTap: _onRegister,
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
