import 'package:flutter/material.dart';

import '../../../shared/widgets/app_card.dart';
import '../../../theme/app_colors.dart';

class PredictionScoreCard extends StatelessWidget {
  const PredictionScoreCard({
    super.key,
    required this.score,
    required this.max,
    required this.note,
  });

  final int score;
  final int max;
  final String note;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Điểm TOEIC dự đoán',
            style: TextStyle(fontSize: 13, color: AppColors.slate500),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '$score',
                style: const TextStyle(
                  fontSize: 44,
                  fontWeight: FontWeight.w800,
                  color: AppColors.brand,
                  height: 1.1,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '/ $max',
                style: const TextStyle(fontSize: 18, color: AppColors.slate400),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: score / max,
              minHeight: 8,
              backgroundColor: AppColors.border,
              valueColor: const AlwaysStoppedAnimation(AppColors.brand),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            note,
            style: const TextStyle(fontSize: 12, color: AppColors.slate400),
          ),
        ],
      ),
    );
  }
}
