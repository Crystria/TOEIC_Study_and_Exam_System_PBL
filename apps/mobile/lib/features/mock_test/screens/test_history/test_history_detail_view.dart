import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';
import '../../models/mock_test_submission.dart';
import '../../models/test_attempt.dart';
import '../../providers/mock_test_taking_provider.dart';
import '../../providers/test_history_detail_provider.dart';
import '../../repositories/mock_test_attempt_repository.dart';
import '../../repositories/mock_test_repository.dart';
import '../test_result/answer_explanation_screen.dart';
import '../test_taking/mock_test_taking_screen.dart';

class TestHistoryDetailView extends StatelessWidget {
  const TestHistoryDetailView({
    super.key,
    required this.attemptId,
    required this.expectedMode,
    required this.attemptRepository,
    required this.testRepository,
  });

  final String attemptId;
  final TestAttemptMode expectedMode;
  final MockTestAttemptRepository attemptRepository;
  final MockTestRepository testRepository;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<TestHistoryDetailProvider>(
      create: (_) => TestHistoryDetailProvider(
        attemptRepository: attemptRepository,
        testRepository: testRepository,
      )..loadDetail(attemptId),
      child: _TestHistoryDetailContent(
        expectedMode: expectedMode,
        attemptRepository: attemptRepository,
      ),
    );
  }
}

class _TestHistoryDetailContent extends StatelessWidget {
  const _TestHistoryDetailContent({
    required this.expectedMode,
    required this.attemptRepository,
  });

  final TestAttemptMode expectedMode;
  final MockTestAttemptRepository attemptRepository;

  void _openExplanation(BuildContext context, MockTestSubmission submission) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AnswerExplanationScreen(
          submission: submission,
          initialIndex: submission.firstIncorrectQuestionIndex ?? 0,
          backLabel: 'Quay lại chi tiết lịch sử',
        ),
      ),
    );
  }

  Future<void> _resumeAttempt(BuildContext context, String attemptId) async {
    final navigator = Navigator.of(context);
    final detailProvider = context.read<TestHistoryDetailProvider>();

    // Re-read first. The absolute deadline may have elapsed while this detail
    // route was open; in that case the repository finalizes it as EXPIRED and
    // this screen refreshes to the read-only result instead of opening Taking.
    await detailProvider.loadDetail(attemptId);
    if (!context.mounted) return;

    final latestAttempt = detailProvider.attempt;
    if (latestAttempt == null ||
        latestAttempt.status != TestAttemptStatus.inProgress) {
      return;
    }

    await navigator.push(
      MaterialPageRoute<void>(
        builder: (_) => ChangeNotifierProvider<MockTestTakingProvider>(
          create: (_) =>
              MockTestTakingProvider(repository: attemptRepository)
                ..loadAttempt(attemptId),
          child: MockTestTakingScreen(
            attemptId: attemptId,
            returnToPreviousRoute: true,
          ),
        ),
      ),
    );

    if (!context.mounted) return;
    await detailProvider.loadDetail(attemptId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Chi tiết bài thi'),
      ),
      body: SafeArea(
        child: Consumer<TestHistoryDetailProvider>(
          builder: (context, provider, _) {
            if (provider.status == TestHistoryDetailStatus.loading ||
                provider.status == TestHistoryDetailStatus.idle) {
              return const Center(child: CircularProgressIndicator());
            }

            if (provider.status == TestHistoryDetailStatus.error) {
              return _DetailMessage(
                message:
                    provider.errorMessage ?? 'Không thể tải chi tiết bài thi.',
                onBack: () => Navigator.of(context).maybePop(),
              );
            }

            final attempt = provider.attempt;
            final test = provider.test;
            final submission = provider.submission;
            if (attempt == null ||
                test == null ||
                attempt.mode != expectedMode) {
              return _DetailMessage(
                message: 'Dữ liệu phiên thi không khớp với màn hình chi tiết.',
                onBack: () => Navigator.of(context).maybePop(),
              );
            }

            if (attempt.readOnlySnapshot) {
              return _DetailMessage(
                message:
                    'Đây là lượt thi lịch sử cũ. Backend không còn question snapshot '
                    'cho lượt thi này nên ứng dụng không thể mở lại bài làm hoặc '
                    'hiển thị giải thích từng câu.',
                onBack: () => Navigator.of(context).maybePop(),
              );
            }

            if (attempt.status == TestAttemptStatus.inProgress) {
              return _InProgressDetail(
                testTitle: test.title,
                attempt: attempt,
                onResume: () => _resumeAttempt(context, attempt.attemptId),
              );
            }

            if (submission == null) {
              return _DetailMessage(
                message: 'Không tìm thấy kết quả của phiên thi này.',
                onBack: () => Navigator.of(context).maybePop(),
              );
            }

            return _FinalAttemptDetail(
              testTitle: test.title,
              attempt: attempt,
              submission: submission,
              onOpenExplanation: () => _openExplanation(context, submission),
            );
          },
        ),
      ),
    );
  }
}

