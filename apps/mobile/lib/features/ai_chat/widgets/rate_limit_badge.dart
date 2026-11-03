import 'package:flutter/material.dart';

import '../../../shared/widgets/app_badge.dart';
import '../../../theme/app_colors.dart';

class RateLimitBadge extends StatelessWidget {
  const RateLimitBadge({
    super.key,
    required this.remaining,
    required this.limit,
  });

  final int remaining;
  final int limit;

  @override
  Widget build(BuildContext context) {
    return AppPillBadge(
      label: 'Còn $remaining/$limit lượt',
      bg: AppColors.blueChipBg,
      fg: AppColors.blueChipFg,
    );
  }
}
