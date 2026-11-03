import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/ai_chat/screens/ai_chat_screen.dart';

import '../../../../theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../home/screens/home_screen.dart';
import 'grammar_list_screen.dart';

class GrammarExample {
  const GrammarExample({required this.label, required this.text});
  final String label;
  final String text;
}

class GrammarLessonScreen extends StatelessWidget {
  const GrammarLessonScreen({super.key});

  // TODO: lấy từ GET /learning/lessons/:id (content_markdown)
  static const String _title = 'Giới từ chỉ thời gian: in, on, at, by';
  static const String _category = 'Giới từ';
  static const String _note = 'Cấu trúc thường gặp ở Part 5';
  static const List<GrammarExample> _examples = [
    GrammarExample(label: 'in', text: 'tháng, năm, mùa\nin March, in 2026'),
    GrammarExample(label: 'on', text: 'thứ, ngày cụ thể\non Monday, on May 5'),
    GrammarExample(label: 'at', text: 'giờ, thời điểm\nat 8 a.m., at noon'),
    GrammarExample(label: 'by', text: 'hạn chót\nby Friday'),
  ];
  static const String _exampleSentence = 'Please submit your report by Friday.';

  void _onMarkDone(BuildContext context) {
    Navigator.of(context).pop();
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
              const Text(
                _category,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.brand,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                _title,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.slate900,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                _note,
                style: TextStyle(fontSize: 13, color: AppColors.slate500),
              ),
              const SizedBox(height: 16),
              ..._examples.map(
                (e) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 40,
                          alignment: Alignment.center,
                          child: Text(
                            e.label,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: AppColors.brand,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            e.text,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.slate700,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              AppCard(
                color: AppColors.blueChipBg,
                borderColor: Colors.transparent,
                child: Text(
                  'Ví dụ: $_exampleSentence',
                  style: const TextStyle(
                    fontSize: 13,
                    fontStyle: FontStyle.italic,
                    color: AppColors.blueChipFg,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => _onMarkDone(context),
                child: const Text('Đánh dấu hoàn thành'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () => _onAskAi(context),
                child: const Text('Hỏi trợ lý AI về bài này'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
