import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

class TextLinkButton extends StatelessWidget {
  const TextLinkButton({
    super.key,
    required this.label,
    required this.onTap,
    this.leadingIcon,
    this.centered = true,
  });

  final String label;
  final VoidCallback onTap;
  final IconData? leadingIcon;
  final bool centered;

  @override
  Widget build(BuildContext context) {
    final content = GestureDetector(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (leadingIcon != null) ...[
            Icon(leadingIcon, size: 16, color: AppColors.brand),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.brand,
            ),
          ),
        ],
      ),
    );
    return centered ? Center(child: content) : content;
  }
}
