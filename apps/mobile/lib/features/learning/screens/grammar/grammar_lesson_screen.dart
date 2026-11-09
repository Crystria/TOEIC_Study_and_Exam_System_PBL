import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../shared/widgets/app_card.dart';
import '../../../ai_chat/models/ai_chat_context.dart';
import '../../../ai_chat/providers/ai_chat_provider.dart';
import '../../../../theme/app_colors.dart';
import '../../../../core/navigation/app_navigation_state.dart';
import '../../providers/grammar_lesson_provider.dart';
import '../../providers/grammar_list_provider.dart';

class GrammarLessonScreen extends StatefulWidget {
  const GrammarLessonScreen({super.key, required this.lessonId});

  final String lessonId;

  @override
  State<GrammarLessonScreen> createState() => _GrammarLessonScreenState();
}

class _GrammarLessonScreenState extends State<GrammarLessonScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<GrammarLessonProvider>();
      if (provider.lesson?.id != widget.lessonId ||
          provider.status == GrammarLessonFetchStatus.idle ||
          provider.status == GrammarLessonFetchStatus.error) {
        provider.loadLesson(widget.lessonId);
      }
    });
  }

  Future<void> _onMarkDone() async {
    final lessonProvider = context.read<GrammarLessonProvider>();
    final listProvider = context.read<GrammarListProvider>();

    if (listProvider.isLessonCompleted(widget.lessonId)) return;

    final completed = await lessonProvider.markDone();
    if (!mounted) return;

    if (!completed) {
      final message =
          lessonProvider.completionErrorMessage ??
          'Chưa thể cập nhật trạng thái hoàn thành. Vui lòng thử lại.';
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
      return;
    }

    listProvider.markLessonDone(widget.lessonId);
    Navigator.of(context).pop(true);
  }

  void _onAskAi() {
    final lesson = context.read<GrammarLessonProvider>().lesson;
    if (lesson == null || lesson.id != widget.lessonId) return;

    final lessonContent = lesson.sections
        .map((section) {
          final examples = section.examples.isEmpty
              ? ''
              : '\nVí dụ:\n${section.examples.map((item) => '- $item').join('\n')}';
          return '${section.title}\n${section.explanation}$examples';
        })
        .join('\n\n');

    context.read<AiChatProvider>().startContextualConversation(
      AiGrammarLessonContext(
        lessonId: lesson.id,
        title: lesson.title,
        category: lesson.category,
        summary: lesson.summary,
        content: lessonContent,
        keyTakeaway: lesson.keyTakeaway ?? '',
      ),
    );
    AppNavigationState.requestTab(3);
  }

  Widget _buildLoading() {
    return const Scaffold(
      backgroundColor: AppColors.bg,
      body: Center(child: CircularProgressIndicator()),
    );
  }

  Widget _buildError(GrammarLessonProvider provider) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text('Bài học ngữ pháp'),
        backgroundColor: AppColors.bg,
        foregroundColor: AppColors.slate900,
        elevation: 0,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.menu_book_outlined,
                size: 42,
                color: AppColors.slate400,
              ),
              const SizedBox(height: 12),
              Text(
                provider.errorMessage ?? 'Không thể tải nội dung bài học.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => provider.loadLesson(widget.lessonId),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<GrammarLessonProvider>();
    final listProvider = context.watch<GrammarListProvider>();

    if (provider.status == GrammarLessonFetchStatus.loading ||
        provider.status == GrammarLessonFetchStatus.idle ||
        provider.lesson?.id != widget.lessonId &&
            provider.status != GrammarLessonFetchStatus.error) {
      return _buildLoading();
    }

    if (provider.status == GrammarLessonFetchStatus.error ||
        provider.lesson == null) {
      return _buildError(provider);
    }

    final lesson = provider.lesson!;
    final isDone = listProvider.isLessonCompleted(widget.lessonId);
    final isMarkingDone =
        provider.status == GrammarLessonFetchStatus.markingDone;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text('Bài học ngữ pháp'),
        backgroundColor: AppColors.bg,
        foregroundColor: AppColors.slate900,
        elevation: 0,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            Text(
              lesson.category.toUpperCase(),
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
                color: AppColors.brand,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              lesson.title,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.slate900,
                height: 1.25,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              lesson.summary,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.slate700,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (lesson.level != null && lesson.level!.isNotEmpty)
                  _InfoChip(
                    label: lesson.level!,
                    icon: Icons.signal_cellular_alt,
                  ),
                if (lesson.durationMinutes != null &&
                    lesson.durationMinutes! > 0)
                  _InfoChip(
                    label: '${lesson.durationMinutes} phút',
                    icon: Icons.schedule_outlined,
                  ),
                _InfoChip(
                  label: '${lesson.sections.length} phần',
                  icon: Icons.menu_book_outlined,
                ),
              ],
            ),
            const SizedBox(height: 20),
            for (var index = 0; index < lesson.sections.length; index++) ...[
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: AppColors.blueChipBg,
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: Text(
                            '${index + 1}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.blueChipFg,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            lesson.sections[index].title,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppColors.slate900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      lesson.sections[index].explanation,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.slate700,
                        height: 1.55,
                      ),
                    ),
                    if (lesson.sections[index].examples.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      const Text(
                        'Ví dụ',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: AppColors.slate900,
                        ),
                      ),
                      const SizedBox(height: 6),
                      ...lesson.sections[index].examples.map(
                        (example) => Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                '• ',
                                style: TextStyle(
                                  color: AppColors.brand,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              Expanded(
                                child: SelectableText(
                                  example,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.slate700,
                                    height: 1.45,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (lesson.keyTakeaway != null &&
                lesson.keyTakeaway!.trim().isNotEmpty)
              AppCard(
                color: AppColors.successBg,
                borderColor: AppColors.success.withValues(alpha: 0.25),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.lightbulb_outline, color: AppColors.success),
                        SizedBox(width: 8),
                        Text(
                          'Ghi nhớ',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: AppColors.slate900,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      lesson.keyTakeaway!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.slate700,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: isDone || isMarkingDone ? null : _onMarkDone,
              icon: Icon(isDone ? Icons.check_circle : Icons.done_all),
              label: Text(
                isDone ? 'Đã hoàn thành bài học' : 'Đánh dấu hoàn thành',
              ),
            ),
            if (isMarkingDone) ...[
              const SizedBox(height: 8),
              const LinearProgressIndicator(minHeight: 2),
            ],
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _onAskAi,
              icon: const Icon(Icons.smart_toy_outlined),
              label: const Text('Hỏi trợ lý AI về bài này'),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.slate500),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.slate700,
            ),
          ),
        ],
      ),
    );
  }
}
