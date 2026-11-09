import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

class SuccessCheck extends StatelessWidget {
  const SuccessCheck({super.key, this.size = 72});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: AppColors.success,
        shape: BoxShape.circle,
      ),
      child: Icon(Icons.check, color: Colors.white, size: size * 0.5),
    );
  }
}
