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
  late final TextEditingController _emailController;
  late final String? _editingUserId;

  @override
  void initState() {
    super.initState();

    // Khởi tạo form từ cùng nguồn User mà ProfileScreen đang hiển thị.
    final user = context.read<AuthSessionProvider>().currentUser;
    _editingUserId = user?.id;
    _nameController = TextEditingController(text: user?.fullName ?? '');
    _emailController = TextEditingController(text: user?.email ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
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

  Future<void> _onSave() async {
    final form = _formKey.currentState;
    if (form == null || !form.validate()) return;

    final sessionProvider = context.read<AuthSessionProvider>();
    final currentUser = sessionProvider.currentUser;
    if (currentUser == null) {
      _showMessage('Không tìm thấy thông tin tài khoản. Vui lòng thử lại.');
      return;
    }
    if (currentUser.id != _editingUserId) {
      _showMessage('Phiên tài khoản đã thay đổi. Vui lòng mở lại màn hình.');
      return;
    }

    final fullName = _nameController.text.trim();
    final email = _emailController.text.trim();

    if (fullName == currentUser.fullName && email == currentUser.email) {
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

    if (confirmed != true) return;
    if (!mounted) return;

    // Không ghi dữ liệu vào một tài khoản khác nếu session đổi trong lúc mở dialog.
    final latestUser = context.read<AuthSessionProvider>().currentUser;
    if (latestUser == null || latestUser.id != _editingUserId) {
      _showMessage('Phiên tài khoản đã thay đổi. Vui lòng mở lại màn hình.');
      return;
    }

    final updatedUser = latestUser.copyWith(fullName: fullName, email: email);
    context.read<AuthSessionProvider>().setCurrentUser(updatedUser);

    _showMessage('Đã cập nhật thông tin cá nhân.');
    Navigator.of(context).pop(true);
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = context.watch<AuthSessionProvider>().currentUser;

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
                    controller: _nameController,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(labelText: 'Họ và tên'),
                    validator: _validateFullName,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    decoration: const InputDecoration(labelText: 'Email'),
                    validator: _validateEmail,
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _onSave,
                    child: const Text('Lưu thay đổi'),
                  ),
                ],
              ),
            ),
    );
  }
}
