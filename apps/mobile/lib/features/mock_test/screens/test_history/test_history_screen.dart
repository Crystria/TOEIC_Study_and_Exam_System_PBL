import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../theme/app_colors.dart';
import '../../mock_test_dependencies.dart';
import '../../models/test_attempt.dart';
import '../../models/test_history_item.dart';
import '../../providers/test_history_provider.dart';
import '../../repositories/mock_test_attempt_repository.dart';
import '../../repositories/mock_test_repository.dart';
import '../../widgets/filter_tab.dart';
import 'test_history_detail_full_screen.dart';
import 'test_history_detail_part_screen.dart';

class TestHistoryScreen extends StatelessWidget {
  const TestHistoryScreen({
    super.key,
    this.attemptRepository,
    this.testRepository,
  });

  /// Optional injection preserves compatibility with existing Home navigation.
  /// The defaults point to the same app-session repositories used by selection.
  final MockTestAttemptRepository? attemptRepository;
  final MockTestRepository? testRepository;

  @override
  Widget build(BuildContext context) {
    final attempts =
        attemptRepository ?? MockTestDependencies.attemptRepository;
    final tests = testRepository ?? MockTestDependencies.testRepository;

    return ChangeNotifierProvider<TestHistoryProvider>(
      create: (_) => TestHistoryProvider(repository: attempts)..loadHistory(),
      child: _TestHistoryView(
        attemptRepository: attempts,
        testRepository: tests,
      ),
    );
  }
}

class _TestHistoryView extends StatelessWidget {
  const _TestHistoryView({
    required this.attemptRepository,
    required this.testRepository,
  });

  final MockTestAttemptRepository attemptRepository;
  final MockTestRepository testRepository;

