import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class MockTestResultScreen extends StatelessWidget {
  const MockTestResultScreen({super.key});

  // TODO: lấy từ GET /attempts/:attemptId
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

  // TODO: điều hướng sang AnswerExplanationScreen
  void _onViewExplanation(BuildContext context) {}

  // TODO: điều hướng sang AiChatScreen kèm context attemptId
  void _onAskAi(BuildContext context) {}

  void _onBackHome(BuildContext context) {}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                decoration: const BoxDecoration(color: AppColors.brand),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
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
                          child: _ScoreCard(
                            title: 'Listening',
                            score: _listeningScore,
                            max: _listeningMax,
                            correct: _listeningCorrect,
                            total: _listeningTotal,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _ScoreCard(
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
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.successBg,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                      ),
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
    );
  }
}

class _ScoreCard extends StatelessWidget {
  const _ScoreCard({
    required this.title,
    required this.score,
    required this.max,
    required this.correct,
    required this.total,
  });

  final String title;
  final int score;
  final int max;
  final int correct;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 13, color: AppColors.slate500),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '$score',
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: AppColors.brand,
                ),
              ),
              Text(
                ' / $max',
                style: const TextStyle(fontSize: 13, color: AppColors.slate400),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Đúng $correct/$total câu',
            style: const TextStyle(fontSize: 12, color: AppColors.slate500),
          ),
        ],
      ),
    );
  }
}
