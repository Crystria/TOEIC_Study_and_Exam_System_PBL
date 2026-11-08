import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/full_screen_flow_scope.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../theme/app_colors.dart';
import '../../providers/review_flashcard_provider.dart';
import '../../widgets/grade_button.dart';
import 'review_result_screen.dart';

class ReviewFlashcardScreen extends StatefulWidget {
  const ReviewFlashcardScreen({super.key});

  @override
  State<ReviewFlashcardScreen> createState() => _ReviewFlashcardScreenState();
}

class _ReviewFlashcardScreenState extends State<ReviewFlashcardScreen> {
  bool _allowPop = false;
  bool _isExitDialogOpen = false;

  Future<void> _onGrade(int quality) async {
    final provider = context.read<ReviewFlashcardProvider>();
    if (provider.isGrading) return;
    await provider.grade(quality);
    if (!mounted) return;
    if (provider.status == ReviewFlashcardStatus.finished) {
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const ReviewResultScreen()),
      );
    }
  }

  Future<void> _confirmExit() async {
    if (_isExitDialogOpen || _allowPop) return;

    final navigator = Navigator.of(context);
    _isExitDialogOpen = true;
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Xác nhận thoát'),
        content: const Text(
          'Bạn có chắc chắn muốn thoát khỏi quá trình ôn tập?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Ở lại'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Thoát'),
          ),
        ],
      ),
    );
    _isExitDialogOpen = false;
    if (shouldExit == true && mounted) {
      setState(() => _allowPop = true);

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          navigator.pop();
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ReviewFlashcardProvider>();
    return FullScreenFlowScope(child: _buildContent(provider));
  }

  Widget _buildContent(ReviewFlashcardProvider provider) {
    final word = provider.currentWord;

    if (provider.status == ReviewFlashcardStatus.loading ||
        provider.status == ReviewFlashcardStatus.idle) {
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (provider.status == ReviewFlashcardStatus.finished || word == null) {
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(child: Text('Không có từ để ôn.')),
      );
    }

    return PopScope(
      canPop: _allowPop,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop || _allowPop) return;
        _confirmExit();
      },
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Ôn lại từ đã học',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.slate900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Thẻ ${provider.currentIndex + 1}/${provider.totalCards}',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.slate500,
                  ),
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: provider.progress,
                    minHeight: 6,
                    backgroundColor: AppColors.border,
                    valueColor: const AlwaysStoppedAnimation(AppColors.brand),
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    vertical: 32,
                    horizontal: 20,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      const AppPillBadge(
                        label: 'Ôn lại',
                        bg: AppColors.blueChipBg,
                        fg: AppColors.blueChipFg,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        word.word,
                        style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w800,
                          color: AppColors.brand,
                        ),
                      ),
                      if (word.phonetic.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          word.phonetic,
                          style: const TextStyle(
                            fontSize: 14,
                            color: AppColors.slate500,
                          ),
                        ),
                      ],
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
                        word.meaning,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.slate900,
                        ),
                      ),
                      if (word.example.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          word.example,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 14,
                            fontStyle: FontStyle.italic,
                            color: AppColors.brand,
                          ),
                        ),
                      ],
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
                        onTap: provider.isGrading ? () {} : () => _onGrade(1),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: GradeButton(
                        label: 'Mơ hồ',
                        sub: 'Grade 3',
                        color: AppColors.warning,
                        bg: AppColors.warningBg,
                        onTap: provider.isGrading ? () {} : () => _onGrade(3),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: GradeButton(
                        label: 'Đã thuộc',
                        sub: 'Grade 5',
                        color: AppColors.success,
                        bg: AppColors.successBg,
                        onTap: provider.isGrading ? () {} : () => _onGrade(5),
                      ),
                    ),
                  ],
                ),
                if (provider.isGrading) ...[
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
    );
  }
}
