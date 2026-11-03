import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/mock_test/test_selection/screens/select_test_parts_screen.dart';

import '../../widgets/filter_tab.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';

enum TestFilter { all, fullTest, byPart }

class MockTestListItem {
  const MockTestListItem({
    required this.id,
    required this.tag,
    required this.done,
    required this.title,
    required this.meta,
    this.bestScore,
  });

  final String id;
  final String tag;
  final bool done;
  final String title;
  final String meta;
  final int? bestScore;
}

class MockTestSelectScreen extends StatefulWidget {
  const MockTestSelectScreen({super.key});

  @override
  State<MockTestSelectScreen> createState() => _MockTestSelectScreenState();
}

class _MockTestSelectScreenState extends State<MockTestSelectScreen> {
  TestFilter _filter = TestFilter.all;

  static const List<MockTestListItem> _tests = [
    MockTestListItem(
      id: 'ets-2026-05',
      tag: 'Đề đầy đủ',
      done: true,
      title: 'ETS-2026-05 · Đề đầy đủ',
      meta: '200 câu · 120 phút · Listening & Reading',
      bestScore: 735,
    ),
    MockTestListItem(
      id: 'ets-2026-04',
      tag: 'Đề đầy đủ',
      done: true,
      title: 'ETS-2026-04 · Đề đầy đủ',
      meta: '200 câu · 120 phút · Listening & Reading',
      bestScore: 700,
    ),
    MockTestListItem(
      id: 'ets-2026-03-part5',
      tag: 'Luyện theo Part',
      done: true,
      title: 'ETS-2026-03 · Part 5',
      meta: '30 câu · 15 phút · Reading',
      bestScore: 410,
    ),
    MockTestListItem(
      id: 'ets-2026-03',
      tag: 'Đề đầy đủ',
      done: false,
      title: 'ETS-2026-03 · Đề đầy đủ',
      meta: '200 câu · 120 phút · Listening & Reading',
      bestScore: null,
    ),
  ];

  void _onStart(String testId) {
    Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute(
        builder: (_) => SelectTestPartsScreen(testCode: testId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.brand,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Thi thử TOEIC',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Chọn đề để làm bài đầy đủ hoặc luyện riêng từng Part, '
                      'có tính giờ và chấm điểm tự động.',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Expanded(
                      child: FilterTab(
                        label: 'Tất cả',
                        active: _filter == TestFilter.all,
                        onTap: () => setState(() => _filter = TestFilter.all),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilterTab(
                        label: 'Đề đầy đủ',
                        active: _filter == TestFilter.fullTest,
                        onTap: () =>
                            setState(() => _filter = TestFilter.fullTest),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilterTab(
                        label: 'Luyện theo Part',
                        active: _filter == TestFilter.byPart,
                        onTap: () =>
                            setState(() => _filter = TestFilter.byPart),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Đề dành cho bạn',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.slate900,
                      ),
                    ),
                    Text(
                      '${_tests.length} đề',
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: _tests
                      .map(
                        (t) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _TestCard(
                            item: t,
                            onStart: () => _onStart(t.id),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 4, 16, 24),
                child: Text(
                  'Cần kết nối Internet ổn định. Nếu mất mạng, hệ thống tự động '
                  'đồng bộ bài làm; đáp án được lưu tạm máy bạn.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: AppColors.slate400),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TestCard extends StatelessWidget {
  const _TestCard({required this.item, required this.onStart});
  final MockTestListItem item;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final isFull = item.tag == 'Đề đầy đủ';
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: isFull ? AppColors.blueChipBg : AppColors.warningBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  item.tag,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isFull ? AppColors.blueChipFg : AppColors.warning,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                item.done ? 'Đã làm' : 'Chưa làm',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: item.done ? AppColors.success : AppColors.slate400,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            item.title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.slate900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            item.meta,
            style: const TextStyle(fontSize: 12, color: AppColors.slate500),
          ),
          const SizedBox(height: 10),
          if (item.bestScore != null)
            Text(
              '${item.bestScore} điểm cao nhất',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.brand,
              ),
            ),
          const SizedBox(height: 10),
          item.done
              ? OutlinedButton(onPressed: onStart, child: const Text('Làm lại'))
              : ElevatedButton(
                  onPressed: onStart,
                  child: const Text('Chọn bài thi'),
                ),
        ],
      ),
    );
  }
}
