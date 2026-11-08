import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/full_screen_flow_scope.dart';
import '../../../../shared/widgets/stat_card.dart';
import '../../../../shared/widgets/success_check.dart';
import '../../../../theme/app_colors.dart';
import '../../providers/review_flashcard_provider.dart';
import 'review_select_words_screen.dart';

class ReviewResultScreen extends StatelessWidget {
  const ReviewResultScreen({super.key});

  void _onBackHome(BuildContext context) {
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  void _onReviewOthers(BuildContext context) {
    context.read<ReviewFlashcardProvider>().reset();

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const ReviewSelectWordsScreen()),
      (route) => route.isFirst,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tally = context.watch<ReviewFlashcardProvider>().tally;

    return FullScreenFlowScope(
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SuccessCheck(),
                    const SizedBox(height: 16),
                    const Text(
                      'Hoàn thành ôn lại',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Bạn đã ôn ${tally.total} từ',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.slate500,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: StatCard(
                            value: '${tally.daThuoc}',
                            label: 'Đã thuộc',
                            color: AppColors.success,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: StatCard(
                            value: '${tally.moHo}',
                            label: 'Mơ hồ',
                            color: AppColors.warning,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: StatCard(
                            value: '${tally.chuaThuoc}',
                            label: 'Chưa thuộc',
                            color: AppColors.danger,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => _onBackHome(context),
                        child: const Text('Về trang chủ'),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => _onReviewOthers(context),
                        child: const Text('Chọn từ ôn lại khác'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
