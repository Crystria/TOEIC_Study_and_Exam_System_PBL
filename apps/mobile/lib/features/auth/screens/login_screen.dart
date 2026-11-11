import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/config/app_config.dart';
import '../../../theme/app_colors.dart';
import '../../home/screens/home_screen.dart';
import '../providers/auth_session_provider.dart';
import '../providers/login_provider.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';
import '../widgets/auth_footer_link.dart';
import '../widgets/auth_header.dart';
import '../widgets/field_label.dart';
import '../widgets/oauth_buttons_row.dart';
import '../widgets/password_field.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();

  Future<void> _onLogin() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final loginProvider = context.read<LoginProvider>();
    if (loginProvider.isLoading) return;

    final user = await loginProvider.login(
      _identifierController.text.trim(),
      _passwordController.text,
    );

    if (!mounted) return;

    if (user == null) {
      _showMessage(
        loginProvider.errorMessage ?? 'Không thể đăng nhập. Vui lòng thử lại.',
      );
      return;
    }

    // Session được cập nhật tại Screen; Provider không tự điều hướng.
    try {
      await context.read<AuthSessionProvider>().setCurrentUser(user);
    } catch (_) {
      _showMessage(
        'Không thể khởi tạo dữ liệu cho tài khoản. Vui lòng thử lại.',
      );
      return;
    }
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(
        builder: (_) =>
            HomeScreen(loginRouteBuilder: (_) => const LoginScreen()),
      ),
      (route) => false,
    );
  }

  Future<void> _onOAuth(String providerName) async {
    final loginProvider = context.read<LoginProvider>();
    await loginProvider.loginWithOAuth(providerName);
    if (!mounted) return;
    _showMessage(
      loginProvider.errorMessage ?? 'Phương thức đăng nhập chưa khả dụng.',
    );
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  void _onForgotPassword() {
    Navigator.push(
      context,
      MaterialPageRoute<void>(builder: (_) => const ForgotPasswordScreen()),
    );
  }

  void _onRegister() {
    Navigator.push(
      context,
      MaterialPageRoute<void>(builder: (_) => const RegisterScreen()),
    );
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = context.watch<LoginProvider>().isLoading;
    final apiEnabled = context.watch<AppConfig>().isAuthApiEnabled;

    return Scaffold(
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
                      const AuthHeader(
                        title: 'TOEIC Master',
                        subtitle: 'Ôn thi TOEIC Listening & Reading mỗi ngày, trên Web và Mobile.',
                      ),
                      const SizedBox(height: 28),
                      FieldLabel(
                        apiEnabled ? 'Email' : 'Email hoặc tên đăng nhập',
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _identifierController,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.username],
                        enabled: !isLoading,
                        decoration: const InputDecoration(
                          hintText: 'ban@email.com',
                        ),
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return apiEnabled
                                ? 'Vui lòng nhập email'
                                : 'Vui lòng nhập email hoặc tên đăng nhập';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      const FieldLabel('Mật khẩu'),
                      const SizedBox(height: 6),
                      PasswordField(
                        controller: _passwordController,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _onLogin(),
                        autofillHints: const [AutofillHints.password],
                        enabled: !isLoading,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Vui lòng nhập mật khẩu';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 4),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: isLoading ? null : _onForgotPassword,
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
                        onPressed: isLoading ? null : _onLogin,
                        child: isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Đăng nhập'),
                      ),
                      const SizedBox(height: 20),
                      const Center(
                        child: Text(
                          'hoặc đăng nhập bằng',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.slate400,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      OAuthButtonsRow(
                        enabled: !isLoading,
                        onGoogle: () => _onOAuth('google'),
                        onFacebook: () => _onOAuth('facebook'),
                      ),
                      const SizedBox(height: 24),
                      AuthFooterLink(
                        text: 'Chưa có tài khoản? ',
                        actionText: 'Đăng ký',
                        onTap: _onRegister,
                        enabled: !isLoading,
                      ),
                    ],
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