class _FinalAttemptDetail extends StatelessWidget {
  const _FinalAttemptDetail({
    required this.testTitle,
    required this.attempt,
    required this.submission,
    required this.onOpenExplanation,
  });

  final String testTitle;
  final TestAttempt attempt;
  final MockTestSubmission submission;
  final VoidCallback onOpenExplanation;

  @override
  Widget build(BuildContext context) {
    final duration = attempt.completedAt == null
        ? attempt.durationSeconds
        : attempt.completedAt!.difference(attempt.startedAt).inSeconds;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(
          testTitle,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppColors.slate900,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _DetailPill(
              label: attempt.mode == TestAttemptMode.full
                  ? 'FULL · ${attempt.parts.length} Part'
                  : 'PART · ${attempt.parts.join(', ')}',
              color: AppColors.brand,
            ),
            _DetailPill(
              label: attempt.status == TestAttemptStatus.expired
                  ? 'Hết giờ · Tự động nộp'
                  : 'Đã nộp bài',
              color: attempt.status == TestAttemptStatus.expired
                  ? AppColors.warning
                  : AppColors.success,
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          'Bắt đầu: ${_formatDateTime(attempt.startedAt)}',
          style: const TextStyle(fontSize: 12, color: AppColors.slate500),
        ),
        if (attempt.completedAt != null)
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              'Hoàn thành: ${_formatDateTime(attempt.completedAt!)} · '
              'Thời gian thực hiện: ${_formatDuration(duration)}',
              style: const TextStyle(fontSize: 12, color: AppColors.slate500),
            ),
          ),
        const SizedBox(height: 16),
        if (submission.isFullTest)
          _FullResultSummary(submission: submission)
        else
          _PartResultSummary(submission: submission),
        const SizedBox(height: 16),
        const Text(
          'Kết quả theo Part',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: AppColors.slate900,
          ),
        ),
        const SizedBox(height: 10),
        AppCard(
          child: Column(
            children: submission.partStats
                .map(
                  (part) => Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: _PartProgressRow(
                      part: part.part,
                      correct: part.correctCount,
                      total: part.totalQuestions,
                    ),
                  ),
                )
                .toList(growable: false),
          ),
        ),
        const SizedBox(height: 18),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: onOpenExplanation,
            icon: const Icon(Icons.fact_check_outlined),
            label: const Text('Xem lời giải chi tiết'),
          ),
        ),
      ],
    );
  }
}

class _FullResultSummary extends StatelessWidget {
  const _FullResultSummary({required this.submission});

  final MockTestSubmission submission;

  @override
  Widget build(BuildContext context) {
    final score = submission.totalScore;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Điểm TOEIC tham khảo',
            style: TextStyle(fontSize: 12, color: AppColors.slate500),
          ),
          const SizedBox(height: 4),
          Text(
            score == null ? '-- / 990' : '$score / 990',
            style: const TextStyle(
              fontSize: 36,
              height: 1.1,
              fontWeight: FontWeight.w800,
              color: AppColors.brand,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _ScoreMetric(
                  label: 'Listening',
                  score: submission.listeningScore,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ScoreMetric(
                  label: 'Reading',
                  score: submission.readingScore,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _AnswerMetrics(submission: submission),
          if (submission.scoreDisclaimer != null) ...[
            const SizedBox(height: 12),
            Text(
              submission.scoreDisclaimer!,
              style: const TextStyle(
                fontSize: 11,
                height: 1.4,
                color: AppColors.slate500,
              ),
            ),
            if (submission.scoreTableVersion != null)
              Text(
                'Bảng tham chiếu: ${submission.scoreTableVersion}.',
                style: const TextStyle(fontSize: 10, color: AppColors.slate400),
              ),
          ],
        ],
      ),
    );
  }
}

class _PartResultSummary extends StatelessWidget {
  const _PartResultSummary({required this.submission});

