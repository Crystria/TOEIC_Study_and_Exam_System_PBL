import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../providers/mock_test_taking_provider.dart';

class TestTakingControls extends StatelessWidget {
  const TestTakingControls({
    super.key,
    required this.provider,
    required this.onOpenNavigator,
    required this.onSubmit,
  });

  final MockTestTakingProvider provider;
  final VoidCallback onOpenNavigator;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: provider.currentIndex > 0 ? provider.previous : null,
              child: const Text('Trước'),
            ),
          ),
          const SizedBox(width: 7),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: onOpenNavigator,
              icon: const Icon(Icons.grid_view_rounded, size: 16),
              label: const Text('Câu hỏi'),
            ),
          ),
          const SizedBox(width: 7),
          Expanded(
            child: OutlinedButton(
              onPressed: provider.currentIndex < provider.totalQuestions - 1
                  ? provider.next
                  : null,
              child: const Text('Sau'),
            ),
          ),
          const SizedBox(width: 7),
          Expanded(
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.success,
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              onPressed: provider.isSubmitting ? null : onSubmit,
              child: const Text('Nộp bài'),
            ),
          ),
        ],
      ),
    );
  }
}
