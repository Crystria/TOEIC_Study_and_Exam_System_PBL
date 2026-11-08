import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

class AuthFooterLink extends StatelessWidget {
  const AuthFooterLink({
    super.key,
    required this.text,
    required this.actionText,
    required this.onTap,
    this.enabled = true,
  });

  final String text;
  final String actionText;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          text,
          style: const TextStyle(fontSize: 14, color: AppColors.slate500),
        ),
        GestureDetector(
          onTap: enabled ? onTap : null,
          child: Text(
            actionText,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: enabled ? AppColors.brand : AppColors.slate400,
            ),
          ),
        ),
      ],
    );
  }
}
