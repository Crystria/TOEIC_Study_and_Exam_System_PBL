import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/config/app_config.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../../theme/app_colors.dart';
import '../../auth/providers/auth_session_provider.dart';
import '../services/avatar_image_source.dart';
import 'edit_profile_screen.dart';
import 'settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.loginRouteBuilder,
    this.avatarImageSource,
  });

  final WidgetBuilder loginRouteBuilder;
  final AvatarImageSource? avatarImageSource;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final AvatarImageSource _avatarImageSource =
      widget.avatarImageSource ?? DeviceAvatarImageSource();
  bool _isPickingAvatar = false;

  Future<void> _onPickAvatar() async {
    final session = context.read<AuthSessionProvider>();
    if (!session.isAuthenticated ||
        session.isUpdatingAvatar ||
        session.isUpdatingProfile ||
        _isPickingAvatar) {
      return;
    }

    final initiatingUserId = session.currentUserId;
    final initiatingSessionId = session.currentSession?.id;
    setState(() => _isPickingAvatar = true);

    try {
      final image = await _avatarImageSource.pickFromGallery();
      if (image == null || !mounted) return;

      final latestSession = context.read<AuthSessionProvider>();
      if (latestSession.currentUserId != initiatingUserId ||
          latestSession.currentSession?.id != initiatingSessionId) {
        _showMessage(
          'Phiên tài khoản đã thay đổi. '
          'Vui lòng chọn ảnh lại cho tài khoản hiện tại.',
        );
        return;
      }

      final updatedUser = await latestSession.updateAvatar(
        imageBytes: image.bytes,
        contentType: image.contentType,
      );
      if (!mounted) return;

      if (updatedUser == null) {
        _showMessage(
          latestSession.errorMessage ??
              'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.',
        );
      } else {
        _showMessage('Đã cập nhật ảnh đại diện.');
      }
    } on AvatarImageSelectionException catch (error) {
      if (mounted) _showMessage(error.message);
    } on PlatformException {
      if (mounted) {
        _showMessage('Không thể mở thư viện ảnh. Vui lòng thử lại.');
      }
    } catch (_) {
      if (mounted) {
        _showMessage('Không thể chọn ảnh đại diện. Vui lòng thử lại.');
      }
    } finally {
      if (mounted) setState(() => _isPickingAvatar = false);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _onLogout(BuildContext context) async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Đăng xuất'),
        content: const Text('Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Đăng xuất'),
          ),
        ],
      ),
    );

    if (shouldLogout != true || !context.mounted) return;

    // Xóa User và metadata session trước khi thay toàn bộ root navigation
    // stack. Các nested Navigator của Home cũng bị hủy theo route này.
    await context.read<AuthSessionProvider>().logout();
    if (!context.mounted) return;

    Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
      MaterialPageRoute(builder: widget.loginRouteBuilder),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthSessionProvider>();
    final config = context.watch<AppConfig>();
    final user = session.currentUser;
    final canUpdateAvatar = config.isAuthApiEnabled && session.isAuthenticated;
    final isAvatarBusy =
        canUpdateAvatar &&
        (_isPickingAvatar ||
            session.isUpdatingAvatar ||
            session.isUpdatingProfile);

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text(
          'Cá nhân',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        backgroundColor: AppColors.bg,
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    UserAvatar(avatarUrl: user?.avatarUrl, radius: 30),
                    if (canUpdateAvatar)
                      Positioned(
                        right: -3,
                        bottom: -3,
                        child: Tooltip(
                          message: 'Thay đổi ảnh đại diện',
                          child: Material(
                            color: AppColors.brand,
                            shape: const CircleBorder(),
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: isAvatarBusy ? null : _onPickAvatar,
                              child: SizedBox(
                                width: 28,
                                height: 28,
                                child: Center(
                                  child: isAvatarBusy
                                      ? const SizedBox(
                                          width: 15,
                                          height: 15,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.edit_outlined,
                                          size: 15,
                                          color: Colors.white,
                                        ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.fullName ?? 'Chưa có thông tin tài khoản',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: AppColors.slate900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        user?.email ??
                            'Thông tin sẽ hiển thị sau khi đăng nhập',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.slate500,
                        ),
                      ),
                      if (canUpdateAvatar) ...[
                        const SizedBox(height: 6),
                        TextButton.icon(
                          onPressed: isAvatarBusy ? null : _onPickAvatar,
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(0, 30),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            alignment: Alignment.centerLeft,
                          ),
                          icon: const Icon(
                            Icons.photo_library_outlined,
                            size: 16,
                          ),
                          label: Text(
                            isAvatarBusy
                                ? 'Đang cập nhật...'
                                : 'Đổi ảnh đại diện',
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Tài khoản',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.slate500,
            ),
          ),
          const SizedBox(height: 8),
          _ProfileMenuTile(
            icon: Icons.manage_accounts_outlined,
            title: 'Chỉnh sửa thông tin',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const EditProfileScreen()),
            ),
          ),
          const SizedBox(height: 8),
          _ProfileMenuTile(
            icon: Icons.settings_outlined,
            title: 'Cài đặt',
            onTap: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () => _onLogout(context),
            icon: const Icon(Icons.logout, color: AppColors.danger),
            label: const Text(
              'Đăng xuất',
              style: TextStyle(color: AppColors.danger),
            ),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              side: const BorderSide(color: AppColors.danger),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileMenuTile extends StatelessWidget {
  const _ProfileMenuTile({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        leading: Icon(icon, color: AppColors.brand),
        title: Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.slate900,
          ),
        ),
        trailing: const Icon(Icons.chevron_right, color: AppColors.slate400),
        onTap: onTap,
      ),
    );
  }
}
