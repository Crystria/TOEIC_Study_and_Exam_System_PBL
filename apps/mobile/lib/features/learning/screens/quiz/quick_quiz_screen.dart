import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/full_screen_flow_scope.dart';
import '../../../../shared/widgets/answer_option_tile.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';
import '../../models/vocabulary_session_dtos.dart';
import '../../providers/quick_quiz_provider.dart';
import '../../providers/vocabulary_topic_provider.dart';
import 'quick_quiz_result_screen.dart';

class QuickQuizScreen extends StatefulWidget {
  const QuickQuizScreen({super.key, required this.topicId, required this.mode});

  final String topicId;
  final VocabularySessionMode mode;

  @override
  State<QuickQuizScreen> createState() => _QuickQuizScreenState();
}

class _QuickQuizScreenState extends State<QuickQuizScreen> {
  bool _isExitDialogOpen = false;
  bool _isWorking = false;
  bool _allowExit = false;
  bool _resultNavigationQueued = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initializeQuiz());
  }

  Future<void> _initializeQuiz() async {
    if (!mounted) return;
    final topics = context.read<VocabularyTopicsProvider>();
    try {
      await topics.refreshProgress();
    } catch (_) {
      // The local daily-goal snapshot is still the authoritative unlock source.
    }
    if (!mounted) return;

    await context.read<QuickQuizProvider>().startSession(
      topicId: widget.topicId,
      mode: widget.mode,
      canCreate: topics.dailyGoalCompleted,
    );
    if (mounted) _openResultWhenCompleted();
  }

  void _openResultWhenCompleted() {
    if (!mounted || _resultNavigationQueued) return;
    if (context.read<QuickQuizProvider>().status != QuizStatus.finished) return;
    _resultNavigationQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => const QuickQuizResultScreen()),
      );
    });
  }

  Future<void> _confirmExit() async {
    final quiz = context.read<QuickQuizProvider>();
    if (_isWorking || _isExitDialogOpen || !quiz.hasActiveSession) return;

    _isExitDialogOpen = true;
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Thoát Quick Quiz?'),
        content: const Text(
          'Vocabulary Session hiện tại sẽ được hủy trên Backend. '
          'Các câu trả lời và đánh giá chưa nộp sẽ không được giữ lại. Bạn có muốn thoát?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Tiếp tục'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Hủy Session và thoát'),
          ),
        ],
      ),
    );
    _isExitDialogOpen = false;
    if (!mounted || shouldExit != true) return;

    setState(() => _isWorking = true);
    try {
      await quiz.cancelCurrentSession();
      if (!mounted) return;
      setState(() => _allowExit = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).pop();
      });
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Không thể hủy Session trên Backend. Session được giữ lại để khôi phục. $error',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _isWorking = false);
    }
  }

  Future<void> _onContinue() async {
    final quiz = context.read<QuickQuizProvider>();
    if (_isWorking || !quiz.hasSelection) return;
    if (!quiz.isLastQuestion) {
      quiz.continueToNextQuestion();
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hoàn thành phần câu hỏi?'),
        content: const Text(
          'Bạn đã trả lời đủ 5 câu. Tiếp theo, hãy tự đánh giá mức độ ghi nhớ của từng từ trước khi nộp Session.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Kiểm tra lại'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Tiếp tục'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;
    quiz.beginReviewRating();
  }

  Future<void> _submit() async {
    final quiz = context.read<QuickQuizProvider>();
    if (_isWorking || !quiz.canSubmit) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Nộp Quick Quiz?'),
        content: const Text(
          'Ứng dụng sẽ gửi 5 câu trả lời và 5 mức tự đánh giá lên Backend. Backend sẽ chấm điểm và cập nhật lịch ôn tập.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Quay lại'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Nộp bài'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;

    setState(() => _isWorking = true);
    final succeeded = await quiz.submitQuiz();
    if (!mounted) return;
    setState(() => _isWorking = false);
    if (succeeded) {
      _openResultWhenCompleted();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            quiz.message ?? 'Chưa thể nộp Session. Vui lòng thử lại.',
          ),
        ),
      );
    }
  }

  Future<void> _retry() async {
    if (_isWorking) return;
    setState(() => _isWorking = true);
    await context.read<QuickQuizProvider>().retry();
    if (!mounted) return;
    setState(() => _isWorking = false);
    _openResultWhenCompleted();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<QuickQuizProvider>();
    final hasActiveSession =
        provider.hasActiveSession && provider.status != QuizStatus.finished;
    final isPreparingSession =
        provider.status == QuizStatus.loading && !provider.hasActiveSession;

    return FullScreenFlowScope(
      child: PopScope(
        canPop: _allowExit || (!hasActiveSession && !isPreparingSession),
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop && hasActiveSession && !_isWorking && !_allowExit) {
            _confirmExit();
          }
          // The create request is protected by the persisted idempotency intent.
          // Do not pop while it is in flight and leave an orphaned route/session.
        },
        child: _buildContent(context, provider),
      ),
    );
  }

  Widget _buildContent(BuildContext context, QuickQuizProvider provider) {
    if (provider.status == QuizStatus.idle ||
        provider.status == QuizStatus.loading ||
        provider.status == QuizStatus.submitting) {
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(child: Center(child: CircularProgressIndicator())),
      );
    }

    if (provider.status == QuizStatus.unavailable ||
        provider.status == QuizStatus.error) {
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
                    provider.status == QuizStatus.error
                        ? Icons.error_outline
                        : Icons.lock_outline,
                    size: 56,
                    color: provider.status == QuizStatus.error
                        ? AppColors.danger
                        : AppColors.warning,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    provider.message ?? 'Quick Quiz hiện chưa khả dụng.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 15,
                      color: AppColors.slate700,
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (provider.status == QuizStatus.error)
                    ElevatedButton(
                      onPressed: _retry,
                      child: const Text('Thử lại'),
                    ),
                  OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Quay lại'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    if (provider.status == QuizStatus.rating) {
      return _buildRatingStage(provider);
    }

    if (provider.questions.isEmpty || provider.status == QuizStatus.finished) {
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
                      'Quick Quiz',
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
              Text(
                question.direction == VocabularyQuizDirection.wordToMeaning
                    ? 'Chọn nghĩa đúng của từ:'
                    : 'Chọn từ vựng tương ứng với nghĩa:',
                style: const TextStyle(fontSize: 14, color: AppColors.slate500),
              ),
              const SizedBox(height: 10),
              Text(
                question.prompt,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: AppColors.brand,
                ),
              ),
              if (question.direction == VocabularyQuizDirection.wordToMeaning &&
                  question.phonetic.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  question.phonetic,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.slate500,
                  ),
                ),
              ],
              const SizedBox(height: 24),
              ...List.generate(question.options.length, (index) {
                final option = question.options[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AnswerOptionTile(
                    letter: option.code,
                    text: option.text,
                    state: provider.selectedOption == option.code
                        ? OptionState.selected
                        : OptionState.neutral,
                    onTap: _isWorking
                        ? null
                        : () => provider.select(option.code),
                  ),
                );
              }),
              const Spacer(),
              if (provider.hasSelection)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isWorking ? null : _onContinue,
                    child: Text(
                      provider.isLastQuestion
                          ? 'Hoàn thành câu hỏi'
                          : 'Câu tiếp theo',
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRatingStage(QuickQuizProvider provider) {
    const labels = <String>[
      'Không nhớ',
      'Rất khó',
      'Khó',
      'Khá khó',
      'Dễ',
      'Rất dễ',
    ];

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Tự đánh giá mức độ ghi nhớ',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Đã đánh giá ${provider.ratedWordCount}/${provider.reviewWords.length} từ. Chọn mức 0–5 theo khả năng nhớ thực tế của bạn.',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.slate500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Mức đánh giá độc lập với kết quả trắc nghiệm; ứng dụng không tự suy ra chất lượng ghi nhớ từ câu đúng hoặc sai.',
                    style: TextStyle(fontSize: 12, color: AppColors.slate500),
                  ),
                  if (provider.reviewPersistenceMessage != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      provider.reviewPersistenceMessage!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.warning,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                itemCount: provider.reviewWords.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final word = provider.reviewWords[index];
                  final selectedQuality = provider.qualityFor(word.id);
                  return AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          word.word,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.slate900,
                          ),
                        ),
                        if (word.phonetic.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              word.phonetic,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.slate500,
                              ),
                            ),
                          ),
                        const SizedBox(height: 4),
                        Text(
                          word.definition,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.slate700,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: List<Widget>.generate(6, (quality) {
                            return ChoiceChip(
                              label: Text('$quality · ${labels[quality]}'),
                              selected: selectedQuality == quality,
                              onSelected: _isWorking
                                  ? null
                                  : (_) => provider.setReviewQuality(
                                      vocabularyId: word.id,
                                      quality: quality,
                                    ),
                            );
                          }),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: !_isWorking && provider.canSubmit ? _submit : null,
                  child: Text(
                    provider.canSubmit
                        ? 'Nộp Session'
                        : 'Đánh giá đủ 5 từ để nộp',
                  ),
                ),
              ),
            ),
            if (_isWorking) const LinearProgressIndicator(minHeight: 2),
          ],
        ),
      ),
    );
  }
}
