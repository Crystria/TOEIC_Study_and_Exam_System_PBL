import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

/// Circular user avatar with a safe fallback for missing or invalid URLs.
///
/// Only HTTP(S) URLs are rendered. Image loading failures fall back to the
/// same local placeholder used when the user has no avatar.
class UserAvatar extends StatelessWidget {
  const UserAvatar({super.key, required this.avatarUrl, required this.radius})
    : assert(radius > 0);

  final String? avatarUrl;
  final double radius;

  Uri? get _imageUri {
    final value = avatarUrl?.trim();
    if (value == null || value.isEmpty) return null;

    final uri = Uri.tryParse(value);
    if (uri == null ||
        !uri.hasAuthority ||
        uri.host.isEmpty ||
        (uri.scheme != 'https' && uri.scheme != 'http') ||
        uri.userInfo.isNotEmpty) {
      return null;
    }

    return uri;
  }

  Widget _placeholder() {
    return Icon(Icons.person, size: radius * 1.05, color: AppColors.brand);
  }

  @override
  Widget build(BuildContext context) {
    final uri = _imageUri;
    final diameter = radius * 2;

    return Semantics(
      label: 'Ảnh đại diện',
      image: true,
      child: CircleAvatar(
        radius: radius,
        backgroundColor: AppColors.blueChipBg,
        child: uri == null
            ? _placeholder()
            : ClipOval(
                child: SizedBox(
                  width: diameter,
                  height: diameter,
                  child: Image.network(
                    uri.toString(),
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) =>
                        _placeholder(),
                  ),
                ),
              ),
      ),
    );
  }
}
