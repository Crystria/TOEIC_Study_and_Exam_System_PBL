import 'package:flutter/material.dart';

import 'rate_limit_badge.dart';
import '../../../theme/app_colors.dart';

class AiChatAppBar extends StatelessWidget {
  const AiChatAppBar({
    super.key,
    required this.title,
    required this.remaining,
    required this.limit,
    this.isUsageLoading = false,
    this.usageIsPreview = true,
    this.isQuotaBlocked = false,
    this.onHistory,
    this.onNewConversation,
  });

  final String title;
  final int remaining;
  final int limit;
  final bool isUsageLoading;
  final bool usageIsPreview;
  final bool isQuotaBlocked;
  final VoidCallback? onHistory;
  final VoidCallback? onNewConversation;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.slate900,
            ),
          ),
        ),
        RateLimitBadge(
          remaining: remaining,
          limit: limit,
          isLoading: isUsageLoading,
          isPreview: usageIsPreview,
          isQuotaBlocked: isQuotaBlocked,
        ),
        if (onHistory != null)
          IconButton(
            onPressed: onHistory,
            icon: const Icon(
              Icons.list_alt_outlined,
              color: AppColors.slate500,
            ),
          ),
        if (onNewConversation != null)
          IconButton(
            onPressed: onNewConversation,
            icon: const Icon(Icons.add, color: AppColors.slate500),
          ),
      ],
    );
  }
}
