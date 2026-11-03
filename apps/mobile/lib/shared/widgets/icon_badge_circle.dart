import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

class IconBadgeCircle extends StatelessWidget {
  const IconBadgeCircle({
    super.key,
    required this.icon,
    this.size = 64,
    this.bg = AppColors.blueChipBg,
    this.fg = AppColors.brand,
    this.borderRadius = 18,
  });

  final IconData icon;
  final double size;
  final Color bg;
  final Color fg;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
      child: Icon(icon, color: fg, size: size * 0.5),
    );
  }
}
