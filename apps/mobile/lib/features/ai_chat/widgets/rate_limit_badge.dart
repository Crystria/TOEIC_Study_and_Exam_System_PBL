import 'package:flutter/material.dart';

import '../../../shared/widgets/app_badge.dart';
import '../../../theme/app_colors.dart';

class RateLimitBadge extends StatelessWidget {
  const RateLimitBadge({
    super.key,
    required this.remaining,
    required this.limit,
    this.isLoading = false,
    this.isPreview = true,
    this.isQuotaBlocked = false,
  });

  final int remaining;
  final int limit;
  final bool isLoading;
  final bool isPreview;
  final bool isQuotaBlocked;

  @override
  Widget build(BuildContext context) {
    final exhausted = remaining <= 0 || isQuotaBlocked;
    final label = isLoading
        ? 'Đang tải lượt…'
        : exhausted
        ? 'Hết lượt hôm nay'
        : 'Còn $remaining/$limit lượt';

    final badge = AppPillBadge(
      label: label,
      bg: exhausted ? AppColors.dangerBg : AppColors.blueChipBg,
      fg: exhausted ? AppColors.danger : AppColors.blueChipFg,
    );

    return Tooltip(
      message: isPreview
          ? 'Số lượt đang hiển thị là dữ liệu mô phỏng trong phiên ứng dụng, chưa phải hạn mức do máy chủ xác nhận.'
          : 'Hạn mức được đồng bộ từ máy chủ.',
      child: badge,
    );
  }
}
