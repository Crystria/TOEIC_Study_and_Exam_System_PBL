import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/full_screen_flow_scope.dart';

import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';
import '../../providers/quick_quiz_provider.dart';
import 'quick_quiz_screen.dart';

class QuickQuizResultScreen extends StatelessWidget {
  const QuickQuizResultScreen({super.key});

  void _returnToVocabulary(BuildContext context) {
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  void _retake(BuildContext context) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const QuickQuizScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final quiz = context.watch<QuickQuizProvider>();
    return FullScreenFlowScope(child: _buildContent(context, quiz));
  }

  Widget _buildContent(BuildContext context, QuickQuizProvider quiz) {
    final wrongAnswers = quiz.wrongAnswers;
    final total = quiz.totalQuestions;

    if (quiz.status != QuizStatus.finished ||
        total != QuickQuizProvider.questionCount) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Center(
            child: ElevatedButton(
              onPressed: () => _returnToVocabulary(context),
              child: const Text('Quay lại từ vựng'),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              Center(
                child: Column(
                  children: [
                    Icon(
                      wrongAnswers.isEmpty
                          ? Icons.emoji_events_rounded
                          : Icons.fact_check_rounded,
                      size: 64,
                      color: wrongAnswers.isEmpty
                          ? AppColors.amber
                          : AppColors.brand,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Kết quả Quiz',
                      style: TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w800,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${quiz.correctCount}/$total câu đúng',
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: AppColors.brand,
                      ),
                    ),
                    Text(
                      'Độ chính xác ${(quiz.correctCount / total * 100).round()}%',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const AppCard(
                child: Text(
                  'Điểm Quiz chỉ dùng để tự kiểm tra khả năng ghi nhớ. '
                  'Tiến trình và lịch ôn từ vựng được cập nhật khi bạn đánh giá '
                  'từng từ ở lượt học, không thay đổi khi nộp Quiz.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.slate500,
                    height: 1.45,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                wrongAnswers.isEmpty
                    ? 'Bạn đã trả lời đúng tất cả câu hỏi.'
                    : 'Các câu trả lời chưa chính xác (${wrongAnswers.length})',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.slate900,
                ),
              ),
              const SizedBox(height: 10),
              if (wrongAnswers.isEmpty)
                const AppCard(
                  child: Text(
                    'Tuyệt vời! Hãy tiếp tục duy trì việc học từ vựng mỗi ngày.',
                    style: TextStyle(fontSize: 14, color: AppColors.slate700),
                  ),
                )
              else
                ...wrongAnswers.asMap().entries.map((entry) {
                  final index = entry.key + 1;
                  final answer = entry.value;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$index. ${answer.question.word}',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppColors.slate900,
                            ),
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'Bạn đã chọn',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.slate500,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            answer.selectedAnswer,
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppColors.danger,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'Đáp án đúng',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.slate500,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            answer.correctAnswer,
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppColors.success,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _retake(context),
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Làm lại Quiz'),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => _returnToVocabulary(context),
                  child: const Text('Quay lại từ vựng'),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
