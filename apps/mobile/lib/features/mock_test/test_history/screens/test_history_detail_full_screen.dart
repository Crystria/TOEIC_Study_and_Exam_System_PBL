import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/ai_chat/screens/ai_chat_screen.dart';
import 'package:toeic_mobile/features/mock_test/test_result/screens/answer_explanation_screen.dart';
import 'package:toeic_mobile/features/mock_test/test_selection/screens/mock_test_select_screen.dart';

import '../../../home/screens/home_screen.dart';
import '../widgets/detail_title_row.dart';
import '../widgets/result_summary_card.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/progress_row.dart';
import '../../../../theme/app_colors.dart';

class PartResult {
  const PartResult({
    required this.label,
    required this.correct,
    required this.total,
  });
  final String label;
  final int correct;
  final int total;
}

class TestHistoryDetailFullScreen extends StatelessWidget {
  const TestHistoryDetailFullScreen({super.key});

  static const String _title = 'Đề 05 · Full';
  static const String _dateLabel = '15/10/2026';
  static const int _totalScore = 735;
  static const int _listening = 385;
  static const int _reading = 350;
  static const String _duration = '1:52:30 · 200 câu';
  static const List<PartResult> _parts = [
    PartResult(label: 'Part 1', correct: 5, total: 6),
    PartResult(label: 'Part 2', correct: 23, total: 25),
    PartResult(label: 'Part 3', correct: 33, total: 39),
    PartResult(label: 'Part 4', correct: 26, total: 30),
    PartResult(label: 'Part 5', correct: 25, total: 30),
    PartResult(label: 'Part 6', correct: 13, total: 16),
    PartResult(label: 'Part 7', correct: 42, total: 54),
  ];

  void _onViewExplanation(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => AnswerExplanationScreen())
    );
  }
  void _onRetake(BuildContext context) {
    Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => MockTestSelectScreen())
    );
  }
  void _onAskAi(BuildContext context) {
    HomeShell.of(context).goToTab(3);
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
              const DetailTitleRow(title: _title, dateLabel: _dateLabel),
              const SizedBox(height: 16),
              const ResultSummaryCard(
                value: '$_totalScore',
                caption: '/ 990',
                lines: ['Listening $_listening · Reading $_reading'],
                footnote: 'Thời gian làm bài: $_duration',
              ),
              const SizedBox(height: 16),
              const Text(
                'Kết quả theo Part',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.slate900,
                ),
              ),
              const SizedBox(height: 10),
              AppCard(
                child: Column(
                  children: _parts
                      .map(
                        (p) => ProgressRow(
                          title: p.label,
                          progressText: '${p.correct}/${p.total} đúng',
                          value: p.correct / p.total,
                          color: AppColors.success,
                        ),
                      )
                      .toList(),
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => _onViewExplanation(context),
                child: const Text('Xem lời giải chi tiết'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () => _onRetake(context),
                child: const Text('Làm lại đề này'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () => _onAskAi(context),
                child: const Text('Hỏi trợ lý AI'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
