import 'package:flutter/material.dart';

import '../../../shared/widgets/app_card.dart';
import '../../../theme/app_colors.dart';

class ResultSummaryCard extends StatelessWidget {
  const ResultSummaryCard({
    super.key,
    required this.value,
    this.caption,
    this.lines = const [],
    this.footnote,
  });

  final String value;
  final String? caption;
  final List<String> lines;
  final String? footnote;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 40,
              fontWeight: FontWeight.w800,
              color: AppColors.brand,
              height: 1.1,
            ),
          ),
          if (caption != null)
            Text(
              caption!,
              style: const TextStyle(fontSize: 13, color: AppColors.slate500),
            ),
          if (lines.isNotEmpty) const SizedBox(height: 6),
          for (final line in lines)
            Text(
              line,
              style: const TextStyle(fontSize: 13, color: AppColors.slate500),
            ),
          if (footnote != null) ...[
            const SizedBox(height: 4),
            Text(
              footnote!,
              style: const TextStyle(fontSize: 12, color: AppColors.slate400),
            ),
          ],
        ],
      ),
    );
  }
}
