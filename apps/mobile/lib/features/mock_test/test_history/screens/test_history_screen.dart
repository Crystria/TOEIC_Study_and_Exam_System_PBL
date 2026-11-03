import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/mock_test/test_history/screens/test_history_detail_full_screen.dart';
import 'package:toeic_mobile/features/mock_test/test_history/screens/test_history_detail_part_screen.dart';

import '../../widgets/filter_tab.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';

enum TestHistoryFilter { all, fullTest, byPart }
enum TestType {full, part }

class TestHistoryItem {
  const TestHistoryItem({
    required this.title,
    required this.type,
    required this.dateLabel,
    required this.score,
  });
  final String title;
  final TestType type;
  final String dateLabel;
  final int score;
}

class TestHistoryScreen extends StatefulWidget {
  const TestHistoryScreen({super.key});

  @override
  State<TestHistoryScreen> createState() => _TestHistoryScreenState();
}

class _TestHistoryScreenState extends State<TestHistoryScreen> {
  TestHistoryFilter _filter = TestHistoryFilter.all;

  static const List<TestHistoryItem> _items = [
    TestHistoryItem(
      title: 'ETS-2026-05 · Đề đầy đủ',
      type: TestType.full,
      dateLabel: '15/10/2026 · L 385 · R 350',
      score: 735,

    ),
    TestHistoryItem(
      title: 'ETS-2026-03 · Part 5',
      type: TestType.part,
      dateLabel: '12/10/2026 · Reading 410',
      score: 410,
    ),
    TestHistoryItem(
      title: 'ETS-2026-04 · Đề đầy đủ',
      type: TestType.full,
      dateLabel: '08/10/2026 · L 360 · R 340',
      score: 700,
    ),
    TestHistoryItem(
      title: 'ETS-2026-01 · Part 7',
      type: TestType.part,
      dateLabel: '03/10/2026 · Reading 385',
      score: 385,
    ),
    TestHistoryItem(
      title: 'ETS-2026-03 · Đề đầy đủ',
      type: TestType.full,
      dateLabel: '28/09/2026 · L 330 · R 310',
      score: 640,
    ),
  ];

  void _onOpenDetail(BuildContext context, TestHistoryItem item) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => (item.type == TestType.full ? TestHistoryDetailFullScreen() : TestHistoryDetailPartScreen()))
    );
  }

  @override
  Widget build(BuildContext context) {
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
                    'Lịch sử làm bài',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  Text(
                    '${_items.length} bài',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.slate500,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: FilterTab(
                      label: 'Tất cả',
                      active: _filter == TestHistoryFilter.all,
                      onTap: () =>
                          setState(() => _filter = TestHistoryFilter.all),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilterTab(
                      label: 'Đề đầy đủ',
                      active: _filter == TestHistoryFilter.fullTest,
                      onTap: () =>
                          setState(() => _filter = TestHistoryFilter.fullTest),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilterTab(
                      label: 'Luyện theo Part',
                      active: _filter == TestHistoryFilter.byPart,
                      onTap: () =>
                          setState(() => _filter = TestHistoryFilter.byPart),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final item = _items[index];
                  return AppCard(
                    padding: const EdgeInsets.all(14),
                    child: InkWell(
                      onTap: () => _onOpenDetail(context, item),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.title,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.slate900,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  item.dateLabel,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.slate500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${item.score}',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.brand,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Text(
                            'điểm',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.slate400,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
