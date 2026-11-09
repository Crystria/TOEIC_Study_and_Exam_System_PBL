import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/full_screen_flow_scope.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/chip_button.dart';
import '../../../../theme/app_colors.dart';
import '../../providers/review_flashcard_provider.dart';
import '../../providers/review_select_words_provider.dart';
import 'review_flashcard_screen.dart';

class ReviewSelectWordsScreen extends StatefulWidget {
  const ReviewSelectWordsScreen({super.key});

  @override
  State<ReviewSelectWordsScreen> createState() =>
      _ReviewSelectWordsScreenState();
}

class _ReviewSelectWordsScreenState extends State<ReviewSelectWordsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<ReviewSelectWordsProvider>();
      if (provider.status == ReviewSelectStatus.idle ||
          provider.status == ReviewSelectStatus.error) {
        provider.loadDueWords();
      }
    });
  }

  Future<void> _openFlashcards({required bool allWords}) async {
    final selectProvider = context.read<ReviewSelectWordsProvider>();
    if (allWords) selectProvider.selectAll();
    final selected = selectProvider.selectedWords;
    if (selected.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng chọn ít nhất một từ.')),
      );
      return;
    }

    final loaded = await context.read<ReviewFlashcardProvider>().loadQueue(
      selected,
      expectedUserId: selectProvider.loadedUserId,
    );
    if (!mounted || !loaded) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => const ReviewFlashcardScreen()),
    );

    if (!mounted) return;
    // The reviewed words may no longer be due. Refresh the server queue so
    // returning from the flashcards does not show stale items/revisions.
    await selectProvider.loadDueWords(selectProvider.selectedTopicId);
  }

  void _onSkip() {
    Navigator.of(context).pop();
  }

  String _masteryLabel(WordMastery mastery) {
    switch (mastery) {
      case WordMastery.chuaThuoc:
        return 'Chưa thuộc';
      case WordMastery.moHo:
        return 'Mơ hồ';
      case WordMastery.daThuoc:
        return 'Đã thuộc';
    }
  }

  Color _masteryColor(WordMastery mastery) {
    switch (mastery) {
      case WordMastery.chuaThuoc:
        return AppColors.danger;
      case WordMastery.moHo:
        return AppColors.warning;
      case WordMastery.daThuoc:
        return AppColors.success;
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ReviewSelectWordsProvider>();
    return FullScreenFlowScope(child: _buildContent(context, provider));
  }

  Widget _buildContent(
    BuildContext context,
    ReviewSelectWordsProvider provider,
  ) {
    if (provider.status == ReviewSelectStatus.idle ||
        provider.status == ReviewSelectStatus.loading) {
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (provider.status == ReviewSelectStatus.error) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(provider.errorMessage ?? 'Không thể tải từ cần ôn.'),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => provider.loadDueWords(),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }

    final words = provider.words;
    final topicName =
        provider.topicOptions[provider.selectedTopicId] ?? 'Chủ đề';

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Ôn lại từ đã học',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  Text(
                    '$topicName · ${words.length} từ',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.slate500,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: provider.topicOptions.entries.map((topic) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChipButton(
                      label: topic.value,
                      selected: topic.key == provider.selectedTopicId,
                      onTap: () => provider.selectTopic(topic.key),
                    ),
                  );
                }).toList(),
              ),
            ),
            Expanded(
              child: words.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.event_available_outlined,
                              size: 42,
                              color: AppColors.slate400,
                            ),
                            SizedBox(height: 10),
                            Text(
                              'Không có từ đến hạn ôn trong chủ đề này.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 14,
                                color: AppColors.slate500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: words.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final word = words[index];
                        return AppCard(
                          padding: const EdgeInsets.all(14),
                          borderColor: word.selected
                              ? AppColors.brand
                              : AppColors.border,
                          child: InkWell(
                            onTap: () => provider.toggle(word.id),
                            child: Row(
                              children: [
                                Checkbox(
                                  value: word.selected,
                                  activeColor: AppColors.brand,
                                  onChanged: (_) => provider.toggle(word.id),
                                ),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        word.word,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.slate900,
                                        ),
                                      ),
                                      Text(
                                        word.meaning,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          color: AppColors.slate500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  _masteryLabel(word.mastery),
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: _masteryColor(word.mastery),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Column(
                children: [
                  ElevatedButton(
                    onPressed: provider.selectedCount == 0
                        ? null
                        : () => _openFlashcards(allWords: false),
                    child: Text(
                      'Ôn lại các từ đã chọn (${provider.selectedCount})',
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => _openFlashcards(allWords: true),
                          child: Text('Ôn lại tất cả ${words.length} từ'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _onSkip,
                          child: const Text('Bỏ qua'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
