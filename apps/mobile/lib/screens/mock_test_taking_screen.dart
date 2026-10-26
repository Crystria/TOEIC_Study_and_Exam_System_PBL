import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class MockTestQuestion {
  const MockTestQuestion({
    required this.number,
    required this.stem,
    required this.options,
    this.selected,
    this.answered = false,
  });

  final int number;
  final String stem;
  final List<String> options;
  final int? selected;
  final bool answered;
}

class MockTestTakingScreen extends StatefulWidget {
  const MockTestTakingScreen({super.key});

  @override
  State<MockTestTakingScreen> createState() => _MockTestTakingScreenState();
}

class _MockTestTakingScreenState extends State<MockTestTakingScreen> {
  static const int _totalQuestions = 30;
  int _currentIndex = 12;
  int? _selectedOption = 1; // B

  static const String _stem =
      'The manager asked all employees to submit their reports _____ Friday afternoon.';
  static const List<String> _options = ['in', 'by', 'since', 'during'];

  // TODO: lấy đề từ POST /tests/:testId/attempts
  // TODO: lưu đáp án qua PUT /attempts/:attemptId/answers/:questionId
  void _onSelectOption(int index) {
    setState(() => _selectedOption = index);
  }

  void _onPrev() {
    if (_currentIndex > 1) setState(() => _currentIndex--);
  }

  void _onNext() {
    if (_currentIndex < _totalQuestions) setState(() => _currentIndex++);
  }

  void _onJumpTo(int q) {
    setState(() => _currentIndex = q);
  }

  // TODO: gọi POST /attempts/:attemptId/submit
  void _onSubmit() {}

  @override
  Widget build(BuildContext context) {
    final progress = _currentIndex / _totalQuestions;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Đề 03 · Part 5',
                          style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.slate900),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Reading · Part 5',
                          style: TextStyle(fontSize: 12, color: AppColors.slate500),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.dangerBg,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text(
                      '28:41',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.danger),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Câu $_currentIndex / $_totalQuestions',
                    style:
                    const TextStyle(fontSize: 12, color: AppColors.slate500),
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 6,
                      backgroundColor: AppColors.border,
                      valueColor:
                      const AlwaysStoppedAnimation(AppColors.brand),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.blueChipBg,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'Câu $_currentIndex',
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.blueChipFg),
                            ),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            _stem,
                            style: TextStyle(
                                fontSize: 16,
                                height: 1.5,
                                color: AppColors.slate900),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    ...List.generate(_options.length, (index) {
                      final selected = _selectedOption == index;
                      final letter = String.fromCharCode(65 + index);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Material(
                          color: selected ? AppColors.blueChipBg : Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(14),
                            onTap: () => _onSelectOption(index),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: selected
                                      ? AppColors.brand
                                      : AppColors.border,
                                  width: selected ? 1.5 : 1,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 28,
                                    height: 28,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: selected
                                          ? AppColors.brand
                                          : AppColors.slate50,
                                      shape: BoxShape.circle,
                                    ),
                                    child: Text(
                                      letter,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: selected
                                            ? Colors.white
                                            : AppColors.slate500,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _options[index],
                                      style: const TextStyle(
                                          fontSize: 15,
                                          color: AppColors.slate900),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                    const SizedBox(height: 8),
                    const Text(
                      'Danh sách câu hỏi',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.slate700),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 40,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: 30,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (context, i) {
                          final q = 1 + i;
                          final active = q == _currentIndex;
                          return GestureDetector(
                            onTap: () => _onJumpTo(q),
                            child: Container(
                              width: 36,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: active
                                    ? AppColors.brand
                                    : AppColors.slate50,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '$q',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: active
                                      ? Colors.white
                                      : AppColors.slate500,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Đáp án được tự động lưu trước khi thoát.',
                      style: TextStyle(fontSize: 12, color: AppColors.slate400),
                    ),
                  ],
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _onPrev,
                      child: const Text('Trước'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _onNext,
                      child: const Text('Sau'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.success,
                      ),
                      onPressed: _onSubmit,
                      child: const Text('Nộp bài'),
                    ),
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
