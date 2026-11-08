import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

class DetailTitleRow extends StatelessWidget {
  const DetailTitleRow({
    super.key,
    required this.title,
    required this.dateLabel,
  });

  final String title;
  final String dateLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppColors.slate900,
          ),
        ),
        Text(
          dateLabel,
          style: const TextStyle(fontSize: 13, color: AppColors.slate500),
        ),
      ],
    );
  }
}
