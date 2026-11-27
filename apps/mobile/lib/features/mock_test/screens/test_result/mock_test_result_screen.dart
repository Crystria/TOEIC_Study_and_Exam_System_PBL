import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/app_navigation_state.dart';
import '../../../ai_chat/models/ai_chat_context.dart';
import '../../../ai_chat/providers/ai_chat_provider.dart';
import '../../../../core/navigation/full_screen_flow_scope.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';
import '../../models/mock_test_submission.dart';
import '../../providers/mock_test_result_provider.dart';
import '../../widgets/score_card.dart';
import 'answer_explanation_screen.dart';

class MockTestResultScreen extends StatelessWidget {
  const MockTestResultScreen({
    super.key,
    this.submission,
    this.returnToPreviousRoute = false,
  });

  final MockTestSubmission? submission;
  final bool returnToPreviousRoute;

  @override
  Widget build(BuildContext context) {
    final result = submission;
    if (result == null) {
      return const _ResultUnavailableScreen();
    }
    return ChangeNotifierProvider<MockTestResultProvider>(
      create: (_) => MockTestResultProvider(submission: result),
      child: _MockTestResultView(returnToPreviousRoute: returnToPreviousRoute),
    );
  }
}

class _MockTestResultView extends StatelessWidget {
  const _MockTestResultView({required this.returnToPreviousRoute});

  final bool returnToPreviousRoute;

