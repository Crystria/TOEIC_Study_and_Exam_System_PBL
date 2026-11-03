import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/ai_chat/screens/ai_chat_screen.dart';
import 'package:toeic_mobile/features/mock_test/test_result/screens/answer_explanation_screen.dart';

import '../../../../core/navigation/app_navigation_state.dart';
import '../../../home/screens/home_screen.dart';
import '../widgets/score_card.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';

class MockTestResultScreen extends StatelessWidget {
  const MockTestResultScreen({super.key});

  static const int _totalScore = 735;
  static const int _maxScore = 990;
  static const int _listeningScore = 385;
  static const int _listeningMax = 495;
  static const int _listeningCorrect = 78;
  static const int _listeningTotal = 100;
  static const int _readingScore = 350;
  static const int _readingMax = 495;
  static const int _readingCorrect = 71;
  static const int _readingTotal = 100;
  static const int _predictedScore = 705;

  void _onViewExplanation(BuildContext context) {
    Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute(
        builder: (_) => const AnswerExplanationScreen(),
      ),
    );
  }
  void _onAskAi(BuildContext context) {
    Navigator.of(context, rootNavigator: true).popUntil(
          (route) => route.isFirst,
    );

    AppNavigationState.showBottomNavigation();
    AppNavigationState.requestTab(3);
  }
  void _onBackHome(BuildContext context) {
    Navigator.of(context, rootNavigator: true).popUntil(
          (route) => route.isFirst,
    );

    AppNavigationState.showBottomNavigation();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop) _onBackHome(context);
        },
        child: Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                decoration: const BoxDecoration(color: AppColors.brand),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Kết quả Đề 05 · Full',
                      style: TextStyle(color: Colors.white70, fontSize: 14),
                    ),
                    SizedBox(height: 10),
                    Text(
                      '$_totalScore',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 48,
                        fontWeight: FontWeight.w800,
                        height: 1.1,
                      ),
                    ),
                    Text(
                      'Tổng điểm / $_maxScore',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: ScoreCard(
                            title: 'Listening',
                            score: _listeningScore,
                            max: _listeningMax,
                            correct: _listeningCorrect,
                            total: _listeningTotal,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ScoreCard(
                            title: 'Reading',
                            score: _readingScore,
                            max: _readingMax,
                            correct: _readingCorrect,
                            total: _readingTotal,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    AppCard(
                      color: AppColors.successBg,
                      borderColor: AppColors.success.withValues(alpha: 0.3),
                      child: const Text(
                        'Kết quả đã được đồng bộ vào thống kê. Điểm dự đoán mới: $_predictedScore.',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.success,
                          height: 1.4,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: () => _onViewExplanation(context),
                      child: const Text('Xem lời giải chi tiết'),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton(
                      onPressed: () => _onAskAi(context),
                      child: const Text('Hỏi trợ lý AI về bài này'),
                    ),
                    const SizedBox(height: 16),
                    Center(
                      child: GestureDetector(
                        onTap: () => _onBackHome(context),
                        child: const Text(
                          'Về trang chủ',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.brand,
                          ),
                        ),
                      ),
                    ),
                  ],
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
