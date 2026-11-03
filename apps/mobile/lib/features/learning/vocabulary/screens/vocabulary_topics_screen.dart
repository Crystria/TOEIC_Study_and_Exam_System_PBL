import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/learning/review/screens/review_goal_settings_screen.dart';
import 'package:toeic_mobile/features/learning/review/screens/review_select_words_screen.dart';
import 'package:toeic_mobile/features/learning/vocabulary/screens/vocabulary_screen.dart';

import '../../../../core/navigation/app_navigation_state.dart';
import '../../../../theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/progress_row.dart';

class VocabularyTopicSummary {
  const VocabularyTopicSummary({
    required this.id,
    required this.name,
    required this.learned,
    required this.total,
    required this.color,
  });

  final String id;
  final String name;
  final int learned;
  final int total;
  final Color color;
}

class VocabularyTopicsScreen extends StatelessWidget {
  const VocabularyTopicsScreen({super.key});

  // TODO: lấy từ GET /learning/vocabulary-topics + /learning/progress
  static const int _dailyLearned = 8;
  static const int _dailyGoal = 20;
  static const int _dueForReview = 27;

  static const List<VocabularyTopicSummary> _topics = [
    VocabularyTopicSummary(
      id: 'VOCAB-01',
      name: 'Office & Business',
      learned: 7,
      total: 20,
      color: AppColors.brand,
    ),
    VocabularyTopicSummary(
      id: 'VOCAB-02',
      name: 'Travel & Transport',
      learned: 12,
      total: 24,
      color: AppColors.brand,
    ),
    VocabularyTopicSummary(
      id: 'VOCAB-03',
      name: 'Finance & Banking',
      learned: 0,
      total: 30,
      color: AppColors.slate400,
    ),
    VocabularyTopicSummary(
      id: 'VOCAB-04',
      name: 'Human Resources',
      learned: 5,
      total: 18,
      color: AppColors.brand,
    ),
    VocabularyTopicSummary(
      id: 'VOCAB-05',
      name: 'Marketing',
      learned: 18,
      total: 18,
      color: AppColors.success,
    ),
  ];

  Future<void> _onChangeGoal(BuildContext context) async {
    final newGoal = await Navigator.of(context).push<int>(
      MaterialPageRoute(
        builder: (_) => const ReviewGoalSettingsScreen(),
      ),
    );

    if (newGoal != null) {
      // Cập nhật mục tiêu tại đây.
    }
  }
  void _onReviewLearned(BuildContext context) {
    Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute(
        builder: (_) => const ReviewSelectWordsScreen(),
      ),
    );
  }
  void _onOpenTopic(BuildContext context, VocabularyTopicSummary topic) {
    AppNavigationState.hideBottomNavigation();

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const VocabularyScreen(),
      ),
    ).whenComplete(() {
        AppNavigationState.showBottomNavigation();
      }
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Từ vựng',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  Text(
                    '${_topics.length} chủ đề',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.slate500,
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
                        const Text(
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
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text(
                          '$_dailyLearned / $_dailyGoal đã ôn',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.slate900,
                          ),
                        ),
                        Text(
                          '40%',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.brand,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: const LinearProgressIndicator(
                        value: _dailyLearned / _dailyGoal,
                        minHeight: 6,
                        backgroundColor: AppColors.border,
                        valueColor: AlwaysStoppedAnimation(AppColors.brand),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              AppCard(
                child: InkWell(
                  onTap: () => _onReviewLearned(context),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              'Ôn lại từ đã học',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.slate900,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Chọn từ muốn ôn lại · $_dueForReview từ',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.slate500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right,
                        color: AppColors.slate400,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Chủ đề',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.slate900,
                ),
              ),
              AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: _topics
                      .map(
                        (t) => ProgressRow(
                          title: t.name,
                          progressText: '${t.learned}/${t.total}',
                          value: t.total == 0 ? 0 : t.learned / t.total,
                          color: t.color,
                          onTap: () => _onOpenTopic(context, t),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
