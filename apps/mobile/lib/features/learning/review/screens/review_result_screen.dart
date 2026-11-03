import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/learning/review/screens/review_goal_settings_screen.dart';
import 'package:toeic_mobile/features/learning/review/screens/review_select_words_screen.dart';

import '../../../../core/navigation/app_navigation_state.dart';
import '../../../../theme/app_colors.dart';
import '../../../../shared/widgets/success_check.dart';
import '../../../../shared/widgets/stat_card.dart';

class ReviewResultScreen extends StatelessWidget {
  const ReviewResultScreen({super.key});

  // TODO: lấy từ kết quả phiên ôn tập (VocabularySession)
  static const int _daThuoc = 1;
  static const int _moHo = 1;
  static const int _chuaThuoc = 1;

  void _onBackHome(BuildContext context) {
    Navigator.of(context, rootNavigator: true).popUntil(
          (route) => route.isFirst,
    );

    AppNavigationState.showBottomNavigation();
  }
  void _onReviewOthers(BuildContext context) {
    Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => const ReviewSelectWordsScreen(),
      ),
          (route) => route.isFirst,
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;

        _onBackHome(context);
      },
      child: Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SuccessCheck(),
                  const SizedBox(height: 16),
                  const Text(
                    'Hoàn thành ôn lại',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Bạn đã ôn 3 từ của Office & Business',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, color: AppColors.slate500),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: const [
                      Expanded(
                        child: StatCard(
                          value: '$_daThuoc',
                          label: 'Đã thuộc',
                          color: AppColors.success,
                        ),
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: StatCard(
                          value: '$_moHo',
                          label: 'Mơ hồ',
                          color: AppColors.warning,
                        ),
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: StatCard(
                          value: '$_chuaThuoc',
                          label: 'Chưa thuộc',
                          color: AppColors.danger,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => _onBackHome(context),
                      child: const Text('Về trang chủ'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => _onReviewOthers(context),
                      child: const Text('Chọn từ ôn lại khác'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),);
  }
}