  void _openReview(BuildContext context, MockTestResultProvider provider) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AnswerExplanationScreen(
          submission: provider.submission,
          initialIndex: provider.firstReviewIndex,
        ),
      ),
    );
  }

  void _backToTestList(BuildContext context) {
    final navigator = Navigator.of(context);
    if (returnToPreviousRoute) {
      navigator.pop();
    } else {
      navigator.popUntil((route) => route.isFirst);
    }
  }

  void _askAi(BuildContext context, MockTestSubmission submission) {
    context.read<AiChatProvider>().startContextualConversation(
      AiMockTestSummaryContext(
        testId: submission.testId,
        testTitle: submission.testTitle,
        mode: submission.isFullTest ? 'full' : 'part',
        parts: submission.parts,
        totalQuestions: submission.totalQuestions,
        answeredCount: submission.answeredCount,
        correctCount: submission.correctCount,
        incorrectCount: submission.incorrectCount,
        unansweredCount: submission.unansweredCount,
        accuracy: submission.accuracy,
      ),
    );
    Navigator.of(context).popUntil((route) => route.isFirst);
    AppNavigationState.requestTab(3);
  }

  @override
  Widget build(BuildContext context) {
    return FullScreenFlowScope(
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Consumer<MockTestResultProvider>(
            builder: (context, provider, _) {
              final result = provider.submission;
              final totalScore = result.totalScore;

              return Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.only(bottom: 20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                            decoration: const BoxDecoration(
                              color: AppColors.brand,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  result.isFullTest
                                      ? 'KẾT QUẢ THI FULL TOEIC'
                                      : 'KẾT QUẢ LUYỆN THEO PART',
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  result.testTitle,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 17,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                if (result.isFullTest &&
                                    totalScore != null) ...[
                                  Text(
                                    '$totalScore',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 48,
                                      fontWeight: FontWeight.w800,
                                      height: 1.05,
                                    ),
                                  ),
                                  const Text(
                                    'Điểm quy đổi tham khảo / 990',
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontSize: 13,
                                    ),
                                  ),
                                ] else ...[
                                  Text(
                                    '${result.correctCount}/${result.totalQuestions}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 42,
                                      fontWeight: FontWeight.w800,
                                      height: 1.05,
                                    ),
                                  ),
                                  Text(
                                    'Câu đúng · ${(result.accuracy * 100).toStringAsFixed(1)}% chính xác',
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    _HeaderPill(
                                      label: result.expired
                                          ? 'Tự động nộp khi hết giờ'
                                          : 'Đã nộp bài',
                                    ),
                                    _HeaderPill(
                                      label: '${result.parts.length} Part',
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Tổng quan bài làm',
                                  style: TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.slate900,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    Expanded(
                                      child: _MetricCard(
                                        label: 'Câu đúng',
                                        value: '${result.correctCount}',
                                        detail: '/ ${result.totalQuestions}',
                                        color: AppColors.success,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: _MetricCard(
                                        label: 'Câu sai',
                                        value: '${result.incorrectCount}',
                                        detail: 'đã trả lời',
                                        color: AppColors.danger,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: _MetricCard(
                                        label: 'Bỏ trống',
                                        value: '${result.unansweredCount}',
                                        detail: 'chưa trả lời',
                                        color: AppColors.warning,
                                      ),
                                    ),
                                  ],
                                ),
                                if (result.isFullTest) ...[
                                  const SizedBox(height: 18),
                                  const Text(
                                    'Điểm theo kỹ năng',
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
                                        child: ScoreCard(
                                          title: 'Listening',
                                          score: result.listeningScore ?? 0,
                                          max: 495,
                                          correct:
                                              result.listeningCorrectCount ?? 0,
                                          total: 100,
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: ScoreCard(
                                          title: 'Reading',
                                          score: result.readingScore ?? 0,
                                          max: 495,
                                          correct:
                                              result.readingCorrectCount ?? 0,
                                          total: 100,
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (result.scoreDisclaimer != null) ...[
                                    const SizedBox(height: 8),
                                    AppCard(
                                      color: AppColors.warningBg,
                                      borderColor: AppColors.warning.withValues(
                                        alpha: 0.3,
                                      ),
                                      child: Text(
                                        '${result.scoreDisclaimer}\n'
                                        'Bảng tham chiếu: ${result.scoreTableVersion ?? 'không xác định'}. '
                                        'Điểm chính thức cần được xác nhận từ đơn vị tổ chức bài thi.',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          height: 1.45,
                                          color: AppColors.slate700,
                                        ),
                                      ),
                                    ),
                                  ],
                                ] else ...[
                                  const SizedBox(height: 10),
                                  AppCard(
                                    child: Text(
                                      'Bài luyện PART chỉ hiển thị số câu đúng và độ chính xác. '
                                      'Không quy đổi sang thang điểm TOEIC 10–990.',
                                      style: const TextStyle(
                                        fontSize: 13,
                                        height: 1.45,
                                        color: AppColors.slate700,
                                      ),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 18),
                                const Text(
                                  'Kết quả theo từng Part',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.slate900,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                ...result.partStats.map(
                                  (stat) => Padding(
                                    padding: const EdgeInsets.only(bottom: 8),
                                    child: _PartResultCard(stat: stat),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                SizedBox(
                                  width: double.infinity,
                                  child: FilledButton.icon(
                                    onPressed: () =>
                                        _openReview(context, provider),
                                    icon: const Icon(Icons.fact_check_outlined),
                                    label: const Text(
                                      'Xem lại đáp án và lời giải',
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                SizedBox(
                                  width: double.infinity,
                                  child: OutlinedButton.icon(
                                    onPressed: () => _askAi(context, result),
                                    icon: const Icon(Icons.chat_bubble_outline),
                                    label: const Text(
                                      'Hỏi trợ lý AI về bài này',
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                    child: SizedBox(
                      width: double.infinity,
                      child: TextButton.icon(
                        onPressed: () => _backToTestList(context),
                        icon: const Icon(Icons.arrow_back_rounded),
                        label: Text(
                          returnToPreviousRoute
                              ? 'Quay lại chi tiết lịch sử'
                              : 'Về danh sách đề thi',
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _HeaderPill extends StatelessWidget {
  const _HeaderPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white24),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.detail,
    required this.color,
  });

  final String label;
  final String value;
  final String detail;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: AppColors.slate500),
          ),
          const SizedBox(height: 5),
          Text(
            value,
            style: TextStyle(
              fontSize: 23,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          Text(
            detail,
            style: const TextStyle(fontSize: 10, color: AppColors.slate400),
          ),
        ],
      ),
    );
  }
}

class _PartResultCard extends StatelessWidget {
  const _PartResultCard({required this.stat});

  final MockTestPartSubmission stat;

  @override
  Widget build(BuildContext context) {
    final percent = stat.accuracy * 100;
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.blueChipBg,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text(
                  'P${stat.part}',
                  style: const TextStyle(
                    color: AppColors.blueChipFg,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      stat.isListening ? 'Listening' : 'Reading',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate900,
                      ),
                    ),
                    Text(
                      'Đúng ${stat.correctCount}/${stat.totalQuestions} · '
                      'Đã trả lời ${stat.answeredCount}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '${percent.toStringAsFixed(0)}%',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.brand,
                ),
              ),
            ],
          ),
          const SizedBox(height: 9),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: stat.accuracy,
              minHeight: 6,
              backgroundColor: AppColors.slate200,
              valueColor: const AlwaysStoppedAnimation(AppColors.brand),
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultUnavailableScreen extends StatelessWidget {
  const _ResultUnavailableScreen();

  @override
  Widget build(BuildContext context) {
    return FullScreenFlowScope(
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          title: const Text('Kết quả bài thi'),
          backgroundColor: AppColors.bg,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.info_outline,
                  size: 42,
                  color: AppColors.slate500,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Chưa có dữ liệu nộp bài để hiển thị kết quả. '
                  'Kết quả sẽ được mở tự động sau khi hoàn thành một phiên thi.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.slate700, height: 1.5),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  child: const Text('Quay lại'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
