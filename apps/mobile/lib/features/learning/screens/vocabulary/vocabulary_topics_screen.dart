import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:toeic_mobile/features/learning/providers/vocabulary_provider.dart';

import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/progress_row.dart';
import '../../../../shared/widgets/stat_card.dart';
import '../../../../theme/app_colors.dart';
import '../../providers/vocabulary_topic_provider.dart';
import '../quiz/quick_quiz_screen.dart';
import '../review/review_goal_settings_screen.dart';
import '../review/review_select_words_screen.dart';
import 'vocabulary_screen.dart';

class VocabularyTopicsScreen extends StatefulWidget {
  const VocabularyTopicsScreen({super.key});

  @override
  State<VocabularyTopicsScreen> createState() => _VocabularyTopicsScreenState();
}

class _VocabularyTopicsScreenState extends State<VocabularyTopicsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<VocabularyTopicsProvider>();
      if (provider.status == TopicsStatus.idle ||
          provider.status == TopicsStatus.error) {
        provider.loadTopics();
      }
    });
  }

  Future<void> _onChangeGoal() async {
    final newGoal = await Navigator.of(context).push<int>(
      MaterialPageRoute(
        builder: (_) => ReviewGoalSettingsScreen(
          initialGoal: context.read<VocabularyTopicsProvider>().dailyGoal,
        ),
      ),
    );
    if (!mounted || newGoal == null) return;
    await context.read<VocabularyTopicsProvider>().setDailyGoal(newGoal);
  }

  void _onReviewLearned() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const ReviewSelectWordsScreen()));
  }

  void _onOpenTopic(TopicSummary topic) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) =>
            VocabularyScreen(topicId: topic.id, topicName: topic.name),
      ),
    );
  }

  void _onOpenRandom() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const VocabularyScreen(
          topicName: 'Từ ngẫu nhiên',
          mode: VocabularyLearningMode.random,
        ),
      ),
    );
  }

  Future<void> _onStartQuiz() async {
    final topics = context.read<VocabularyTopicsProvider>();
    try {
      await topics.refreshProgress();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể kiểm tra tiến độ hôm nay.')),
        );
      }
      return;
    }
    if (!mounted || !topics.dailyGoalCompleted) return;

    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => const QuickQuizScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<VocabularyTopicsProvider>();

    if ((provider.status == TopicsStatus.idle ||
            provider.status == TopicsStatus.loading) &&
        provider.topics.isEmpty) {
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (provider.status == TopicsStatus.error && provider.topics.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(provider.errorMessage ?? 'Không thể tải dữ liệu.'),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: provider.loadTopics,
                  child: const Text('Thử lại'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final progress = provider.dailyProgress;
    final percentage = (progress * 100).round();

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
                    '${provider.totalLearnedWords} từ đã học',
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
                          onTap: _onChangeGoal,
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
                      children: [
                        Text(
                          '${provider.dailyLearned} / ${provider.dailyGoal} đã ôn',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.slate900,
                          ),
                        ),
                        Text(
                          '$percentage%',
                          style: const TextStyle(
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
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 6,
                        backgroundColor: AppColors.border,
                        valueColor: const AlwaysStoppedAnimation(
                          AppColors.brand,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: provider.dailyGoalCompleted
                                ? AppColors.successBg
                                : AppColors.slate50,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            Icons.quiz_outlined,
                            color: provider.dailyGoalCompleted
                                ? AppColors.success
                                : AppColors.slate400,
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Quiz từ vựng hôm nay',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.slate900,
                                ),
                              ),
                              SizedBox(height: 3),
                              Text(
                                '5 câu hỏi được tạo từ các từ đã học hôm nay',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.slate500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: provider.dailyGoalCompleted
                            ? _onStartQuiz
                            : null,
                        icon: const Icon(Icons.play_arrow_rounded),
                        label: Text(
                          provider.dailyGoalCompleted
                              ? 'Bắt đầu Quiz'
                              : 'Hoàn thành mục tiêu để mở khóa',
                        ),
                      ),
                    ),
                    if (!provider.dailyGoalCompleted)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          'Còn ${provider.dailyGoal - provider.dailyLearned} từ để mở khóa Quiz.',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.slate500,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              AppCard(
                child: InkWell(
                  onTap: _onOpenRandom,
                  borderRadius: BorderRadius.circular(16),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.purpleChipBg,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.shuffle_rounded,
                          color: AppColors.purpleChipFg,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Học từ ngẫu nhiên',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.slate900,
                              ),
                            ),
                            SizedBox(height: 3),
                            Text(
                              'Trộn từ vựng từ nhiều chủ đề trong một lượt học',
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
                'Ôn tập hôm nay',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.slate900,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: StatCard(
                      value: '${provider.reviewCount}',
                      label: 'Từ ôn lại',
                      color: AppColors.brand,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: StatCard(
                      value: '${provider.newCount}',
                      label: 'Từ mới',
                      color: AppColors.success,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: StatCard(
                      value: '~${provider.estimateMinutes}',
                      label: 'Phút',
                      color: AppColors.purpleChipFg,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
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
                    const SizedBox(height: 8),
                    ...provider.todayPreview.map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              item.word,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.slate900,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Flexible(
                              child: Text(
                                item.meaning,
                                textAlign: TextAlign.right,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.slate500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              AppCard(
                child: InkWell(
                  onTap: _onReviewLearned,
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Ôn lại từ đã học',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.slate900,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Chọn từ muốn ôn lại · ${provider.dueForReview} từ',
                              style: const TextStyle(
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
              const SizedBox(height: 8),
              AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: provider.topics.map((topic) {
                    final ratio = topic.total <= 0
                        ? 0.0
                        : (topic.learned / topic.total)
                              .clamp(0.0, 1.0)
                              .toDouble();
                    return ProgressRow(
                      title: topic.name,
                      progressText: '${topic.learned}/${topic.total}',
                      value: ratio,
                      color: ratio >= 1 ? AppColors.success : AppColors.brand,
                      onTap: () => _onOpenTopic(topic),
                    );
                  }).toList(),
                ),
              ),
              if (provider.status == TopicsStatus.loading) ...[
                const SizedBox(height: 12),
                const LinearProgressIndicator(minHeight: 2),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
