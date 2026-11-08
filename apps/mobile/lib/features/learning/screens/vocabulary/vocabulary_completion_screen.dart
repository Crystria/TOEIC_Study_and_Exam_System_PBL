import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/full_screen_flow_scope.dart';

import '../../../../theme/app_colors.dart';
import '../../providers/vocabulary_topic_provider.dart';
import '../quiz/quick_quiz_screen.dart';

class VocabularyCompletionScreen extends StatelessWidget {
  const VocabularyCompletionScreen({super.key, required this.topicName});

  final String topicName;

  @override
  Widget build(BuildContext context) {
    final topics = context.watch<VocabularyTopicsProvider>();
    final progress = topics.dailyProgress;
    final completedGoal = topics.dailyGoalCompleted;

    return FullScreenFlowScope(
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.check_circle_rounded,
                    size: 68,
                    color: AppColors.success,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Hoàn thành lượt học!',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 23,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Bạn đã hoàn thành lượt học $topicName hôm nay.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.slate500,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      children: [
                        Text(
                          '${topics.dailyLearned} / ${topics.dailyGoal} từ',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AppColors.brand,
                          ),
                        ),
                        const SizedBox(height: 10),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                            value: progress,
                            minHeight: 7,
                            backgroundColor: AppColors.border,
                            valueColor: const AlwaysStoppedAnimation(
                              AppColors.brand,
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          completedGoal
                              ? 'Bạn đã hoàn thành mục tiêu từ vựng hôm nay.'
                              : 'Bạn còn ${topics.dailyGoal - topics.dailyLearned} từ để đạt mục tiêu hôm nay.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            color: completedGoal
                                ? AppColors.success
                                : AppColors.slate500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: completedGoal
                          ? () => Navigator.of(context).push<void>(
                              MaterialPageRoute<void>(
                                builder: (_) => const FullScreenFlowScope(
                                  child: QuickQuizScreen(),
                                ),
                              ),
                            )
                          : null,
                      icon: const Icon(Icons.quiz_outlined),
                      label: Text(
                        completedGoal
                            ? 'Làm Quiz 5 câu'
                            : 'Hoàn thành mục tiêu để mở khóa Quiz',
                      ),
                    ),
                  ),
                  if (!completedGoal) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Còn ${topics.dailyGoal - topics.dailyLearned} từ để mở khóa Quiz.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Quay lại danh sách từ vựng'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
