import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/learning/review/screens/review_select_words_screen.dart';

import '../../../../core/navigation/app_navigation_state.dart';
import '../../widgets/grade_button.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';

class VocabularyScreen extends StatefulWidget {
  const VocabularyScreen({
    super.key,
  });

  @override
  State<VocabularyScreen> createState() => _VocabularyScreenState();
}

class _VocabularyScreenState extends State<VocabularyScreen> {
  static const _topicName = 'Office & Business';
  static const _currentIndex = 7;
  static const _totalCards = 20;
  static const _word = 'negotiate';
  static const _phonetic = "/nɪˈɡoʊʃiert/";
  static const _definition = 'thương lượng, đàm phán';
  static const _example = '"We need to negotiate the contract terms."';

  void _onPlayAudio() {}
  void _onGrade(int quality) {}

  @override
  Widget build(BuildContext context) {
    final progress = _currentIndex / _totalCards;

    return Container(
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
                  const Text(
                    _topicName,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  Text(
                    'Thẻ $_currentIndex/$_totalCards',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.slate500,
                    ),
                  ),
                ],
              ),
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
                    const AppPillBadge(
                      label: 'Từ mới',
                      bg: AppColors.blueChipBg,
                      fg: AppColors.blueChipFg,
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      _word,
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        color: AppColors.brand,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      _phonetic,
                      style: TextStyle(fontSize: 14, color: AppColors.slate500),
                    ),
                    const SizedBox(height: 14),
                    GestureDetector(
                      onTap: _onPlayAudio,
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
                    const Text(
                      _definition,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      _example,
                      textAlign: TextAlign.center,
                      style: TextStyle(
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
                      onTap: () => _onGrade(1),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GradeButton(
                      label: 'Mơ hồ',
                      sub: 'Grade 3',
                      color: AppColors.warning,
                      bg: AppColors.warningBg,
                      onTap: () => _onGrade(3),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GradeButton(
                      label: 'Đã thuộc',
                      sub: 'Grade 5',
                      color: AppColors.success,
                      bg: AppColors.successBg,
                      onTap: () => _onGrade(5),
                    ),
                  ),
                ],
              ),
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
    );
  }
}
