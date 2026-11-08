import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../theme/app_colors.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/screens/change_password_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _notificationsEnabled = true;

  @override
  Widget build(BuildContext context) {
    final sessionProvider = context.watch<AuthSessionProvider>();
    final session = sessionProvider.currentSession;
    final currentUser = sessionProvider.currentUser;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text('Cài đặt'),
        backgroundColor: AppColors.bg,
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SwitchListTile.adaptive(
            value: _notificationsEnabled,
            onChanged: (value) => setState(() => _notificationsEnabled = value),
            title: const Text('Thông báo nhắc học'),
            subtitle: const Text(
              'Nhắc bạn hoàn thành mục tiêu học tập mỗi ngày',
            ),
            activeThumbColor: AppColors.brand,
            activeTrackColor: AppColors.brand,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12),
            tileColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          const SizedBox(height: 20),
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              'Bảo mật tài khoản',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.slate500,
              ),
            ),
          ),
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            child: ListTile(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              leading: const Icon(Icons.lock_outline, color: AppColors.brand),
              title: const Text('Đổi mật khẩu'),
              subtitle: const Text('Cập nhật mật khẩu cho tài khoản'),
              trailing: const Icon(
                Icons.chevron_right,
                color: AppColors.slate400,
              ),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.devices_outlined, color: AppColors.brand),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'Phiên đăng nhập hiện tại',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: AppColors.slate900,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.circle,
                      color: session == null
                          ? AppColors.slate400
                          : AppColors.success,
                      size: 9,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      session == null ? 'Không hoạt động' : 'Đang hoạt động',
                      style: TextStyle(
                        color: session == null
                            ? AppColors.slate500
                            : AppColors.success,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _SessionDetailRow(
                  label: 'Tài khoản',
                  value: currentUser?.email ?? '—',
                ),
                const SizedBox(height: 8),
                _SessionDetailRow(
                  label: 'Thiết bị',
                  value: session?.deviceLabel ?? 'Chưa có phiên hoạt động',
                ),
                const SizedBox(height: 8),
                _SessionDetailRow(
                  label: 'Đăng nhập lúc',
                  value: session == null
                      ? '—'
                      : _formatDateTime(session.startedAt),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Thông tin phiên hiện được lưu trong bộ nhớ ứng dụng. '
                  'Quản lý nhiều thiết bị và thu hồi phiên sẽ được kết nối khi tích hợp Backend.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.slate500,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const ListTile(
            tileColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.all(Radius.circular(14)),
            ),
            leading: Icon(Icons.info_outline, color: AppColors.brand),
            title: Text('Phiên bản ứng dụng'),
            trailing: Text(
              '1.0.0',
              style: TextStyle(color: AppColors.slate500),
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionDetailRow extends StatelessWidget {
  const _SessionDetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 112,
          child: Text(
            label,
            style: const TextStyle(color: AppColors.slate500, fontSize: 13),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              color: AppColors.slate900,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

String _formatDateTime(DateTime value) {
  final date = value.toLocal();
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$day/$month/${date.year} $hour:$minute';
}
