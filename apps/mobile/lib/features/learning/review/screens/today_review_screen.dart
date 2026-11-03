import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/learning/review/screens/review_goal_settings_screen.dart';
import 'package:toeic_mobile/features/learning/vocabulary/screens/vocabulary_screen.dart';

import '../../../../theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/stat_card.dart';

class TodayReviewScreen extends StatelessWidget {
  const TodayReviewScreen({super.key});

  // TODO: lấy từ GET /learning/review-today
  static const int _goal = 20;
  static const int _reviewCount = 15;
  static const int _newCount = 5;
  static const int _estimateMinutes = 12;
  static const List<Map<String, String>> _preview = [
    {'word': 'negotiate', 'meaning': 'thương lượng'},
    {'word': 'invoice', 'meaning': 'hóa đơn'},
  ];

  void _onChangeGoal(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const ReviewGoalSettingsScreen(),
      ),
    );
  }

  void _onStart(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => VocabularyScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Ôn tập hôm nay',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Mục tiêu hôm nay',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.slate500,
                          ),
                        ),
                        GestureDetector(
                          onTap: () => _onChangeGoal(context),
                          child: const Text(
                            'Đổi mục tiêu',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.brand,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      '$_goal từ/ngày',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.brand,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Đã ôn 8 / $_goal từ hôm nay',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: StatCard(
                      value: '$_reviewCount',
                      label: 'Từ ôn lại',
                      color: AppColors.brand,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: StatCard(
                      value: '$_newCount',
                      label: 'Từ mới',
                      color: AppColors.success,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: StatCard(
                      value: '~$_estimateMinutes',
                      label: 'Phút',
                      color: AppColors.purpleChipFg,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Từ sẽ ôn hôm nay',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate900,
                      ),
                    ),
                    const Text(
                      'chương trình nghị sự',
                      style: TextStyle(fontSize: 12, color: AppColors.slate400),
                    ),
                    const SizedBox(height: 8),
                    ..._preview.map(
                          (w) =>
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  w['word']!,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.slate900,
                                  ),
                                ),
                                Text(
                                  w['meaning']!,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.slate500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => _onStart(context),
                child: const Text('Bắt đầu ôn tập'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
