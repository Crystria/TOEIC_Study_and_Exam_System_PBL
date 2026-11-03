import 'package:flutter/material.dart';

import '../../../../theme/app_colors.dart';
import '../../../../shared/widgets/answer_option_tile.dart';

class QuickQuizQuestion {
  const QuickQuizQuestion({
    required this.word,
    required this.phonetic,
    required this.options,
    required this.correctIndex,
  });

  final String word;
  final String phonetic;
  final List<String> options;
  final int correctIndex;
}

class QuickQuizScreen extends StatefulWidget {
  const QuickQuizScreen({super.key});

  @override
  State<QuickQuizScreen> createState() => _QuickQuizScreenState();
}

class _QuickQuizScreenState extends State<QuickQuizScreen> {
  int _currentIndex = 0;
  int? _selectedOption = 0;

  // TODO: sinh tự động từ kho từ vựng vừa học
  static const List<QuickQuizQuestion> _questions = [
    QuickQuizQuestion(
      word: 'negotiate',
      phonetic: "/nɪˈɡoʊʃiert/",
      options: ['thương lượng', 'hợp đồng', 'hóa đơn', 'đề xuất'],
      correctIndex: 0,
    ),
  ];

  void _onSelect(int index) {
    setState(() => _selectedOption = index);
  }

  // TODO: chấm điểm, điều hướng sang ReviewResultScreen khi hết câu
  void _onCheck() {}
  void _onSkip() {}

  @override
  Widget build(BuildContext context) {
    final q = _questions[_currentIndex];

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Quiz nhanh',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  Text(
                    'Câu ${_currentIndex + 1}/${_questions.length}',
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
                  value: (_currentIndex + 1) / _questions.length,
                  minHeight: 6,
                  backgroundColor: AppColors.border,
                  valueColor: const AlwaysStoppedAnimation(AppColors.brand),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Chọn nghĩa đúng của từ:',
                style: TextStyle(fontSize: 14, color: AppColors.slate500),
              ),
              const SizedBox(height: 8),
              Text(
                q.word,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: AppColors.brand,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                q.phonetic,
                style: const TextStyle(fontSize: 14, color: AppColors.slate500),
              ),
              const SizedBox(height: 20),
              ...List.generate(q.options.length, (i) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AnswerOptionTile(
                    letter: String.fromCharCode(65 + i),
                    text: q.options[i],
                    state: _selectedOption == i
                        ? OptionState.selected
                        : OptionState.neutral,
                    onTap: () => _onSelect(i),
                  ),
                );
              }),
              const Spacer(),
              ElevatedButton(
                onPressed: _onCheck,
                child: const Text('Kiểm tra'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(onPressed: _onSkip, child: const Text('Bỏ qua')),
            ],
          ),
        ),
      ),
    );
  }
}
