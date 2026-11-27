import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../theme/app_colors.dart';
import '../../auth/providers/auth_session_provider.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final String? _editingUserId;
  late final String? _editingSessionId;

  @override
  void initState() {
    super.initState();
    final sessionProvider = context.read<AuthSessionProvider>();
    final user = sessionProvider.currentUser;
    _editingUserId = user?.id;
    _editingSessionId = sessionProvider.currentSession?.id;
    _nameController = TextEditingController(text: user?.fullName ?? '');
    _phoneController = TextEditingController(text: user?.phoneNumber ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  String? _validateFullName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Vui lòng nhập họ và tên.';
    }
    return null;
  }

  String? _validatePhoneNumber(String? value) {
    final phone = value?.trim() ?? '';

    // Phone number is optional.
    if (phone.isEmpty) return null;

    // Follow the Backend ProfilePatch maximum length.
    if (phone.length > 32) {
      return 'Số điện thoại không được vượt quá 32 ký tự.';
    }

    // Allow common formatting characters:
    // spaces, parentheses, dots and hyphens.
    final normalizedPhone = phone.replaceAll(RegExp(r'[\s().-]'), '');

    // Allow an optional leading "+" and 7–15 digits.
    if (!RegExp(r'^\+?[0-9]{7,15}$').hasMatch(normalizedPhone)) {
      return 'Số điện thoại không hợp lệ. Vui lòng nhập 7–15 chữ số.';
    }

    return null;
  }

  Future<void> _onSave() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final sessionProvider = context.read<AuthSessionProvider>();
    final currentUser = sessionProvider.currentUser;
    final currentSession = sessionProvider.currentSession;
    if (currentUser == null ||
        currentUser.id != _editingUserId ||
        currentSession?.id != _editingSessionId) {
      _showMessage('Phiên tài khoản đã thay đổi. Vui lòng mở lại màn hình.');
      return;
    }

    final fullName = _nameController.text.trim();
    final rawPhone = _phoneController.text.trim();
    final phoneNumber = rawPhone.isEmpty ? null : rawPhone;

    if (fullName == currentUser.fullName &&
        phoneNumber == currentUser.phoneNumber) {
      _showMessage('Thông tin chưa có thay đổi.');
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Lưu thay đổi'),
        content: const Text('Bạn có muốn lưu thông tin vừa chỉnh sửa?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final latestProvider = context.read<AuthSessionProvider>();
    if (latestProvider.currentUser?.id != _editingUserId ||
        latestProvider.currentSession?.id != _editingSessionId) {
      _showMessage('Phiên tài khoản đã thay đổi. Vui lòng mở lại màn hình.');
      return;
    }

    final updated = await latestProvider.updateProfile(
      fullName: fullName,
      phoneNumber: phoneNumber,
    );
    if (!mounted) return;

    if (updated == null) {
      _showMessage(
        latestProvider.errorMessage ?? 'Không thể cập nhật thông tin cá nhân.',
      );
      return;
    }

    _showMessage('Đã cập nhật thông tin cá nhân.');
    Navigator.of(context).pop(true);
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final sessionProvider = context.watch<AuthSessionProvider>();
    final currentUser = sessionProvider.currentUser;
    final isSaving = sessionProvider.isUpdatingProfile;
    final canUpdateProfile = sessionProvider.canUpdateProfile;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text('Chỉnh sửa thông tin'),
        backgroundColor: AppColors.bg,
        surfaceTintColor: Colors.transparent,
      ),
      body: currentUser == null
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Không có thông tin tài khoản để chỉnh sửa.',
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  TextFormField(
                    initialValue: currentUser.email,
                    enabled: false,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      helperText: 'Backend hiện chưa hỗ trợ thay đổi email.',
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _nameController,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    enabled: !isSaving && canUpdateProfile,
                    decoration: const InputDecoration(labelText: 'Họ và tên'),
                    validator: _validateFullName,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.done,
                    enabled: !isSaving && canUpdateProfile,
                    maxLength: 32,
                    autovalidateMode: AutovalidateMode.onUserInteraction,
                    validator: _validatePhoneNumber,
                    decoration: const InputDecoration(
                      labelText: 'Số điện thoại',
                      hintText: 'Không bắt buộc',
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (!canUpdateProfile)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Text(
                        'Tính năng cập nhật hồ sơ hiện chưa khả dụng.',
                        style: TextStyle(color: AppColors.slate500),
                      ),
                    ),
                  FilledButton(
                    onPressed: isSaving || !canUpdateProfile ? null : _onSave,
                    child: isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Lưu thay đổi'),
                  ),
                ],
              ),
            ),
    );
  }
}
