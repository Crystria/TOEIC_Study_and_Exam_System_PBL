import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final title = Text(
      text,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w800,
        color: AppColors.slate900,
      ),
    );
    if (trailing == null) return title;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [title, trailing!],
    );
  }
}
