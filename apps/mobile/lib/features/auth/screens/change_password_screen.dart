import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../theme/app_colors.dart';
import '../providers/auth_session_provider.dart';
import '../providers/change_password_provider.dart';
import '../widgets/field_label.dart';
import '../widgets/password_field.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  String? _editingUserId;
  String? _editingSessionId;

  @override
  void initState() {
    super.initState();
    final sessionProvider = context.read<AuthSessionProvider>();
    _editingUserId = sessionProvider.currentUser?.id;
    _editingSessionId = sessionProvider.currentSession?.id;
  }

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String? _validateCurrentPassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng nhập mật khẩu hiện tại';
    }
    return null;
  }

  String? _validateNewPassword(String? value) {
    final password = value ?? '';
    if (password.length < 8 ||
        !RegExp(r'[A-Z]').hasMatch(password) ||
        !RegExp(r'[a-z]').hasMatch(password) ||
        !RegExp(r'\d').hasMatch(password)) {
      return 'Cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số';
    }
    if (password == _currentPasswordController.text) {
      return 'Mật khẩu mới phải khác mật khẩu hiện tại';
    }
    return null;
  }

  String? _validateConfirmPassword(String? value) {
    if (value == null || value.isEmpty) {
      return 'Vui lòng xác nhận mật khẩu mới';
    }
    if (value != _newPasswordController.text) {
      return 'Mật khẩu xác nhận không khớp';
    }
    return null;
  }

  Future<void> _onSubmit() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate()) return;

    final sessionProvider = context.read<AuthSessionProvider>();
    final user = sessionProvider.currentUser;
    final currentSession = sessionProvider.currentSession;
    if (user == null ||
        user.id != _editingUserId ||
        currentSession == null ||
        currentSession.id != _editingSessionId) {
      _showMessage(
        'Phiên đăng nhập đã thay đổi hoặc không còn hoạt động. Vui lòng mở lại màn hình.',
      );
      return;
    }

    final provider = context.read<ChangePasswordProvider>();
    if (provider.isLoading) return;

    final success = await provider.changePassword(
      userId: user.id,
      currentPassword: _currentPasswordController.text,
      newPassword: _newPasswordController.text,
      confirmPassword: _confirmPasswordController.text,
    );
    if (!mounted) return;

    if (success) {
      _currentPasswordController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();
      form.reset();
      _showMessage('Đổi mật khẩu thành công. Phiên hiện tại vẫn được giữ.');
      Navigator.of(context).pop(true);
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

  @override
  Widget build(BuildContext context) {
    final isLoading = context.watch<ChangePasswordProvider>().isLoading;
    final hasUser = context.watch<AuthSessionProvider>().currentUser != null;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text('Đổi mật khẩu'),
        backgroundColor: AppColors.bg,
        surfaceTintColor: Colors.transparent,
      ),
      body: !hasUser
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Bạn cần đăng nhập để đổi mật khẩu.',
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.blueChipBg,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline, color: AppColors.brand),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Nhập mật khẩu hiện tại để xác nhận quyền truy cập. Sau khi đổi, phiên đăng nhập trên thiết bị này vẫn được duy trì.',
                            style: TextStyle(
                              color: AppColors.slate700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const FieldLabel('Mật khẩu hiện tại'),
                  const SizedBox(height: 6),
                  PasswordField(
                    controller: _currentPasswordController,
                    autofillHints: const [AutofillHints.password],
                    validator: _validateCurrentPassword,
                    enabled: !isLoading,
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('Mật khẩu mới'),
                  const SizedBox(height: 6),
                  PasswordField(
                    controller: _newPasswordController,
                    autofillHints: const [AutofillHints.newPassword],
                    validator: _validateNewPassword,
                    enabled: !isLoading,
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.',
                    style: TextStyle(fontSize: 12, color: AppColors.slate400),
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('Xác nhận mật khẩu mới'),
                  const SizedBox(height: 6),
                  PasswordField(
                    controller: _confirmPasswordController,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _onSubmit(),
                    autofillHints: const [AutofillHints.newPassword],
                    validator: _validateConfirmPassword,
                    enabled: !isLoading,
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    height: 48,
                    child: FilledButton(
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
                  ),
                ],
              ),
            ),
    );
  }
}
