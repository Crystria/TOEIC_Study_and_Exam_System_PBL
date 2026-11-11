import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';
import '../../models/grammar_lesson.dart';
import '../../providers/grammar_list_provider.dart';
import 'grammar_lesson_screen.dart';

class GrammarListScreen extends StatefulWidget {
  const GrammarListScreen({super.key});

  @override
  State<GrammarListScreen> createState() => _GrammarListScreenState();
}

class _GrammarListScreenState extends State<GrammarListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<GrammarListProvider>();
      if (provider.status == GrammarListFetchStatus.idle ||
          provider.status == GrammarListFetchStatus.error) {
        provider.loadLessons();
      }
    });
  }

  Future<void> _onOpenLesson(GrammarLesson lesson) async {
    final grammarProvider = context.read<GrammarListProvider>();
    grammarProvider.markLessonStarted(lesson.id);

    final completed = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => GrammarLessonScreen(lessonId: lesson.id),
      ),
    );

    if (!mounted) return;
    if (completed == true) {
      grammarProvider.markLessonDone(lesson.id);
    }
  }

  String _statusLabel(GrammarProgressStatus status) {
    switch (status) {
      case GrammarProgressStatus.completed:
        return 'Đã hoàn thành';
      case GrammarProgressStatus.inProgress:
        return 'Đang học';
      case GrammarProgressStatus.notStarted:
        return 'Chưa học';
    }
  }

  Color _statusColor(GrammarProgressStatus status) {
    switch (status) {
      case GrammarProgressStatus.completed:
        return AppColors.success;
      case GrammarProgressStatus.inProgress:
        return AppColors.warning;
      case GrammarProgressStatus.notStarted:
        return AppColors.slate500;
    }
  }

  Widget _buildEmptyState() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.menu_book_outlined, size: 44, color: AppColors.slate400),
            SizedBox(height: 12),
            Text(
              'Chưa có bài học ngữ pháp',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.slate900,
              ),
            ),
            SizedBox(height: 6),
            Text(
              'Các chủ điểm ngữ pháp sẽ được cập nhật tại đây.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.slate500),
            ),
          ],
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.bg,
      foregroundColor: AppColors.slate900,
      elevation: 0,
      title: const Text(
        'Ngữ pháp',
        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
      ),
      leading: IconButton(
        tooltip: 'Quay lại',
        icon: const Icon(Icons.arrow_back_rounded),
        onPressed: () => Navigator.of(context).pop(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<GrammarListProvider>();

    if (provider.status == GrammarListFetchStatus.loading &&
        provider.lessons.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        appBar: _buildAppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (provider.status == GrammarListFetchStatus.error &&
        provider.lessons.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        appBar: _buildAppBar(),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.cloud_off_outlined,
                  size: 40,
                  color: AppColors.slate400,
                ),
                const SizedBox(height: 12),
                Text(
                  provider.errorMessage ?? 'Không thể tải bài học.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: provider.loadLessons,
                  child: const Text('Thử lại'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: _buildAppBar(),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => provider.loadLessons(forceRefresh: true),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const SizedBox(height: 4),
              const Text(
                'Học các cấu trúc thường gặp trong TOEIC Listening & Reading.',
                style: TextStyle(fontSize: 13, color: AppColors.slate500),
              ),
              const SizedBox(height: 16),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Tiến độ học',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.slate900,
                          ),
                        ),
                        Text(
                          '${provider.completedCount}/${provider.totalCount} bài',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.brand,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: provider.completionRate,
                        minHeight: 7,
                        backgroundColor: AppColors.slate200,
                        color: AppColors.brand,
                      ),
                    ),
                  ],
                ),
              ),
              if (provider.persistenceError != null) ...[
                const SizedBox(height: 10),
                Text(
                  provider.persistenceError!,
                  style: const TextStyle(fontSize: 12, color: AppColors.danger),
                ),
              ],
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Danh sách chủ điểm',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  Text(
                    '${provider.lessons.length} bài học',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.slate500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (provider.lessons.isEmpty)
                SizedBox(height: 260, child: _buildEmptyState())
              else
                ...provider.lessons.map((lesson) {
                  final progress = provider.lessonStatus(lesson.id);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: AppCard(
                      padding: const EdgeInsets.all(14),
                      child: InkWell(
                        onTap: () => _onOpenLesson(lesson),
                        borderRadius: BorderRadius.circular(10),
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: AppColors.blueChipBg,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                Icons.menu_book_outlined,
                                color: AppColors.blueChipFg,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    lesson.title,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.slate900,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    [
                                      lesson.category,
                                      if (lesson.level != null &&
                                          lesson.level!.isNotEmpty)
                                        lesson.level!,
                                      if (lesson.durationMinutes != null &&
                                          lesson.durationMinutes! > 0)
                                        '${lesson.durationMinutes} phút',
                                    ].join(' · '),
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.slate500,
                                    ),
                                  ),
                                  const SizedBox(height: 5),
                                  Text(
                                    lesson.summary,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.slate700,
                                      height: 1.35,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  _statusLabel(progress),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: _statusColor(progress),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                const Icon(
                                  Icons.chevron_right,
                                  color: AppColors.slate400,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              if (provider.status == GrammarListFetchStatus.loading) ...[
                const SizedBox(height: 8),
                const LinearProgressIndicator(minHeight: 2),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
