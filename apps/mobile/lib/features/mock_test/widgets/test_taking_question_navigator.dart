import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../providers/mock_test_taking_provider.dart';

class TestTakingQuestionNavigator {
  TestTakingQuestionNavigator._();

  static Future<void> show(
    BuildContext context,
    MockTestTakingProvider provider,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        final height = MediaQuery.of(sheetContext).size.height;
        return SafeArea(
          child: SizedBox(
            height: math.min(height * 0.78, 620.0).toDouble(),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Danh sách câu hỏi',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.slate900,
                          ),
                        ),
                      ),
                      Text(
                        '${provider.answeredCount}/${provider.totalQuestions} đã trả lời',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.slate500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: provider.availableParts.map((part) {
                      final count = provider.questionCountForPart(part);
                      final answered = provider.answeredCountForPart(part);
                      final active = provider.currentQuestion?.part == part;
                      return InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () {
                          provider.jumpToPart(part);
                          Navigator.pop(sheetContext);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: active
                                ? AppColors.blueChipBg
                                : AppColors.slate50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: active
                                  ? AppColors.brand
                                  : AppColors.border,
                            ),
                          ),
                          child: Text(
                            'P$part · $answered/$count',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: active
                                  ? AppColors.brand
                                  : AppColors.slate700,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  const Divider(height: 1),
                  const SizedBox(height: 12),
                  Expanded(
                    child: GridView.builder(
                      itemCount: provider.totalQuestions,
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 6,
                            mainAxisSpacing: 9,
                            crossAxisSpacing: 9,
                            childAspectRatio: 1.15,
                          ),
                      itemBuilder: (context, index) {
                        final question = provider.questions[index];
                        final isCurrent = index == provider.currentIndex;
                        final isAnswered = provider.isAnswered(
                          question.questionId,
                        );
                        final background = isCurrent
                            ? AppColors.brand
                            : isAnswered
                            ? AppColors.successBg
                            : AppColors.slate50;
                        final foreground = isCurrent
                            ? Colors.white
                            : isAnswered
                            ? AppColors.success
                            : AppColors.slate700;
                        return Material(
                          color: background,
                          borderRadius: BorderRadius.circular(10),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(10),
                            onTap: () {
                              provider.jumpToIndex(index);
                              Navigator.pop(sheetContext);
                            },
                            child: Container(
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isCurrent
                                      ? AppColors.brand
                                      : isAnswered
                                      ? AppColors.success.withValues(
                                          alpha: 0.35,
                                        )
                                      : AppColors.border,
                                ),
                              ),
                              child: Text(
                                '${index + 1}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: foreground,
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Row(
                    children: [
                      _QuestionLegend(
                        color: AppColors.brand,
                        label: 'Đang xem',
                      ),
                      SizedBox(width: 14),
                      _QuestionLegend(
                        color: AppColors.success,
                        label: 'Đã trả lời',
                      ),
                      SizedBox(width: 14),
                      _QuestionLegend(
                        color: AppColors.slate400,
                        label: 'Chưa trả lời',
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _QuestionLegend extends StatelessWidget {
  const _QuestionLegend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 10, color: AppColors.slate500),
            ),
          ),
        ],
      ),
    );
  }
}
