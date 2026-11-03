import 'package:flutter/material.dart';
import 'package:toeic_mobile/core/navigation/app_navigation_state.dart';
import 'package:toeic_mobile/features/learning/review/screens/review_flashcard_screen.dart';
import 'package:toeic_mobile/features/learning/vocabulary/screens/vocabulary_screen.dart';
import 'package:toeic_mobile/features/learning/vocabulary/screens/vocabulary_topics_screen.dart';

import '../../../../theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/chip_button.dart';

enum WordMastery { chuaThuoc, moHo, daThuoc }

class ReviewWordItem {
  ReviewWordItem({
    required this.word,
    required this.meaning,
    required this.mastery,
    this.selected = false,
  });

  final String word;
  final String meaning;
  final WordMastery mastery;
  bool selected;
}

class ReviewSelectWordsScreen extends StatefulWidget {
  const ReviewSelectWordsScreen({super.key});

  @override
  State<ReviewSelectWordsScreen> createState() =>
      _ReviewSelectWordsScreenState();
}

class _ReviewSelectWordsScreenState extends State<ReviewSelectWordsScreen> {
  int _topicTab = 0;
  static const List<String> _topics = ['Office & Business', 'Marketing'];

  // TODO: lấy danh sách từ cần ôn từ GET /learning/review-today
  final List<ReviewWordItem> _words = [
    ReviewWordItem(
      word: 'negotiate',
      meaning: 'thương lượng',
      mastery: WordMastery.moHo,
      selected: true,
    ),
    ReviewWordItem(
      word: 'contract',
      meaning: 'hợp đồng',
      mastery: WordMastery.daThuoc,
    ),
    ReviewWordItem(
      word: 'invoice',
      meaning: 'hóa đơn',
      mastery: WordMastery.chuaThuoc,
      selected: true,
    ),
    ReviewWordItem(
      word: 'deadline',
      meaning: 'hạn chót',
      mastery: WordMastery.daThuoc,
    ),
    ReviewWordItem(
      word: 'client',
      meaning: 'khách hàng',
      mastery: WordMastery.daThuoc,
    ),
    ReviewWordItem(
      word: 'proposal',
      meaning: 'đề xuất',
      mastery: WordMastery.moHo,
      selected: true,
    ),
  ];

  void _toggle(ReviewWordItem item) {
    setState(() => item.selected = !item.selected);
  }

  void _openFlashcards() {
    AppNavigationState.hideBottomNavigation();

    Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute(
        builder: (_) => const ReviewFlashcardScreen(),
      ),
    );
  }

  void _onAllWords() {
    setState(() {
      for (final w in _words) {
        w.selected = true;
      }
    });

    _openFlashcards();
  }

  Future<void> _onSkipTopic() async {
    final didPop = await Navigator.of(context).maybePop();

    if (!mounted) return;

    if (!didPop) {
      Navigator.of(context, rootNavigator: true).popUntil(
            (route) => route.isFirst,
      );
    }

    AppNavigationState.showBottomNavigation();
  }

  // TODO: điều hướng sang ReviewFlashcardScreen với danh sách đã chọn
  void _onStartReview() {
    if (!_words.any((w) => w.selected)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng chọn ít nhất một từ.'),
        ),
      );
      return;
    }

    _openFlashcards();
  }

  String _masteryLabel(WordMastery m) {
    switch (m) {
      case WordMastery.chuaThuoc:
        return 'Chưa thuộc';
      case WordMastery.moHo:
        return 'Mơ hồ';
      case WordMastery.daThuoc:
        return 'Đã thuộc';
    }
  }

  Color _masteryColor(WordMastery m) {
    switch (m) {
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
    final selectedCount = _words.where((w) => w.selected).length;

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) AppNavigationState.showBottomNavigation();
      },
      child: Scaffold(
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
                    'Office & Business · ${_words.length} từ',
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
                children: List.generate(_topics.length, (i) {
                  final active = i == _topicTab;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChipButton(
                      label: _topics[i],
                      selected: active,
                      onTap: () => setState(() => _topicTab = i),
                    ),
                  );
                }),
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _words.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final w = _words[index];
                  return AppCard(
                    padding: const EdgeInsets.all(14),
                    borderColor: w.selected
                        ? AppColors.brand
                        : AppColors.border,
                    child: InkWell(
                      onTap: () => _toggle(w),
                      child: Row(
                        children: [
                          Checkbox(
                            value: w.selected,
                            activeColor: AppColors.brand,
                            onChanged: (_) => _toggle(w),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  w.word,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.slate900,
                                  ),
                                ),
                                Text(
                                  w.meaning,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.slate500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            _masteryLabel(w.mastery),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: _masteryColor(w.mastery),
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
                    onPressed: () => _onStartReview(),
                    child: Text('Ôn lại các từ đã chọn ($selectedCount)'),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _onAllWords,
                          child: Text('Ôn lại tất cả ${_words.length} từ'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _onSkipTopic,
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
    ),);
  }
}
