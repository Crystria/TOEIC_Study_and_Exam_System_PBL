import 'package:flutter/foundation.dart';

import '../../../shared/models/app_user.dart';
import '../models/auth_session.dart';

/// Giữ thông tin người dùng và phiên đăng nhập hiện tại ở scope ứng dụng.
///
/// Session chỉ tồn tại trong bộ nhớ. Khôi phục session, token và quản lý nhiều
/// thiết bị sẽ được thực hiện khi tích hợp Backend.
class AuthSessionProvider extends ChangeNotifier {
  AppUser? _currentUser;
  AuthSession? _currentSession;

  AppUser? get currentUser => _currentUser;
  AuthSession? get currentSession => _currentSession;

  bool get hasCurrentUser => _currentUser != null;
  bool get hasActiveSession => _currentSession != null;

  /// Chỉ coi là đã xác thực khi User và session cùng tồn tại, đồng thời
  /// session thuộc đúng User hiện tại.
  bool get isAuthenticated {
    final user = _currentUser;
    final session = _currentSession;
    return user != null && session?.userId == user.id;
  }

  /// Đặt User sau khi đăng nhập/xác thực thành công.
  ///
  /// Nếu cùng User đang có session, việc cập nhật thông tin Profile không làm
  /// thay đổi thời điểm bắt đầu session. Nếu chuyển từ trạng thái chưa đăng
  /// nhập hoặc sang User khác, tạo metadata session mới cho thiết bị hiện tại.
  void setCurrentUser(AppUser user) {
    final isSameActiveUser =
        _currentUser?.id == user.id && _currentSession?.userId == user.id;

    _currentUser = user;
    if (!isSameActiveUser) {
      final now = DateTime.now();
      _currentSession = AuthSession(
        id: 'local-session-${now.microsecondsSinceEpoch}',
        userId: user.id,
        startedAt: now,
      );
    }
    notifyListeners();
  }

  void clearCurrentUser() {
    if (_currentUser == null && _currentSession == null) return;
    _currentUser = null;
    _currentSession = null;
    notifyListeners();
  }
}
