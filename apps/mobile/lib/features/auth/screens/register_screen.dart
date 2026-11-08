import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../theme/app_colors.dart';
import '../models/registration_result.dart';
import 'check_email_screen.dart';
import '../providers/register_provider.dart';
import '../widgets/auth_footer_link.dart';
import '../widgets/auth_header.dart';
import '../widgets/field_label.dart';
import '../widgets/oauth_buttons_row.dart';
import '../widgets/password_field.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _agreeTerms = false;
  bool _showTermsError = false;

  Future<void> _onRegister() async {
    final registerProvider = context.read<RegisterProvider>();
    if (registerProvider.isLoading) return;

    final isFormValid = _formKey.currentState?.validate() ?? false;
    setState(() => _showTermsError = !_agreeTerms);
    if (!isFormValid || !_agreeTerms) return;

    final RegistrationResult? result = await registerProvider.register(
      fullName: _fullNameController.text.trim(),
      email: _emailController.text.trim(),
      password: _passwordController.text,
      confirmPassword: _confirmPasswordController.text,
      agreeTerms: _agreeTerms,
    );

    if (!mounted) return;

    if (result == null) {
      _showMessage(
        registerProvider.errorMessage ??
            'Không thể tạo tài khoản. Vui lòng thử lại.',
      );
      return;
    }

    // Tài khoản mới chưa được xác minh nên chưa tạo AuthSession và chưa vào Home.
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(
        builder: (_) =>
            CheckEmailScreen(ticket: result.emailVerificationTicket),
      ),
      (route) => false,
    );
  }

  Future<void> _onOAuth(String providerName) async {
    final registerProvider = context.read<RegisterProvider>();
    await registerProvider.registerWithOAuth(providerName);
    if (!mounted) return;
    _showMessage(
      registerProvider.errorMessage ?? 'Phương thức đăng ký chưa khả dụng.',
    );
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  void _onLogin() {
    Navigator.of(context).maybePop();
  }

  String? _validateFullName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Vui lòng nhập họ và tên';
    }
    return null;
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'Vui lòng nhập email';
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      return 'Email không hợp lệ';
    }
    return null;
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
    if (value == null || value.isEmpty) {
      return 'Vui lòng xác nhận mật khẩu';
    }
    if (value != _passwordController.text) {
      return 'Mật khẩu xác nhận không khớp';
    }
    return null;
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = context.watch<RegisterProvider>().isLoading;

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
                        brandLabel: 'TOEIC Master',
                        title: 'Tạo tài khoản',
                        subtitle: 'Đăng ký miễn phí để bắt đầu ôn thi TOEIC.',
                      ),
                      const SizedBox(height: 24),
                      const FieldLabel('Họ và tên'),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _fullNameController,
                        textCapitalization: TextCapitalization.words,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.name],
                        decoration: const InputDecoration(
                          hintText: 'Nguyễn Văn A',
                        ),
                        validator: _validateFullName,
                        enabled: !isLoading,
                      ),
                      const SizedBox(height: 16),
                      const FieldLabel('Email'),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.email],
                        decoration: const InputDecoration(
                          hintText: 'ban@email.com',
                        ),
                        validator: _validateEmail,
                        enabled: !isLoading,
                      ),
                      const SizedBox(height: 16),
                      const FieldLabel('Mật khẩu'),
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
                      const FieldLabel('Xác nhận mật khẩu'),
                      const SizedBox(height: 6),
                      PasswordField(
                        controller: _confirmPasswordController,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _onRegister(),
                        autofillHints: const [AutofillHints.newPassword],
                        validator: _validateConfirmPassword,
                        enabled: !isLoading,
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
                              onChanged: isLoading
                                  ? null
                                  : (value) => setState(() {
                                      _agreeTerms = value ?? false;
                                      if (_agreeTerms) _showTermsError = false;
                                    }),
                            ),
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text.rich(
                              TextSpan(
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
                      if (_showTermsError)
                        const Padding(
                          padding: EdgeInsets.only(top: 4, left: 32),
                          child: Text(
                            'Bạn cần đồng ý điều khoản sử dụng và chính sách bảo mật',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.danger,
                            ),
                          ),
                        ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: isLoading ? null : _onRegister,
                        child: isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Tạo tài khoản'),
                      ),
                      const SizedBox(height: 20),
                      const Center(
                        child: Text(
                          'hoặc đăng ký bằng',
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
                        text: 'Đã có tài khoản? ',
                        actionText: 'Đăng nhập',
                        onTap: _onLogin,
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
