import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/mock_test/test_result/screens/mock_test_result_screen.dart';

import '../../../../shared/widgets/answer_option_tile.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';
import '../../../home/screens/home_screen.dart';

class MockTestTakingScreen extends StatefulWidget {
  const MockTestTakingScreen({super.key});

  @override
  State<MockTestTakingScreen> createState() => _MockTestTakingScreenState();
}

class _MockTestTakingScreenState extends State<MockTestTakingScreen> {
  static const int _totalQuestions = 30;
  int _currentIndex = 12;
  int? _selectedOption = 1;
  bool _isExitDialogOpen = false;

  static const String _stem =
      'The manager asked all employees to submit their reports _____ Friday afternoon.';
  static const List<String> _options = ['in', 'by', 'since', 'during'];

  Future<void> _showExitDialog() async {
    if (_isExitDialogOpen) return;

    _isExitDialogOpen = true;

    final shouldExit = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Thoát bài thi?'),
        content: const Text('Bạn có chắc chắn muốn thoát bài thi hiện tại?'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext, false);
            },
            child: const Text('Tiếp tục làm bài'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext, true);
            },
            child: const Text('Thoát'),
          ),
        ],
      ),
    );

    _isExitDialogOpen = false;

    if (!mounted) return;

    if (shouldExit == true) {
      Navigator.of(context, rootNavigator: true).pop();
    }
  }

  void _onSelectOption(int index) => setState(() => _selectedOption = index);
  void _onPrev() {
    if (_currentIndex > 1) setState(() => _currentIndex--);
  }

  void _onNext() {
    if (_currentIndex < _totalQuestions) setState(() => _currentIndex++);
  }

  void _onJumpTo(int q) => setState(() => _currentIndex = q);
  void _onSubmit() {
    Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute(
        builder: (_) => const MockTestResultScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final progress = _currentIndex / _totalQuestions;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _showExitDialog();
      },
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Đề 03 · Part 5',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.slate900,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Reading · Part 5',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.slate500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const AppBadge(
                      label: '28:41',
                      bg: AppColors.dangerBg,
                      fg: AppColors.danger,
                      fontSize: 14,
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
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.slate500,
                      ),
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 6,
                        backgroundColor: AppColors.border,
                        valueColor: const AlwaysStoppedAnimation(
                          AppColors.brand,
                        ),
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
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            AppBadge(
                              label: 'Câu $_currentIndex',
                              bg: AppColors.blueChipBg,
                              fg: AppColors.blueChipFg,
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              _stem,
                              style: TextStyle(
                                fontSize: 16,
                                height: 1.5,
                                color: AppColors.slate900,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      ...List.generate(_options.length, (index) {
                        final state = _selectedOption == index
                            ? OptionState.selected
                            : OptionState.neutral;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: AnswerOptionTile(
                            letter: String.fromCharCode(65 + index),
                            text: _options[index],
                            state: state,
                            onTap: () => _onSelectOption(index),
                          ),
                        );
                      }),
                      const SizedBox(height: 8),
                      const Text(
                        'Danh sách câu hỏi',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.slate700,
                        ),
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
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.slate400,
                        ),
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
      ),
    );
  }
}