  final MockTestSubmission submission;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Kết quả luyện tập',
            style: TextStyle(fontSize: 12, color: AppColors.slate500),
          ),
          const SizedBox(height: 4),
          Text(
            '${(submission.accuracy * 100).toStringAsFixed(1)}%',
            style: const TextStyle(
              fontSize: 36,
              height: 1.1,
              fontWeight: FontWeight.w800,
              color: AppColors.brand,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${submission.correctCount}/${submission.totalQuestions} câu đúng',
            style: const TextStyle(fontSize: 13, color: AppColors.slate500),
          ),
          const SizedBox(height: 12),
          _AnswerMetrics(submission: submission),
          const SizedBox(height: 12),
          const Text(
            'Bài luyện PART không có điểm TOEIC quy đổi.',
            style: TextStyle(fontSize: 11, color: AppColors.slate500),
          ),
        ],
      ),
    );
  }
}

class _AnswerMetrics extends StatelessWidget {
  const _AnswerMetrics({required this.submission});

  final MockTestSubmission submission;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _Metric(
            label: 'Đúng',
            value: '${submission.correctCount}',
            color: AppColors.success,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _Metric(
            label: 'Sai',
            value: '${submission.incorrectCount}',
            color: AppColors.danger,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _Metric(
            label: 'Bỏ trống',
            value: '${submission.unansweredCount}',
            color: AppColors.warning,
          ),
        ),
      ],
    );
  }
}

class _ScoreMetric extends StatelessWidget {
  const _ScoreMetric({required this.label, required this.score});

  final String label;
  final int? score;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.slate50,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: AppColors.slate500),
          ),
          const SizedBox(height: 3),
          Text(
            score == null ? '-- / 495' : '$score / 495',
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: AppColors.slate900,
            ),
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 10, color: AppColors.slate500),
          ),
        ],
      ),
    );
  }
}

class _PartProgressRow extends StatelessWidget {
  const _PartProgressRow({
    required this.part,
    required this.correct,
    required this.total,
  });

  final int part;
  final int correct;
  final int total;

  @override
  Widget build(BuildContext context) {
    final progress = total == 0 ? 0.0 : correct / total;
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Part $part',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.slate900,
                ),
              ),
            ),
            Text(
              '$correct/$total đúng · ${(progress * 100).round()}%',
              style: const TextStyle(fontSize: 11, color: AppColors.slate500),
            ),
          ],
        ),
        const SizedBox(height: 7),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 6,
            backgroundColor: AppColors.border,
            valueColor: const AlwaysStoppedAnimation(AppColors.success),
          ),
        ),
      ],
    );
  }
}

class _InProgressDetail extends StatelessWidget {
  const _InProgressDetail({
    required this.testTitle,
    required this.attempt,
    required this.onResume,
  });

  final String testTitle;
  final TestAttempt attempt;
  final VoidCallback onResume;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.pending_actions_rounded,
              size: 52,
              color: AppColors.warning,
            ),
            const SizedBox(height: 14),
            const Text(
              'Bài thi đang diễn ra',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.slate900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '$testTitle\n'
              '${attempt.mode == TestAttemptMode.full ? 'FULL' : 'PART ${attempt.parts.join(', ')}'} · '
              'Bắt đầu ${_formatDateTime(attempt.startedAt)}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                height: 1.5,
                color: AppColors.slate500,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Kết quả và lời giải chỉ khả dụng sau khi nộp bài. '
              'Bạn có thể tiếp tục phiên thi hiện tại.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                height: 1.5,
                color: AppColors.slate500,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onResume,
                icon: const Icon(Icons.play_arrow_rounded),
                label: const Text('Tiếp tục làm bài'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailMessage extends StatelessWidget {
  const _DetailMessage({required this.message, required this.onBack});

  final String message;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.info_outline, size: 42, color: AppColors.slate400),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 14),
            OutlinedButton(onPressed: onBack, child: const Text('Quay lại')),
          ],
        ),
      ),
    );
  }
}

class _DetailPill extends StatelessWidget {
  const _DetailPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

String _formatDateTime(DateTime value) {
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(value.day)}/${two(value.month)}/${value.year} '
      '${two(value.hour)}:${two(value.minute)}';
}

String _formatDuration(int seconds) {
  final safeSeconds = seconds < 0 ? 0 : seconds;
  final hours = safeSeconds ~/ 3600;
  final minutes = (safeSeconds % 3600) ~/ 60;
  final remainingSeconds = safeSeconds % 60;
  if (hours > 0) return '$hours giờ $minutes phút';
  if (minutes > 0) return '$minutes phút';
  return '$remainingSeconds giây';
}
