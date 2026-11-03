import 'package:flutter/material.dart';
import 'package:toeic_mobile/features/learning/grammar/screens/grammar_lesson_screen.dart';

import '../../../../theme/app_colors.dart';
import '../../../../shared/widgets/app_card.dart';

enum LessonStatus { done, inProgress, notStarted }

class GrammarLessonItem {
  const GrammarLessonItem({
    required this.title,
    required this.category,
    required this.status,
  });
  final String title;
  final String category;
  final LessonStatus status;
}

class GrammarListScreen extends StatelessWidget {
  const GrammarListScreen({super.key});

  // TODO: lấy từ GET /learning/lessons
  static const List<GrammarLessonItem> _lessons = [
    GrammarLessonItem(
      title: 'Thì của động từ',
      category: 'Động từ',
      status: LessonStatus.done,
    ),
    GrammarLessonItem(
      title: 'Giới từ chỉ thời gian: in, on, at, by',
      category: 'Giới từ',
      status: LessonStatus.inProgress,
    ),
    GrammarLessonItem(
      title: 'Mệnh đề quan hệ',
      category: 'Mệnh đề',
      status: LessonStatus.notStarted,
    ),
    GrammarLessonItem(
      title: 'Câu điều kiện',
      category: 'Mệnh đề',
      status: LessonStatus.notStarted,
    ),
    GrammarLessonItem(
      title: 'Từ loại',
      category: 'Từ loại',
      status: LessonStatus.notStarted,
    ),
    GrammarLessonItem(
      title: 'Bị động & chủ động',
      category: 'Động từ',
      status: LessonStatus.notStarted,
    ),
  ];

  void _onOpenLesson(BuildContext context, GrammarLessonItem lesson) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => GrammarLessonScreen())
    );
  }

  String _statusLabel(LessonStatus s) {
    switch (s) {
      case LessonStatus.done:
        return 'Xong';
      case LessonStatus.inProgress:
        return 'Đang học';
      case LessonStatus.notStarted:
        return 'Chưa học';
    }
  }

  Color _statusColor(LessonStatus s) {
    switch (s) {
      case LessonStatus.done:
        return AppColors.success;
      case LessonStatus.inProgress:
        return AppColors.warning;
      case LessonStatus.notStarted:
        return AppColors.slate400;
    }
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Ngữ pháp',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate900,
                    ),
                  ),
                  Text(
                    '${_lessons.length} bài',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.slate500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ..._lessons.map(
                (lesson) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: AppCard(
                    padding: const EdgeInsets.all(14),
                    child: InkWell(
                      onTap: () => _onOpenLesson(context, lesson),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  lesson.title,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.slate900,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  lesson.category,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.slate500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            _statusLabel(lesson.status),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: _statusColor(lesson.status),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