  Future<void> _openDetail(BuildContext context, TestHistoryItem item) async {
    final Widget screen = item.mode == TestAttemptMode.full
        ? TestHistoryDetailFullScreen(
            attemptId: item.attemptId,
            attemptRepository: attemptRepository,
            testRepository: testRepository,
          )
        : TestHistoryDetailPartScreen(
            attemptId: item.attemptId,
            attemptRepository: attemptRepository,
            testRepository: testRepository,
          );

    await Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => screen));
    if (!context.mounted) return;
    await context.read<TestHistoryProvider>().loadHistory();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Lịch sử làm bài'),
        actions: [
          Consumer<TestHistoryProvider>(
            builder: (context, provider, _) => Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Text(
                  '${provider.totalItems} bài',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.slate500,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Consumer<TestHistoryProvider>(
                builder: (context, provider, _) => Row(
                  children: [
                    Expanded(
                      child: FilterTab(
                        label: 'Tất cả',
                        active: provider.filter == TestHistoryFilter.all,
                        onTap: () =>
                            provider.changeFilter(TestHistoryFilter.all),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilterTab(
                        label: 'Đề đầy đủ',
                        active: provider.filter == TestHistoryFilter.fullTest,
                        onTap: () =>
                            provider.changeFilter(TestHistoryFilter.fullTest),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilterTab(
                        label: 'Luyện theo Part',
                        active: provider.filter == TestHistoryFilter.byPart,
                        onTap: () =>
                            provider.changeFilter(TestHistoryFilter.byPart),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: Consumer<TestHistoryProvider>(
                builder: (context, provider, _) {
                  if (provider.isLoading && !provider.hasItems) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (provider.status == TestHistoryStatus.error &&
                      !provider.hasItems) {
                    return _HistoryMessage(
                      message:
                          provider.errorMessage ??
                          'Không thể tải lịch sử làm bài.',
                      actionLabel: 'Thử lại',
                      onAction: provider.loadHistory,
                    );
                  }

                  if (!provider.hasItems) {
                    return RefreshIndicator(
                      onRefresh: provider.loadHistory,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: const [
                          SizedBox(height: 110),
                          Icon(
                            Icons.history_rounded,
                            size: 46,
                            color: AppColors.slate400,
                          ),
                          SizedBox(height: 12),
                          Center(
                            child: Text(
                              'Chưa có bài thi nào trong lịch sử.',
                              style: TextStyle(color: AppColors.slate500),
                            ),
                          ),
                        ],
                      ),
                    );
                  }

                  return RefreshIndicator(
                    onRefresh: provider.loadHistory,
                    child: ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      itemCount:
                          provider.items.length +
                          (provider.hasMore ||
                                  provider.loadMoreErrorMessage != null
                              ? 1
                              : 0),
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        if (index >= provider.items.length) {
                          if (provider.isLoadingMore) {
                            return const Padding(
                              padding: EdgeInsets.all(16),
                              child: Center(child: CircularProgressIndicator()),
                            );
                          }
                          if (provider.loadMoreErrorMessage != null) {
                            return _HistoryMessage(
                              message: provider.loadMoreErrorMessage!,
                              actionLabel: 'Thử lại',
                              onAction: provider.loadMore,
                            );
                          }
                          return TextButton(
                            onPressed: provider.loadMore,
                            child: const Text('Tải thêm lịch sử'),
                          );
                        }

                        final item = provider.items[index];
                        return _HistoryAttemptCard(
                          item: item,
                          onTap: () => _openDetail(context, item),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 4, 16, 10),
              child: Text(
                'Lịch sử hiện được lưu trong bộ nhớ của phiên ứng dụng; chưa đồng bộ Backend.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: AppColors.slate400),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryAttemptCard extends StatelessWidget {
  const _HistoryAttemptCard({required this.item, required this.onTap});

  final TestHistoryItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor(item.status);
    final date = item.completedAt ?? item.startedAt;
    final modeLabel = item.mode == TestAttemptMode.full
        ? 'Đề đầy đủ · ${item.totalQuestions ?? 200} câu'
        : 'Luyện Part ${item.parts.join(', ')} · ${item.totalQuestions ?? 0} câu';

    String resultLabel;
    if (!item.isFinal) {
      resultLabel = 'Đang diễn ra';
    } else if (item.mode == TestAttemptMode.full) {
      resultLabel = item.score == null ? 'Chưa có điểm' : '${item.score} / 990';
    } else {
      resultLabel = item.accuracy == null
          ? 'Chưa có kết quả'
          : '${(item.accuracy! * 100).toStringAsFixed(1)}% chính xác';
    }

    String? resultDetail;
    if (item.correctCount != null && item.totalQuestions != null) {
      resultDetail = '${item.correctCount}/${item.totalQuestions} câu đúng';
    }

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.testTitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      modeLabel,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.slate500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_formatDateTime(date)} · ${_formatDuration(item.durationSeconds)}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.slate400,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _StatusPill(
                          label: _statusLabel(item.status),
                          color: statusColor,
                        ),
                        if (resultDetail != null)
                          Text(
                            resultDetail,
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.slate500,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    resultLabel,
                    textAlign: TextAlign.end,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color:
                          item.mode == TestAttemptMode.full &&
                              item.score != null
                          ? AppColors.brand
                          : item.mode == TestAttemptMode.part &&
                                item.accuracy != null
                          ? AppColors.success
                          : AppColors.slate500,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.slate400,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class _HistoryMessage extends StatelessWidget {
  const _HistoryMessage({
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.slate500),
            ),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onAction, child: Text(actionLabel)),
          ],
        ),
      ),
    );
  }
}

String _statusLabel(TestAttemptStatus status) {
  switch (status) {
    case TestAttemptStatus.inProgress:
      return 'Đang diễn ra';
    case TestAttemptStatus.submitted:
      return 'Đã nộp';
    case TestAttemptStatus.expired:
      return 'Hết giờ';
  }
}

Color _statusColor(TestAttemptStatus status) {
  switch (status) {
    case TestAttemptStatus.inProgress:
      return AppColors.warning;
    case TestAttemptStatus.submitted:
      return AppColors.success;
    case TestAttemptStatus.expired:
      return AppColors.danger;
  }
}

String _formatDateTime(DateTime value) {
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(value.day)}/${two(value.month)}/${value.year} · '
      '${two(value.hour)}:${two(value.minute)}';
}

String _formatDuration(int seconds) {
  final hours = seconds ~/ 3600;
  final minutes = (seconds % 3600) ~/ 60;
  if (hours > 0) return '${hours}h ${minutes}m';
  return '$minutes phút';
}
