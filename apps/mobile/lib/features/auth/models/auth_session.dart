import 'package:flutter/foundation.dart';

/// Thông tin phiên đăng nhập đang hoạt động trên instance ứng dụng hiện tại.
///
/// Đây là metadata mock trong bộ nhớ, không đại diện cho session/token Backend.
@immutable
class AuthSession {
  const AuthSession({
    required this.id,
    required this.userId,
    required this.startedAt,
    this.deviceLabel = 'Thiết bị hiện tại',
  });

  final String id;
  final String userId;
  final DateTime startedAt;
  final String deviceLabel;
}
