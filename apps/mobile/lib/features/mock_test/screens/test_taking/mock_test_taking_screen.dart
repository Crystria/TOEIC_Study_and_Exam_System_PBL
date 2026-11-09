import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/full_screen_flow_scope.dart';
import '../../../../theme/app_colors.dart';
import '../../providers/mock_test_taking_provider.dart';
import '../test_result/mock_test_result_screen.dart';
import '../../widgets/test_taking_controls.dart';
import '../../widgets/test_taking_header.dart';
import '../../widgets/test_taking_part_selector.dart';
import '../../widgets/test_taking_question_content.dart';
import '../../widgets/test_taking_question_navigator.dart';

class MockTestTakingScreen extends StatefulWidget {
  const MockTestTakingScreen({
    super.key,
    required this.attemptId,
    this.returnToPreviousRoute = false,
  });

  final String attemptId;
  final bool returnToPreviousRoute;

  @override
  State<MockTestTakingScreen> createState() => _MockTestTakingScreenState();
}

class _MockTestTakingScreenState extends State<MockTestTakingScreen>
    with WidgetsBindingObserver {
  MockTestTakingProvider? _provider;
  bool _isExitDialogOpen = false;
  bool _allowExit = false;
  bool _resultNavigationStarted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final nextProvider = context.read<MockTestTakingProvider>();
    if (identical(_provider, nextProvider)) return;
    _provider?.removeListener(_handleProviderChanged);
    _provider = nextProvider;
    nextProvider.addListener(_handleProviderChanged);
  }

  void _handleProviderChanged() {
    final currentProvider = _provider;
    if (!mounted ||
        _resultNavigationStarted ||
        currentProvider?.isSubmitted != true ||
        currentProvider?.submission == null) {
      return;
    }

    _resultNavigationStarted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final submission = _provider?.submission;
      if (submission == null) {
        _resultNavigationStarted = false;
        return;
      }
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => MockTestResultScreen(
            submission: submission,
            returnToPreviousRoute: widget.returnToPreviousRoute,
          ),
        ),
      );
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _provider?.onAppResumed();
    } else if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      _provider?.saveDraftNow();
    }
  }

  @override
  void dispose() {
    _provider?.removeListener(_handleProviderChanged);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _showExitDialog() async {
    if (_isExitDialogOpen) return;
    _isExitDialogOpen = true;

    final navigator = Navigator.of(context);
    final shouldExit = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Thoát bài thi?'),
        content: Text(
          _provider?.usesBackend == true
              ? 'Phiên thi và các đáp án đã đồng bộ được lưu trên máy chủ. '
                    'Bạn có thể mở lại phiên đang diễn ra từ Lịch sử làm bài. '
                    'Các đáp án chưa đồng bộ sẽ được giữ tạm trên thiết bị. '
                    'Bạn có chắc chắn muốn thoát?'
              : 'Nếu thoát, màn hình làm bài sẽ đóng. Bạn có thể mở lại phiên thi '
                    'đang diễn ra từ Lịch sử làm bài trong phiên ứng dụng hiện tại. '
                    'Nếu đóng ứng dụng hoàn toàn, dữ liệu mẫu trong bộ nhớ sẽ bị mất. '
                    'Bạn có chắc chắn muốn thoát?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Tiếp tục làm bài'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Thoát'),
          ),
        ],
      ),
    );

    _isExitDialogOpen = false;
    if (!mounted || shouldExit != true) return;

    setState(() => _allowExit = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) navigator.pop();
    });
  }

  Future<void> _confirmSubmit(MockTestTakingProvider provider) async {
    final shouldSubmit = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Nộp bài thi?'),
        content: Text(
          'Bạn đã trả lời ${provider.answeredCount}/${provider.totalQuestions} câu. '
          'Còn ${provider.unansweredCount} câu chưa trả lời. '
          'Sau khi nộp, bạn sẽ không thể thay đổi đáp án.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Tiếp tục làm bài'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Xác nhận nộp'),
          ),
        ],
      ),
    );

    if (!mounted || shouldSubmit != true) return;
    await provider.submitAttempt();
  }

  @override
  Widget build(BuildContext context) {
    final isSubmitted = context.select<MockTestTakingProvider, bool>(
      (provider) => provider.isSubmitted,
    );

    return FullScreenFlowScope(
      child: PopScope(
        canPop: _allowExit || isSubmitted,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop || _allowExit) return;
          _showExitDialog();
        },
        child: Scaffold(
          backgroundColor: AppColors.bg,
          body: SafeArea(
            child: Consumer<MockTestTakingProvider>(
              builder: (context, provider, _) {
                if (provider.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (provider.status == TakingStatus.error) {
                  return _LoadAttemptError(
                    message: provider.errorMessage ?? 'Không thể tải bài thi.',
                    onRetry: () => provider.loadAttempt(widget.attemptId),
                  );
                }
                if (provider.isSubmitted) {
                  return _SubmissionCompleted(
                    answeredCount:
                        provider.submission?.answeredCount ??
                        provider.answeredCount,
                    unansweredCount:
                        provider.submission?.unansweredCount ??
                        provider.unansweredCount,
                    totalQuestions:
                        provider.submission?.totalQuestions ??
                        provider.totalQuestions,
                    onBack: () => Navigator.of(context).pop(),
                  );
                }
                if (provider.session == null ||
                    provider.currentQuestion == null) {
                  return const Center(
                    child: Text('Không có câu hỏi trong phiên thi.'),
                  );
                }

                return Column(
                  children: [
                    TestTakingHeader(
                      title: provider.session!.testTitle,
                      isFullTest: provider.isFullTest,
                      remainingSeconds: provider.remainingSeconds,
                    ),
                    TestTakingPartSelector(provider: provider),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  'Câu ${provider.currentIndex + 1} / ${provider.totalQuestions}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.slate700,
                                  ),
                                ),
                              ),
                              Text(
                                '${provider.answeredCount} câu đã trả lời',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.slate500,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 7),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(99),
                            child: LinearProgressIndicator(
                              value: provider.progress,
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
                    Expanded(
                      child: SingleChildScrollView(
                        key: ValueKey(provider.currentQuestion!.questionId),
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        child: TestTakingQuestionContent(
                          question: provider.currentQuestion!,
                          group: provider.currentGroup,
                          selectedOption: provider.selectedOptionCode,
                          onSelect: provider.selectOption,
                          onClear: provider.clearCurrentAnswer,
                        ),
                      ),
                    ),
                    if (provider.errorMessage != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                        child: Text(
                          provider.errorMessage!,
                          style: const TextStyle(
                            color: AppColors.danger,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    TestTakingControls(
                      provider: provider,
                      onOpenNavigator: () =>
                          TestTakingQuestionNavigator.show(context, provider),
                      onSubmit: () => _confirmSubmit(provider),
                    ),
                    if (provider.isSubmitting)
                      const LinearProgressIndicator(minHeight: 2),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _SubmissionCompleted extends StatelessWidget {
  const _SubmissionCompleted({
    required this.answeredCount,
    required this.unansweredCount,
    required this.totalQuestions,
    required this.onBack,
  });

  final int answeredCount;
  final int unansweredCount;
  final int totalQuestions;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: const BoxDecoration(
                color: AppColors.successBg,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_outline_rounded,
                color: AppColors.success,
                size: 42,
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Đã nộp bài thi',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.slate900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Đã trả lời $answeredCount/$totalQuestions câu · '
              'Còn $unansweredCount câu chưa trả lời',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: AppColors.slate500),
            ),
            const SizedBox(height: 14),
            const Text(
              'Phiên thi đã được ghi nhận trong bộ nhớ của ứng dụng. '
              'Bảng điểm TOEIC và phần giải thích đáp án sẽ được hiển thị '
              'trong luồng kết quả.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: AppColors.slate500,
              ),
            ),
            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onBack,
                icon: const Icon(Icons.arrow_back_rounded),
                label: const Text('Quay về chọn đề thi'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadAttemptError extends StatelessWidget {
  const _LoadAttemptError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.danger, size: 42),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 14),
            FilledButton(onPressed: onRetry, child: const Text('Thử lại')),
          ],
        ),
      ),
    );
  }
}
