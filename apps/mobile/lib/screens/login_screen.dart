import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  // TODO: gọi POST /auth/login, lưu token (flutter_secure_storage), điều hướng
  void _onLogin() {}

  // TODO: OAuth2 Google / Facebook
  void _onOAuth(String provider) {}

  // TODO: màn hình quên mật khẩu
  void _onForgotPassword() {}

  // TODO: điều hướng sang màn đăng ký
  void _onRegister() {}

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
                  // Logo
                  Container(
                    width: 52,
                    height: 52,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.brand,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Text(
                      'T',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  const Text(
                    'TOEIC Master',
                    style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Ôn thi TOEIC Listening & Reading mỗi ngày, trên Web và Mobile.',
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.5,
                      color: AppColors.slate500,
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Email / username
                  const _FieldLabel('Email hoặc tên đăng nhập'),
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

                  // Mật khẩu
                  const _FieldLabel('Mật khẩu'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.password],
                    onSubmitted: (_) => _onLogin(),
                    decoration: InputDecoration(
                      hintText: '••••••••',
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          color: AppColors.slate400,
                          size: 20,
                        ),
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                      ),
                    ),
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

                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _onOAuth('google'),
                          child: const Text('Google'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _onOAuth('facebook'),
                          child: const Text('Facebook'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'Chưa có tài khoản? ',
                        style: TextStyle(fontSize: 14, color: AppColors.slate500),
                      ),
                      GestureDetector(
                        onTap: _onRegister,
                        child: const Text(
                          'Đăng ký',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.brand,
                          ),
                        ),
                      ),
                    ],
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

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: Color(0xFF1E293B),
      ),
    );
  }
}
