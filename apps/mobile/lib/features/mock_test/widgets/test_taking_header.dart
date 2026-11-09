import 'package:flutter/material.dart';

import '../../../shared/widgets/app_badge.dart';
import '../../../theme/app_colors.dart';

class TestTakingHeader extends StatelessWidget {
  const TestTakingHeader({
    super.key,
    required this.title,
    required this.isFullTest,
    required this.remainingSeconds,
  });

  final String title;
  final bool isFullTest;
  final int remainingSeconds;

  String get _timeLabel {
    final hours = remainingSeconds ~/ 3600;
    final minutes = (remainingSeconds % 3600) ~/ 60;
    final seconds = remainingSeconds % 60;
    final mm = minutes.toString().padLeft(2, '0');
    final ss = seconds.toString().padLeft(2, '0');
    return hours > 0
        ? '${hours.toString().padLeft(2, '0')}:$mm:$ss'
        : '$mm:$ss';
  }

  @override
  Widget build(BuildContext context) {
    final warning = remainingSeconds <= 300;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.slate900,
                  ),
                ),
                const SizedBox(height: 4),
                AppBadge(
                  label: isFullTest ? 'FULL · 200 câu' : 'PART PRACTICE',
                  bg: AppColors.blueChipBg,
                  fg: AppColors.blueChipFg,
                  fontSize: 10,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: warning ? AppColors.dangerBg : AppColors.slate50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: warning
                    ? AppColors.danger.withValues(alpha: 0.25)
                    : AppColors.border,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.timer_outlined,
                  size: 17,
                  color: warning ? AppColors.danger : AppColors.slate700,
                ),
                const SizedBox(width: 6),
                Text(
                  _timeLabel,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: warning ? AppColors.danger : AppColors.slate900,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
