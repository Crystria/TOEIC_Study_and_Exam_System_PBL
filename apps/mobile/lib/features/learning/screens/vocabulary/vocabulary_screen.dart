import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/full_screen_flow_scope.dart';

import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';
import '../../providers/vocabulary_provider.dart';
import '../../providers/vocabulary_topic_provider.dart';
import '../../widgets/grade_button.dart';
import 'vocabulary_completion_screen.dart';

class VocabularyScreen extends StatefulWidget {
  const VocabularyScreen({
    super.key,
    this.topicId = 't1',
    this.topicName = 'Office & Business',
    this.mode = VocabularyLearningMode.topic,
  });

  final String topicId;
  final String topicName;
  final VocabularyLearningMode mode;

  @override
  State<VocabularyScreen> createState() => _VocabularyScreenState();
}

class _VocabularyScreenState extends State<VocabularyScreen> {
  bool _isGrading = false;
  bool _allowPop = false;
  bool _completionNavigated = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final provider = context.read<VocabularyProvider>();
      if (widget.mode == VocabularyLearningMode.random) {
        await provider.loadRandom();
      } else {
        await provider.loadTopic(widget.topicId);
      }
      if (mounted && provider.status == VocabularyStatus.finished) {
        _navigateToCompletion();
      }
    });
  }

  Future<void> _onGrade(int quality) async {
    if (_isGrading) return;
    setState(() => _isGrading = true);
    try {
      final vocabularyProvider = context.read<VocabularyProvider>();
      final topicsProvider = context.read<VocabularyTopicsProvider>();

      await vocabularyProvider.grade(quality);
      await topicsProvider.refreshProgress();
      if (!mounted) return;

      if (vocabularyProvider.status == VocabularyStatus.finished &&
          !_completionNavigated) {
        _navigateToCompletion();
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không thể lưu tiến trình. Vui lòng thử lại.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isGrading = false);
    }
  }

  void _navigateToCompletion() {
    if (!mounted || _completionNavigated) return;
    _completionNavigated = true;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => VocabularyCompletionScreen(topicName: widget.topicName),
      ),
    );
  }

  Future<void> _confirmExit() async {
    if (_isGrading) return;

    final navigator = Navigator.of(context);
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Thoát phiên học?'),
        content: const Text(
          'Các từ đã đánh giá được lưu ngay trên thiết bị. '
          'Bạn có muốn quay lại danh sách từ vựng?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Tiếp tục học'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Thoát'),
          ),
        ],
      ),
    );

    if (!mounted || _isGrading || shouldExit != true) return;

    setState(() => _allowPop = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) navigator.pop();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<VocabularyProvider>();

    if (provider.status == VocabularyStatus.idle ||
        provider.status == VocabularyStatus.loading) {
      return const FullScreenFlowScope(
        child: ColoredBox(
          color: AppColors.bg,
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (provider.status == VocabularyStatus.error) {
      return FullScreenFlowScope(
        child: ColoredBox(
          color: AppColors.bg,
          child: Center(
            child: ElevatedButton(
              onPressed: provider.reloadCurrentSession,
              child: const Text('Tải lại từ vựng'),
            ),
          ),
        ),
      );
    }

    if (provider.status == VocabularyStatus.finished ||
        provider.current == null) {
      return FullScreenFlowScope(
        child: ColoredBox(
          color: AppColors.bg,
          child: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.check_circle,
                      size: 56,
                      color: AppColors.success,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Đã hoàn thành lượt học từ vựng',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Quay lại danh sách từ vựng'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    final item = provider.current!;
    final total = provider.queue.length;
    final cardNumber = provider.currentIndex + 1;
    final progress = total == 0
        ? 0.0
        : (cardNumber / total).clamp(0.0, 1.0).toDouble();

    return FullScreenFlowScope(
      child: PopScope(
        canPop: _allowPop,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop || _isGrading || _allowPop) return;
          _confirmExit();
        },
        child: Container(
          color: AppColors.bg,
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          widget.topicName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AppColors.slate900,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'Thẻ $cardNumber/$total',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.slate500,
                        ),
                      ),
                    ],
                  ),
                  if (widget.mode == VocabularyLearningMode.random) ...[
                    const SizedBox(height: 4),
                    const Text(
                      'Danh sách được trộn từ nhiều chủ đề; các từ đã học hôm nay sẽ không lặp lại.',
                      style: TextStyle(fontSize: 12, color: AppColors.slate500),
                    ),
                  ],
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 6,
                      backgroundColor: AppColors.border,
                      valueColor: const AlwaysStoppedAnimation(AppColors.brand),
                    ),
                  ),
                  const SizedBox(height: 20),
                  AppCard(
                    padding: const EdgeInsets.symmetric(
                      vertical: 32,
                      horizontal: 20,
                    ),
                    child: Column(
                      children: [
                        AppPillBadge(
                          label: item.masteryGrade == 5
                              ? 'Đã thuộc · Grade 5'
                              : item.masteryGrade == 3
                              ? 'Mơ hồ · Grade 3'
                              : 'Chưa thuộc · Grade 1',
                          bg: item.masteryGrade == 5
                              ? AppColors.blueChipBg
                              : item.masteryGrade == 3
                              ? AppColors.warningBg
                              : AppColors.dangerBg,
                          fg: item.masteryGrade == 5
                              ? AppColors.blueChipFg
                              : item.masteryGrade == 3
                              ? AppColors.warning
                              : AppColors.danger,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          item.word,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                            color: AppColors.brand,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          item.phonetic,
                          style: const TextStyle(
                            fontSize: 14,
                            color: AppColors.slate500,
                          ),
                        ),
                        const SizedBox(height: 14),
                        GestureDetector(
                          onTap: provider.playAudio,
                          child: const AppPillBadge(
                            label: '🔊  Nghe phát âm',
                            bg: AppColors.blueChipBg,
                            fg: AppColors.blueChipFg,
                          ),
                        ),
                        const SizedBox(height: 24),
                        Container(height: 1, color: AppColors.border),
                        const SizedBox(height: 20),
                        const Text(
                          'ĐỊNH NGHĨA',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.slate400,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          item.definition,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppColors.slate900,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          item.example,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 14,
                            fontStyle: FontStyle.italic,
                            color: AppColors.brand,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Bạn nhớ từ này ở mức nào?',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.slate900,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: GradeButton(
                          label: 'Chưa thuộc',
                          sub: 'Grade 1',
                          color: AppColors.danger,
                          bg: AppColors.dangerBg,
                          onTap: _isGrading ? () {} : () => _onGrade(1),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: GradeButton(
                          label: 'Mơ hồ',
                          sub: 'Grade 3',
                          color: AppColors.warning,
                          bg: AppColors.warningBg,
                          onTap: _isGrading ? () {} : () => _onGrade(3),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: GradeButton(
                          label: 'Đã thuộc',
                          sub: 'Grade 5',
                          color: AppColors.success,
                          bg: AppColors.successBg,
                          onTap: _isGrading ? () {} : () => _onGrade(5),
                        ),
                      ),
                    ],
                  ),
                  if (_isGrading) ...[
                    const SizedBox(height: 12),
                    const LinearProgressIndicator(minHeight: 2),
                  ],
                  const SizedBox(height: 14),
                  const Center(
                    child: Text(
                      'Lần ôn kế tiếp được tính theo thuật toán SuperMemo-2',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: AppColors.slate400),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
