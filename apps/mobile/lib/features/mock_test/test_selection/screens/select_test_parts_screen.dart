import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/mock_test/test_taking/screens/mock_test_taking_screen.dart';

import '../../../../theme/app_colors.dart';
import '../../../home/screens/home_screen.dart';

class TestPartOption {
  TestPartOption({
    required this.part,
    required this.title,
    required this.questionCount,
    this.selected = true,
  });

  final int part;
  final String title;
  final int questionCount;
  bool selected;
}

class SelectTestPartsScreen extends StatefulWidget {
  const SelectTestPartsScreen({super.key, required this.testCode});

  final String testCode;

  @override
  State<SelectTestPartsScreen> createState() => _SelectTestPartsScreenState();
}

class _SelectTestPartsScreenState extends State<SelectTestPartsScreen> {
  // TODO: lấy cấu trúc đề từ GET /tests/:id
  final List<TestPartOption> _parts = [
    TestPartOption(part: 1, title: 'Mô tả hình ảnh', questionCount: 6),
    TestPartOption(part: 2, title: 'Hỏi - đáp', questionCount: 25),
    TestPartOption(part: 3, title: 'Hội thoại ngắn', questionCount: 39),
    TestPartOption(part: 4, title: 'Bài nói ngắn', questionCount: 30),
    TestPartOption(part: 5, title: 'Điền vào câu', questionCount: 30),
    TestPartOption(part: 6, title: 'Điền vào đoạn văn', questionCount: 16),
    TestPartOption(part: 7, title: 'Đọc hiểu', questionCount: 54),
  ];

  static const List<String> _timeOptions = [
    'Không tính giờ',
    '15 phút',
    '30 phút',
    '1 giờ',
    '1 giờ 30',
    '2 giờ',
  ];
  String _selectedTime = '2 giờ';

  bool get _allSelected => _parts.every((p) => p.selected);
  int get _totalQuestions => _parts
      .where((p) => p.selected)
      .fold(0, (sum, p) => sum + p.questionCount);

  void _toggleAll() {
    setState(() {
      final next = !_allSelected;
      for (final p in _parts) {
        p.selected = next;
      }
    });
  }

  void _togglePart(TestPartOption part) {
    setState(() => part.selected = !part.selected);
  }

  // TODO: tạo attempt qua POST /tests/:testId/attempts với phần thi và thời gian đã chọn
  void _onStart(BuildContext context) {
    Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute(
        builder: (_) => const MockTestTakingScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Chọn phần thi',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  Text(
                    widget.testCode,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.slate500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              GestureDetector(
                onTap: () => Navigator.of(context).maybePop(),
                child: const Text(
                  '← Danh sách đề',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.brand,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _allSelected ? AppColors.blueChipBg : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _allSelected ? AppColors.brand : AppColors.border,
                  ),
                ),
                child: InkWell(
                  onTap: _toggleAll,
                  child: Row(
                    children: [
                      Icon(
                        _allSelected
                            ? Icons.check_circle
                            : Icons.radio_button_unchecked,
                        color: _allSelected
                            ? AppColors.brand
                            : AppColors.slate400,
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'Chọn tất cả · Full test',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.slate900,
                          ),
                        ),
                      ),
                      Text(
                        _allSelected ? 'Bỏ chọn' : '200 câu · 120 phút',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.brand,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              ..._parts.map(
                (p) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: p.selected ? AppColors.blueChipBg : Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: p.selected ? AppColors.brand : AppColors.border,
                      ),
                    ),
                    child: InkWell(
                      onTap: () => _togglePart(p),
                      child: Row(
                        children: [
                          Icon(
                            p.selected
                                ? Icons.check_circle
                                : Icons.radio_button_unchecked,
                            color: p.selected
                                ? AppColors.brand
                                : AppColors.slate400,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Part ${p.part} · ${p.title}',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.slate900,
                              ),
                            ),
                          ),
                          Text(
                            '${p.questionCount} câu',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.slate500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Thời gian làm bài',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.slate900,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: _timeOptions.map((t) {
                  final active = t == _selectedTime;
                  return SizedBox(
                    width: (MediaQuery.of(context).size.width - 32 - 20) / 3,
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedTime = t),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: active ? AppColors.blueChipBg : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: active ? AppColors.brand : AppColors.border,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          t,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: active
                                ? AppColors.brand
                                : AppColors.slate700,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 10),
              Text(
                'Full test · $_totalQuestions câu · $_selectedTime',
                style: const TextStyle(fontSize: 12, color: AppColors.slate500),
              ),
              const SizedBox(height: 10),
              ElevatedButton(
                onPressed: () => _onStart(context),
                child: const Text('Bắt đầu làm bài'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
