import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/config/app_config.dart';
import '../../../core/storage/vocabulary_progress_storage.dart';
import '../../../theme/app_colors.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../../auth/screens/change_password_screen.dart';
import '../../learning/providers/vocabulary_provider.dart';
import '../../learning/providers/vocabulary_topic_provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _notificationsEnabled = true;
  bool _isLoadingNotifications = true;
  bool _isSavingNotifications = false;
  bool _hasUnassignedLegacyData = false;
  bool _isImportingLegacyData = false;
  String? _settingsUserId;
  int _settingsLoadRevision = 0;
  bool _settingsReloadScheduled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadNotifications());
  }

  Future<void> _loadNotifications() async {
    if (!mounted) return;
    final revision = ++_settingsLoadRevision;
    final session = context.read<AuthSessionProvider>();
    final userId = session.currentUser?.id;
    if (userId == null || userId.trim().isEmpty) {
      _settingsUserId = null;
      setState(() {
        _isLoadingNotifications = false;
        _isSavingNotifications = false;
        _hasUnassignedLegacyData = false;
      });
      return;
    }

    _settingsUserId = userId;
    setState(() => _isLoadingNotifications = true);
    try {
      final storage = context.read<VocabularyProgressStorage>();
      final topicsProvider = context.read<VocabularyTopicsProvider>();
      final snapshot = await storage.loadSnapshot();
      if (!_isCurrentSettingsLoad(revision, userId, storage, session)) return;

      final hasLegacyData = await storage.hasUnassignedLegacyData();
      if (!_isCurrentSettingsLoad(revision, userId, storage, session)) return;

      await topicsProvider.refreshProgress();
      if (!_isCurrentSettingsLoad(revision, userId, storage, session)) return;

      setState(() {
        _notificationsEnabled = snapshot.remindEnabled;
        _hasUnassignedLegacyData = hasLegacyData;
        _isLoadingNotifications = false;
      });
    } catch (_) {
      if (!mounted || revision != _settingsLoadRevision) return;
      setState(() => _isLoadingNotifications = false);
    }
  }

  bool _isCurrentSettingsLoad(
    int revision,
    String userId,
    VocabularyProgressStorage storage,
    AuthSessionProvider session,
  ) {
    return mounted &&
        revision == _settingsLoadRevision &&
        session.currentUser?.id == userId &&
        storage.activeUserId == userId;
  }

  void _scheduleReloadForAccount(String? currentUserId) {
    if (currentUserId == _settingsUserId || _settingsReloadScheduled) return;
    _settingsReloadScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _settingsReloadScheduled = false;
      if (!mounted) return;
      final activeUserId = context.read<AuthSessionProvider>().currentUser?.id;
      if (activeUserId != _settingsUserId) {
        _loadNotifications();
      }
    });
  }

  Future<void> _importLegacyProgress() async {
    if (_isImportingLegacyData || !_hasUnassignedLegacyData) return;
    final userId = _settingsUserId;
    if (userId == null ||
        context.read<AuthSessionProvider>().currentUser?.id != userId) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Nhập dữ liệu học cũ?'),
        content: const Text(
          'Dữ liệu này được lưu trước khi ứng dụng tách tiến trình theo tài khoản. '
          'Chỉ nhập khi bạn xác nhận dữ liệu đó thuộc về tài khoản đang đăng nhập. '
          'Dữ liệu hiện có của tài khoản sẽ không bị ghi đè.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Để sau'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Xác nhận nhập'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _isImportingLegacyData = true);
    try {
      final storage = context.read<VocabularyProgressStorage>();
      await storage.importUnassignedLegacyData(confirmOwnership: true);
      if (!mounted ||
          context.read<AuthSessionProvider>().currentUser?.id != userId ||
          storage.activeUserId != userId) {
        return;
      }

      await Future.wait([
        context.read<VocabularyProvider>().refreshPersistedProgress(),
        context.read<VocabularyTopicsProvider>().refreshProgress(),
      ]);
      if (!mounted ||
          context.read<AuthSessionProvider>().currentUser?.id != userId) {
        return;
      }
      setState(() => _hasUnassignedLegacyData = false);
      _showSettingsMessage('Đã nhập tiến trình học cũ cho tài khoản này.');
    } catch (error) {
      if (!mounted) return;
      _showSettingsMessage(
        error is StateError
            ? error.message.toString()
            : 'Không thể nhập dữ liệu học cũ. Vui lòng thử lại.',
      );
    } finally {
      if (mounted) setState(() => _isImportingLegacyData = false);
    }
  }

  void _showSettingsMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _updateNotifications(bool value) async {
    if (_isSavingNotifications || _isLoadingNotifications) return;
    final auth = context.read<AuthSessionProvider>();
    if (auth.currentUser?.id != _settingsUserId || _settingsUserId == null) {
      return;
    }
    setState(() => _isSavingNotifications = true);
    try {
      await context.read<VocabularyProgressStorage>().saveReminderEnabled(
        value,
      );
      if (!mounted ||
          context.read<AuthSessionProvider>().currentUser?.id !=
              _settingsUserId) {
        return;
      }

      // VocabularyTopicsProvider is the single in-memory source for review
      // goal/reminder preferences. Refresh it after the Settings screen writes.
      await context.read<VocabularyTopicsProvider>().refreshProgress();
      if (!mounted ||
          context.read<AuthSessionProvider>().currentUser?.id !=
              _settingsUserId) {
        return;
      }
      setState(() => _notificationsEnabled = value);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể lưu cài đặt thông báo.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSavingNotifications = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sessionProvider = context.watch<AuthSessionProvider>();
    final session = sessionProvider.currentSession;
    final currentUser = sessionProvider.currentUser;
    final apiEnabled = context.watch<AppConfig>().apiEnabled;
    _scheduleReloadForAccount(currentUser?.id);

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
          if (_hasUnassignedLegacyData)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.blueChipBg,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Có dữ liệu học từ phiên bản cũ',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.slate900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Dữ liệu chưa được gắn với tài khoản nào. Bạn có thể nhập sau khi xác nhận quyền sở hữu.',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.slate700,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton(
                    onPressed: _isImportingLegacyData
                        ? null
                        : _importLegacyProgress,
                    child: _isImportingLegacyData
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Kiểm tra và nhập dữ liệu'),
                  ),
                ],
              ),
            ),
          SwitchListTile.adaptive(
            value: _notificationsEnabled,
            onChanged: _isLoadingNotifications || _isSavingNotifications
                ? null
                : _updateNotifications,
            title: const Text('Thông báo nhắc học'),
            subtitle: const Text(
              'Lưu tùy chọn theo tài khoản; thông báo thiết bị chưa được lập lịch.',
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
              subtitle: Text(
                apiEnabled
                    ? 'Chưa khả dụng với Backend hiện tại'
                    : 'Cập nhật mật khẩu cho tài khoản thử nghiệm',
              ),
              trailing: const Icon(
                Icons.chevron_right,
                color: AppColors.slate400,
              ),
              onTap: apiEnabled
                  ? () => _showSettingsMessage(
                      'Backend hiện chưa cung cấp API đổi mật khẩu.',
                    )
                  : () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const ChangePasswordScreen(),
                      ),
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
                  'Token đăng nhập được lưu trong vùng lưu trữ bảo mật của thiết bị. '
                  'Mã phiên hiển thị tại đây là metadata cục bộ, không phải session ID của Backend.',
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
