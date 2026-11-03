import 'package:flutter/material.dart';

import '../../../ai_chat/screens/ai_chat_screen.dart';
import '../../../home/screens/home_screen.dart';
import '../../test_result/screens/answer_explanation_screen.dart';
import '../../test_selection/screens/mock_test_select_screen.dart';
import '../widgets/detail_title_row.dart';
import '../widgets/result_summary_card.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../theme/app_colors.dart';

class WrongAnswerItem {
  const WrongAnswerItem({
    required this.questionNumber,
    required this.selected,
    required this.correct,
  });
  final int questionNumber;
  final String selected;
  final String correct;
}

class TestHistoryDetailPartScreen extends StatelessWidget {
  const TestHistoryDetailPartScreen({super.key});

  static const String _title = 'Đề 03 · Part 5';
  static const String _dateLabel = '12/10/2026';
  static const int _accuracy = 87;
  static const int _correct = 26;
  static const int _total = 30;
  static const String _durationLabel = 'Reading · 12:40';
  static const List<WrongAnswerItem> _wrongAnswers = [
    WrongAnswerItem(questionNumber: 3, selected: 'in', correct: 'by'),
    WrongAnswerItem(questionNumber: 9, selected: 'during', correct: 'while'),
    WrongAnswerItem(questionNumber: 17, selected: 'since', correct: 'for'),
    WrongAnswerItem(questionNumber: 25, selected: 'of', correct: 'on'),
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
                value: '$_accuracy%',
                caption: 'chính xác',
                lines: ['$_correct/$_total đúng · $_durationLabel'],
              ),
              const SizedBox(height: 16),
              Text(
                'Các câu làm sai (${_wrongAnswers.length})',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.slate900,
                ),
              ),
              const SizedBox(height: 10),
              AppCard(
                child: Column(
                  children: _wrongAnswers
                      .map(
                        (w) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(
                            children: [
                              Expanded(
                                child: RichText(
                                  text: TextSpan(
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: AppColors.slate900,
                                    ),
                                    children: [
                                      TextSpan(
                                        text: 'Câu ${w.questionNumber} ',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      TextSpan(
                                        text: 'Bạn chọn ${w.selected}',
                                        style: const TextStyle(
                                          color: AppColors.danger,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              Text(
                                'Đúng ${w.correct}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.success,
                                ),
                              ),
                            ],
                          ),
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
                child: const Text('Làm lại Part này'),
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
