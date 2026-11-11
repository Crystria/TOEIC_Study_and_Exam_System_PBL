import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/stat_card.dart';
import '../../../theme/app_colors.dart';
import '../models/analytics_models.dart';
import '../providers/analytics_provider.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<AnalyticsProvider>();
      if (provider.status == AnalyticsStatus.idle) provider.load();
    });
  }

  Future<void> _refresh() async {
    final provider = context.read<AnalyticsProvider>();
    await provider.load(
      range: provider.progress?.timeRange ?? AnalyticsTimeRange.last30Days,
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AnalyticsProvider>();
    final progress = provider.progress;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text(
          'Thống kê học tập',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        backgroundColor: AppColors.bg,
        surfaceTintColor: Colors.transparent,
        actions: [
          IconButton(
            tooltip: 'Tải lại',
            onPressed: provider.status == AnalyticsStatus.loading
                ? null
                : _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: progress == null
          ? _InitialState(
              isLoading: provider.status == AnalyticsStatus.loading,
              errorMessage: provider.errorMessage,
              onRetry: _refresh,
            )
          : RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                children: [
                  if (provider.isDemoData) const _DemoDataNotice(),
                  _RangeSelector(
                    selected: progress.timeRange,
                    onSelected: (range) => provider.load(range: range),
                  ),
                  const SizedBox(height: 20),
                  const _SectionHeading('Tổng quan'),
                  const SizedBox(height: 12),
                  _OverviewGrid(progress: progress),
                  const SizedBox(height: 24),
                  const _SectionHeading('Xu hướng điểm TOEIC'),
                  const SizedBox(height: 12),
                  _ScoreTrendCard(points: progress.scoreTrend),
                  const SizedBox(height: 24),
                  const _SectionHeading('Hoạt động học tập'),
                  const SizedBox(height: 12),
                  _ActivityCard(
                    activity: progress.dailyActivity,
                    truncated: progress.dailyActivityTruncated,
                  ),
                  const SizedBox(height: 24),
                  const _SectionHeading('Duy trì thói quen'),
                  const SizedBox(height: 12),
                  _StreakAndPrediction(progress: progress),
                  const SizedBox(height: 24),
                  const _SectionHeading('Phân tích theo Part'),
                  const SizedBox(height: 12),
                  _WeakAreasCard(items: progress.weakAreas),
                  const SizedBox(height: 24),
                  _HistorySection(
                    title: 'Bài thi TOEIC toàn phần',
                    description: 'Chỉ gồm các lượt thi Full có điểm Listening và Reading',
                    page: provider.scores,
                    isLoadingMore: provider.isLoadingMoreScores,
                    onLoadMore: provider.loadMoreScores,
                    emptyMessage: 'Chưa có bài thi Full hoàn thành.',
                  ),
                  const SizedBox(height: 24),
                  _HistorySection(
                    title: 'Lịch sử luyện tập theo Part',
                    description: 'Các lượt luyện Part không được tính vào điểm dự đoán TOEIC',
                    page: provider.practices,
                    isLoadingMore: provider.isLoadingMorePractices,
                    onLoadMore: provider.loadMorePractices,
                    emptyMessage: 'Chưa có lượt luyện Part hoàn thành.',
                  ),
                  if (provider.errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      provider.errorMessage!,
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontSize: 12,
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Text(
                    'Dữ liệu được tổng hợp theo múi giờ ${progress.timezone}.',
                    style: const TextStyle(
                      color: AppColors.slate400,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _InitialState extends StatelessWidget {
  const _InitialState({
    required this.isLoading,
    required this.errorMessage,
    required this.onRetry,
  });

  final bool isLoading;
  final String? errorMessage;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (isLoading) return const Center(child: CircularProgressIndicator());
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.analytics_outlined,
              size: 42,
              color: AppColors.slate400,
            ),
            const SizedBox(height: 12),
            Text(
              errorMessage ?? 'Chưa có dữ liệu thống kê.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.slate500),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Thử tải lại'),
            ),
          ],
        ),
      ),
    );
  }
}

class _DemoDataNotice extends StatelessWidget {
  const _DemoDataNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warningBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Row(
        children: [
          Icon(Icons.info_outline, color: AppColors.warning, size: 18),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Dữ liệu minh họa vì API đang tắt. Không phải kết quả học tập thực tế.',
              style: TextStyle(color: AppColors.slate700, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

class _RangeSelector extends StatelessWidget {
  const _RangeSelector({required this.selected, required this.onSelected});
  final AnalyticsTimeRange selected;
  final ValueChanged<AnalyticsTimeRange> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: [
        for (final range in AnalyticsTimeRange.values)
          ChoiceChip(
            label: Text(range.label),
            selected: selected == range,
            onSelected: (_) => onSelected(range),
            selectedColor: AppColors.blueChipBg,
            labelStyle: TextStyle(
              color: selected == range ? AppColors.brand : AppColors.slate500,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
            side: BorderSide(
              color: selected == range ? AppColors.brand : AppColors.border,
            ),
          ),
      ],
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading(this.title);
  final String title;

  @override
  Widget build(BuildContext context) => Text(
    title,
    style: const TextStyle(
      color: AppColors.slate900,
      fontSize: 16,
      fontWeight: FontWeight.w800,
    ),
  );
}

class _OverviewGrid extends StatelessWidget {
  const _OverviewGrid({required this.progress});
  final AnalyticsProgress progress;

  @override
  Widget build(BuildContext context) {
    final value = progress.timeRange == AnalyticsTimeRange.allTime
        ? progress.lifetime
        : progress.inRange;
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: StatCard(
                value: '${value.vocabulariesLearned}',
                label: 'Từ đã học',
                color: AppColors.brand,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatCard(
                value: '${value.grammarLessonsCompleted}',
                label: 'Bài ngữ pháp',
                color: AppColors.success,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: StatCard(
                value: '${value.mockTestCount}',
                label: 'Bài thi Full',
                color: AppColors.purpleChipFg,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatCard(
                value: '${value.practiceCount}',
                label: 'Lượt luyện Part',
                color: AppColors.amber,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        AppCard(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _SmallMetric(value: '${value.reviewCount}', label: 'Lượt ôn từ'),
              _SmallMetric(value: '${value.studyDays}', label: 'Ngày học'),
            ],
          ),
        ),
      ],
    );
  }
}

class _SmallMetric extends StatelessWidget {
  const _SmallMetric({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(
        value,
        style: const TextStyle(
          color: AppColors.slate900,
          fontWeight: FontWeight.w800,
          fontSize: 20,
        ),
      ),
      const SizedBox(height: 2),
      Text(
        label,
        style: const TextStyle(color: AppColors.slate500, fontSize: 12),
      ),
    ],
  );
}

class _ScoreTrendCard extends StatelessWidget {
  const _ScoreTrendCard({required this.points});
  final List<AnalyticsScoreTrendPoint> points;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (points.isEmpty)
            const Text(
              'Chưa có đủ dữ liệu điểm thi Full để hiển thị xu hướng.',
              style: TextStyle(color: AppColors.slate500, fontSize: 13),
            )
          else ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${points.last.totalScore} điểm gần nhất',
                  style: const TextStyle(
                    color: AppColors.brand,
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                Text(
                  '${points.length} lượt',
                  style: const TextStyle(
                    color: AppColors.slate400,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 132,
              width: double.infinity,
              child: CustomPaint(painter: _ScoreChartPainter(points)),
            ),
            const SizedBox(height: 8),
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '0',
                  style: TextStyle(color: AppColors.slate400, fontSize: 10),
                ),
                Text(
                  '495',
                  style: TextStyle(color: AppColors.slate400, fontSize: 10),
                ),
                Text(
                  '990',
                  style: TextStyle(color: AppColors.slate400, fontSize: 10),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ScoreChartPainter extends CustomPainter {
  _ScoreChartPainter(this.points);
  final List<AnalyticsScoreTrendPoint> points;

  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = AppColors.border
      ..strokeWidth = 1;
    final linePaint = Paint()
      ..color = AppColors.brand
      ..strokeWidth = 2.8
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final pointPaint = Paint()..color = AppColors.brand;

    for (var row = 0; row < 4; row++) {
      final y = size.height * row / 3;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
    if (points.isEmpty) return;
    final ordered = [...points]
      ..sort((a, b) => a.completedAt.compareTo(b.completedAt));
    final path = Path();
    for (var index = 0; index < ordered.length; index++) {
      final x = ordered.length == 1
          ? size.width / 2
          : size.width * index / (ordered.length - 1);
      final y =
          size.height *
          (1 - ordered[index].totalScore.clamp(0, 990).toDouble() / 990);
      final point = Offset(x, y);
      if (index == 0) {
        path.moveTo(point.dx, point.dy);
      } else {
        path.lineTo(point.dx, point.dy);
      }
    }
    canvas.drawPath(path, linePaint);
    for (var index = 0; index < ordered.length; index++) {
      final x = ordered.length == 1
          ? size.width / 2
          : size.width * index / (ordered.length - 1);
      final y =
          size.height *
          (1 - ordered[index].totalScore.clamp(0, 990).toDouble() / 990);
      canvas.drawCircle(Offset(x, y), 4, pointPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _ScoreChartPainter oldDelegate) =>
      !identical(oldDelegate.points, points);
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.activity, required this.truncated});
  final List<AnalyticsDailyActivity> activity;
  final bool truncated;

  @override
  Widget build(BuildContext context) {
    if (activity.isEmpty) {
      return const AppCard(
        child: Text('Chưa có hoạt động học tập trong khoảng thời gian này.'),
      );
    }
    final visible = activity.length > 30
        ? activity.sublist(activity.length - 30)
        : activity;
    final maxCount = visible.fold<int>(
      1,
      (maxValue, item) => math.max(maxValue, item.count).toInt(),
    );
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Số hoạt động mỗi ngày',
                style: TextStyle(color: AppColors.slate500, fontSize: 12),
              ),
              Text(
                '${visible.fold<int>(0, (sum, item) => sum + item.count)} hoạt động',
                style: const TextStyle(color: AppColors.slate500, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 112,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var index = 0; index < visible.length; index++)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 1.5),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Align(
                              alignment: Alignment.bottomCenter,
                              child: Container(
                                width: double.infinity,
                                height: visible[index].count == 0
                                    ? 3.0
                                    : math
                                          .max(
                                            5.0,
                                            78.0 *
                                                visible[index].count /
                                                maxCount,
                                          )
                                          .toDouble(),
                                decoration: BoxDecoration(
                                  color: visible[index].count == 0
                                      ? AppColors.slate200
                                      : AppColors.brand,
                                  borderRadius: BorderRadius.circular(3),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          if (visible.length <= 7 ||
                              index == 0 ||
                              index == visible.length - 1 ||
                              index % 5 == 0)
                            Text(
                              '${visible[index].date.day}',
                              style: const TextStyle(
                                fontSize: 9,
                                color: AppColors.slate400,
                              ),
                            )
                          else
                            const SizedBox(height: 11),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (truncated) ...[
            const SizedBox(height: 8),
            const Text(
              'Biểu đồ chỉ hiển thị tối đa 365 ngày hoạt động gần nhất.',
              style: TextStyle(fontSize: 11, color: AppColors.slate400),
            ),
          ],
        ],
      ),
    );
  }
}

class _StreakAndPrediction extends StatelessWidget {
  const _StreakAndPrediction({required this.progress});
  final AnalyticsProgress progress;

  @override
  Widget build(BuildContext context) {
    final predicted = progress.predictedToeicScore;
    return Column(
      children: [
        AppCard(
          child: Row(
            children: [
              const CircleAvatar(
                backgroundColor: AppColors.warningBg,
                child: Icon(
                  Icons.local_fire_department,
                  color: AppColors.warning,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${progress.learningStreakDays} ngày liên tiếp',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      'Kỷ lục: ${progress.longestStreak} ngày',
                      style: const TextStyle(
                        color: AppColors.slate500,
                        fontSize: 12,
                      ),
                    ),
                  ],
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
              const Text(
                'Điểm TOEIC dự đoán',
                style: TextStyle(color: AppColors.slate500, fontSize: 12),
              ),
              const SizedBox(height: 6),
              if (predicted == null)
                const Text(
                  'Cần ít nhất 3 bài thi Full trong 30 ngày gần nhất để tính điểm dự đoán.',
                  style: TextStyle(color: AppColors.slate500, fontSize: 13),
                )
              else ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      '$predicted',
                      style: const TextStyle(
                        color: AppColors.brand,
                        fontSize: 36,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Text(
                      '/ 990',
                      style: TextStyle(color: AppColors.slate400),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: (predicted / 990).clamp(0, 1).toDouble(),
                    minHeight: 8,
                    backgroundColor: AppColors.border,
                    valueColor: const AlwaysStoppedAnimation(AppColors.brand),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Ước tính từ tối đa 3 bài thi Full gần nhất trong 30 ngày; không phải điểm chính thức.',
                  style: TextStyle(color: AppColors.slate400, fontSize: 11),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _WeakAreasCard extends StatelessWidget {
  const _WeakAreasCard({required this.items});
  final List<AnalyticsWeakArea> items;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        children: [
          for (final item in items) ...[
            Row(
              children: [
                SizedBox(
                  width: 58,
                  child: Text(
                    'Part ${item.part}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
                Expanded(
                  child: item.isAvailable
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(99),
                              child: LinearProgressIndicator(
                                value: item.accuracyPercent! / 100,
                                minHeight: 7,
                                backgroundColor: AppColors.border,
                                valueColor: AlwaysStoppedAnimation(
                                  item.isWeak == true
                                      ? AppColors.warning
                                      : AppColors.success,
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${item.correct}/${item.total} câu đúng',
                              style: const TextStyle(
                                fontSize: 10,
                                color: AppColors.slate400,
                              ),
                            ),
                          ],
                        )
                      : Text(
                          'Cần thêm dữ liệu (tối thiểu 20 câu)',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.slate400,
                          ),
                        ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 42,
                  child: Text(
                    item.isAvailable ? '${item.accuracyPercent}%' : '—',
                    textAlign: TextAlign.end,
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                      color: item.isWeak == true
                          ? AppColors.warning
                          : AppColors.slate500,
                    ),
                  ),
                ),
              ],
            ),
            if (item.part != items.last.part)
              const Divider(height: 22, color: AppColors.border),
          ],
          const SizedBox(height: 8),
          const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Vùng yếu được xác định khi tỷ lệ sai đạt ngưỡng 30% và có tối thiểu 20 câu trong 30 ngày.',
              style: TextStyle(color: AppColors.slate400, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }
}

class _HistorySection extends StatelessWidget {
  const _HistorySection({
    required this.title,
    required this.description,
    required this.page,
    required this.isLoadingMore,
    required this.onLoadMore,
    required this.emptyMessage,
  });

  final String title;
  final String description;
  final AnalyticsHistoryPage? page;
  final bool isLoadingMore;
  final VoidCallback onLoadMore;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    final items = page?.items ?? const <AnalyticsHistoryItem>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: AppColors.slate900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          description,
          style: const TextStyle(fontSize: 11, color: AppColors.slate400),
        ),
        const SizedBox(height: 10),
        AppCard(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
          child: Column(
            children: [
              if (items.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    emptyMessage,
                    style: const TextStyle(
                      color: AppColors.slate500,
                      fontSize: 12,
                    ),
                  ),
                )
              else
                for (var index = 0; index < items.length; index++) ...[
                  _HistoryRow(item: items[index]),
                  if (index != items.length - 1)
                    const Divider(height: 20, color: AppColors.border),
                ],
              if (page?.hasNext == true) ...[
                const Divider(height: 20, color: AppColors.border),
                TextButton(
                  onPressed: isLoadingMore ? null : onLoadMore,
                  child: isLoadingMore
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Xem thêm'),
                ),
              ],
              if (page != null)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Hiển thị ${items.length}/${page!.total} lượt',
                    style: const TextStyle(
                      color: AppColors.slate400,
                      fontSize: 10,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.item});
  final AnalyticsHistoryItem item;

  @override
  Widget build(BuildContext context) {
    final date = item.completedAt.toLocal();
    final partLabel = item.parts.isEmpty
        ? 'Luyện theo Part'
        : item.parts.map((part) => 'P$part').join(', ');
    final isFull = item.isFull;
    final detail = isFull
        ? 'Listening ${item.scoreListening ?? '—'} · Reading ${item.scoreReading ?? '—'}'
        : '${item.correctCount ?? 0}/${item.totalQuestions ?? 0} câu đúng · $partLabel';
    return Row(
      children: [
        CircleAvatar(
          radius: 18,
          backgroundColor: isFull
              ? AppColors.blueChipBg
              : AppColors.purpleChipBg,
          child: Icon(
            isFull
                ? Icons.assignment_turned_in_outlined
                : Icons.headphones_outlined,
            size: 18,
            color: isFull ? AppColors.brand : AppColors.purpleChipFg,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isFull ? 'Bài thi TOEIC Full' : 'Luyện tập theo Part',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} · $detail',
                style: const TextStyle(fontSize: 10, color: AppColors.slate500),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text(
          isFull
              ? '${item.totalScore ?? '—'}'
              : '${((item.accuracy ?? 0) * 100).round()}%',
          style: TextStyle(
            color: isFull ? AppColors.brand : AppColors.slate700,
            fontSize: 15,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}
