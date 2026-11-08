import 'package:flutter/foundation.dart';

/// Thông tin tài khoản dùng chung giữa Auth và Profile.
@immutable
class AppUser {
  const AppUser({
    required this.id,
    required this.fullName,
    required this.email,
    this.emailVerified = true,
  });

  final String id;
  final String fullName;
  final String email;
  final bool emailVerified;

  AppUser copyWith({
    String? id,
    String? fullName,
    String? email,
    bool? emailVerified,
  }) {
    return AppUser(
      id: id ?? this.id,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      emailVerified: emailVerified ?? this.emailVerified,
    );
  }
}
