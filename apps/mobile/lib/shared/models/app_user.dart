import 'package:flutter/foundation.dart';

/// Domain model for the authenticated learner profile.
///
/// Authentication credentials are intentionally kept outside this model.
@immutable
class AppUser {
  const AppUser({
    required this.id,
    required this.fullName,
    required this.email,
    this.emailVerified = true,
    this.phoneNumber,
    this.avatarKey,
    this.avatarUrl,
    this.status,
    this.roles = const <String>[],
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String fullName;
  final String email;
  final bool emailVerified;
  final String? phoneNumber;
  final String? avatarKey;
  final String? avatarUrl;
  final String? status;
  final List<String> roles;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  AppUser copyWith({
    String? id,
    String? fullName,
    String? email,
    bool? emailVerified,
    String? phoneNumber,
    bool clearPhoneNumber = false,
    String? avatarKey,
    bool clearAvatarKey = false,
    String? avatarUrl,
    bool clearAvatarUrl = false,
    String? status,
    List<String>? roles,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return AppUser(
      id: id ?? this.id,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      emailVerified: emailVerified ?? this.emailVerified,
      phoneNumber: clearPhoneNumber ? null : phoneNumber ?? this.phoneNumber,
      avatarKey: clearAvatarKey ? null : avatarKey ?? this.avatarKey,
      avatarUrl: clearAvatarUrl ? null : avatarUrl ?? this.avatarUrl,
      status: status ?? this.status,
      roles: roles ?? this.roles,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
