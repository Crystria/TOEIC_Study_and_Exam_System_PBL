import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/full_screen_flow_scope.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';
import '../../providers/quick_quiz_provider.dart';
import 'quick_quiz_screen.dart';

class QuickQuizResultScreen extends StatefulWidget {
  const QuickQuizResultScreen({super.key});

  @override
  State<QuickQuizResultScreen> createState() => _QuickQuizResultScreenState();
}

class _QuickQuizResultScreenState extends State<QuickQuizResultScreen> {
  bool _isLeaving = false;

  Future<void> _returnToVocabulary() async {
    if (_isLeaving) return;
    setState(() => _isLeaving = true);
    try {
      await context.read<QuickQuizProvider>().acknowledgeCompletedSession();
      if (!mounted) return;
      Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (error) {
      if (!mounted) return;
      setState(() => _isLeaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể xác nhận kết quả Session: $error')),
      );
    }
  }

  Future<void> _retake() async {
    if (_isLeaving) return;
    final quiz = context.read<QuickQuizProvider>();
    final topicId = quiz.topicId;
    final mode = quiz.sessionMode;
    if (topicId == null || mode == null) return;

    setState(() => _isLeaving = true);
    try {
      await quiz.acknowledgeCompletedSession();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => QuickQuizScreen(topicId: topicId, mode: mode),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _isLeaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể khởi tạo lượt Quiz mới: $error')),
      );
    }
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
        total != QuickQuizProvider.questionCount ||
        quiz.resultEntries.length != QuickQuizProvider.questionCount) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Center(
            child: ElevatedButton(
              onPressed: _isLeaving ? null : _returnToVocabulary,
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
                      'Kết quả Quick Quiz',
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
                  'Kết quả được chấm bởi Backend. Lịch ôn từ vựng được cập nhật dựa trên 5 mức tự đánh giá bạn đã chọn, không dựa trực tiếp vào số câu đúng.',
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
              ...quiz.resultEntries.asMap().entries.map((entry) {
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
                        const SizedBox(height: 4),
                        Text(
                          answer.question.prompt,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.slate500,
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
                          style: TextStyle(
                            fontSize: 14,
                            color: answer.isCorrect
                                ? AppColors.success
                                : AppColors.danger,
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
                  onPressed: _isLeaving ? null : _retake,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Tạo Session mới và làm lại'),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _isLeaving ? null : _returnToVocabulary,
                  child: const Text('Quay lại từ vựng'),
                ),
              ),
              if (_isLeaving) ...[
                const SizedBox(height: 12),
                const LinearProgressIndicator(minHeight: 2),
              ],
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
