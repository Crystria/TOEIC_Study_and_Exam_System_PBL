import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/full_screen_flow_scope.dart';

import '../../../../shared/widgets/answer_option_tile.dart';
import '../../../../theme/app_colors.dart';
import '../../providers/quick_quiz_provider.dart';
import '../../providers/vocabulary_provider.dart';
import '../../providers/vocabulary_topic_provider.dart';
import 'quick_quiz_result_screen.dart';

class QuickQuizScreen extends StatefulWidget {
  const QuickQuizScreen({super.key});

  @override
  State<QuickQuizScreen> createState() => _QuickQuizScreenState();
}

class _QuickQuizScreenState extends State<QuickQuizScreen> {
  bool _isSubmitting = false;
  bool _isExitDialogOpen = false;
  bool _allowExit = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initializeQuiz());
  }

  Future<void> _initializeQuiz() async {
    if (!mounted) return;
    final quiz = context.read<QuickQuizProvider>();
    try {
      final topics = context.read<VocabularyTopicsProvider>();
      await topics.refreshProgress();
      if (!mounted) return;

      if (!topics.dailyGoalCompleted) {
        quiz.setUnavailable(
          'Quiz chỉ được mở sau khi bạn hoàn thành mục tiêu từ vựng hôm nay.',
        );
        return;
      }

      final studiedToday = await context
          .read<VocabularyProvider>()
          .getWordsStudiedTodayForQuiz();
      if (!mounted) return;
      await quiz.loadQuestions(studiedToday);
    } catch (_) {
      if (mounted) {
        quiz.setError(
          'Không thể tạo Quiz từ dữ liệu hôm nay. Vui lòng thử lại.',
        );
      }
    }
  }

  Future<void> _confirmExit() async {
    if (_isSubmitting || _isExitDialogOpen) return;

    _isExitDialogOpen = true;

    final navigator = Navigator.of(context);

    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Thoát Quiz?'),
        content: const Text(
          'Tiến trình trả lời hiện tại sẽ không được giữ lại. '
          'Bạn có muốn thoát?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Tiếp tục làm bài'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Thoát'),
          ),
        ],
      ),
    );

    _isExitDialogOpen = false;

    if (!mounted || shouldExit != true || _isSubmitting) return;

    context.read<QuickQuizProvider>().discardCurrentAttempt();

    setState(() => _allowExit = true);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        navigator.pop();
      }
    });
  }

  Future<void> _onContinue() async {
    if (_isSubmitting) return;
    final quiz = context.read<QuickQuizProvider>();
    if (!quiz.hasSelection) return;

    if (!quiz.isLastQuestion) {
      quiz.continueToNextQuestion();
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hoàn thành Quiz?'),
        content: const Text(
          'Bạn đã trả lời đủ 5 câu. Xác nhận nộp bài để xem kết quả?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Kiểm tra lại'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Nộp bài'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;
    setState(() => _isSubmitting = true);
    try {
      if (!quiz.submitQuiz()) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Vui lòng trả lời đủ 5 câu trước khi nộp.'),
          ),
        );
        return;
      }
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const QuickQuizResultScreen()),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _retryInitialization() async {
    final quiz = context.read<QuickQuizProvider>();
    quiz.setUnavailable('Đang kiểm tra điều kiện mở khóa Quiz...');
    await _initializeQuiz();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<QuickQuizProvider>();
    final isActiveQuiz = provider.status == QuizStatus.loaded;

    return FullScreenFlowScope(
      child: PopScope(
        canPop: _allowExit || (!isActiveQuiz && !_isSubmitting),
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop && isActiveQuiz && !_isSubmitting && !_allowExit) {
            _confirmExit();
          }
        },
        child: _buildContent(context, provider),
      ),
    );
  }

  Widget _buildContent(BuildContext context, QuickQuizProvider provider) {
    if (provider.status == QuizStatus.idle ||
        provider.status == QuizStatus.loading) {
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(child: Center(child: CircularProgressIndicator())),
      );
    }

    if (provider.status == QuizStatus.unavailable ||
        provider.status == QuizStatus.error) {
      final canRetry = provider.status == QuizStatus.error;
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    canRetry ? Icons.error_outline : Icons.lock_outline,
                    size: 56,
                    color: canRetry ? AppColors.danger : AppColors.warning,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    provider.message ?? 'Quiz hiện chưa khả dụng.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 15,
                      color: AppColors.slate700,
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (canRetry)
                    ElevatedButton(
                      onPressed: _retryInitialization,
                      child: const Text('Thử lại'),
                    ),
                  OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Quay lại từ vựng'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    if (provider.status == QuizStatus.finished || provider.questions.isEmpty) {
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(child: Center(child: CircularProgressIndicator())),
      );
    }

    final question = provider.questions[provider.currentIndex];
    final total = provider.totalQuestions;
    final number = provider.currentIndex + 1;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Quiz từ vựng',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.slate900,
                      ),
                    ),
                  ),
                  Text(
                    'Câu $number/$total',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.slate500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: number / total,
                  minHeight: 6,
                  backgroundColor: AppColors.border,
                  valueColor: const AlwaysStoppedAnimation(AppColors.brand),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Chọn nghĩa đúng của từ:',
                style: TextStyle(fontSize: 14, color: AppColors.slate500),
              ),
              const SizedBox(height: 10),
              Text(
                question.word,
                style: const TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w800,
                  color: AppColors.brand,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                question.phonetic,
                style: const TextStyle(fontSize: 14, color: AppColors.slate500),
              ),
              const SizedBox(height: 24),
              ...List.generate(question.options.length, (index) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AnswerOptionTile(
                    letter: String.fromCharCode(65 + index),
                    text: question.options[index],
                    state: provider.selectedOption == index
                        ? OptionState.selected
                        : OptionState.neutral,
                    onTap: _isSubmitting ? null : () => provider.select(index),
                  ),
                );
              }),
              const Spacer(),
              if (provider.hasSelection)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _onContinue,
                    child: Text(
                      provider.isLastQuestion ? 'Hoàn thành' : 'Câu tiếp theo',
                    ),
                  ),
                ),
              if (_isSubmitting) ...[
                const SizedBox(height: 10),
                const LinearProgressIndicator(minHeight: 2),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
