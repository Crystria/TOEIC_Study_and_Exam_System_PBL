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
    late final String label;
    if (isLoading) {
      label = 'Đang tải lượt…';
    } else if (exhausted) {
      label = isPreview ? 'Demo · hết lượt' : 'Hết lượt hôm nay';
    } else if (isPreview) {
      label = 'Demo · $remaining/$limit';
    } else {
      label = 'Còn $remaining/$limit lượt';
    }

    final badge = AppPillBadge(
      label: label,
      bg: exhausted ? AppColors.dangerBg : AppColors.blueChipBg,
      fg: exhausted ? AppColors.danger : AppColors.blueChipFg,
    );

    return Tooltip(
      message: isPreview
          ? 'AI Chat hiện đang chạy ở chế độ mô phỏng. '
                'Tin nhắn mới và lịch sử chỉ được giữ trong bộ nhớ phiên ứng dụng; '
                'số lượt hiển thị cũng là dữ liệu mô phỏng, không phải hạn mức '
                'do máy chủ xác nhận.'
          : 'Hạn mức được đồng bộ từ máy chủ.',
      child: badge,
    );
  }
}
