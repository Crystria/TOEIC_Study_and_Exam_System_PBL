import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../providers/answer_explanation_provider.dart';

/// Bottom-sheet question picker for the answer-review flow.
class AnswerExplanationQuestionNavigator {
  AnswerExplanationQuestionNavigator._();

  static Future<void> show(
    BuildContext context,
    AnswerExplanationProvider provider,
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
              child: AnimatedBuilder(
                animation: provider,
                builder: (context, _) {
                  final indexes = provider.filteredQuestionIndexes;
                  return Column(
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
                            '${indexes.length}/${provider.totalQuestions} câu',
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
                        children: [
                          _ExplanationFilterChip(
                            label: 'Tất cả',
                            filter: ExplanationFilter.all,
                            provider: provider,
                          ),
                          _ExplanationFilterChip(
                            label: 'Câu đúng',
                            filter: ExplanationFilter.correct,
                            provider: provider,
                          ),
                          _ExplanationFilterChip(
                            label: 'Câu sai',
                            filter: ExplanationFilter.incorrect,
                            provider: provider,
                          ),
                          _ExplanationFilterChip(
                            label: 'Chưa làm',
                            filter: ExplanationFilter.unanswered,
                            provider: provider,
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      const Divider(height: 1),
                      const SizedBox(height: 12),
                      Expanded(
                        child: indexes.isEmpty
                            ? const Center(
                                child: Text(
                                  'Không có câu hỏi phù hợp với bộ lọc này.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: AppColors.slate500,
                                  ),
                                ),
                              )
                            : GridView.builder(
                                itemCount: indexes.length,
                                gridDelegate:
                                    const SliverGridDelegateWithFixedCrossAxisCount(
                                      crossAxisCount: 6,
                                      mainAxisSpacing: 9,
                                      crossAxisSpacing: 9,
                                      childAspectRatio: 1.15,
                                    ),
                                itemBuilder: (context, gridIndex) {
                                  final questionIndex = indexes[gridIndex];
                                  final review =
                                      provider.reviews[questionIndex];
                                  final state = provider.stateForIndex(
                                    questionIndex,
                                  );
                                  final isCurrent =
                                      questionIndex ==
                                      provider.currentQuestionIndex;

                                  return Material(
                                    color: _backgroundForState(state),
                                    borderRadius: BorderRadius.circular(10),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(10),
                                      onTap: () {
                                        provider.goToQuestion(questionIndex);
                                        Navigator.pop(sheetContext);
                                      },
                                      child: Container(
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          border: Border.all(
                                            color: isCurrent
                                                ? AppColors.brand
                                                : _borderForState(state),
                                            width: isCurrent ? 2 : 1,
                                          ),
                                        ),
                                        child: Text(
                                          '${review.question.orderNo}',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                            color: _foregroundForState(state),
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
                      const SizedBox(height: 12),
                      const Wrap(
                        spacing: 14,
                        runSpacing: 8,
                        children: [
                          _QuestionLegend(
                            color: AppColors.brand,
                            label: 'Đang xem',
                          ),
                          _QuestionLegend(
                            color: AppColors.success,
                            label: 'Đúng',
                          ),
                          _QuestionLegend(
                            color: AppColors.danger,
                            label: 'Sai',
                          ),
                          _QuestionLegend(
                            color: AppColors.warning,
                            label: 'Chưa làm',
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }

  static Color _backgroundForState(ExplanationAnswerState state) {
    switch (state) {
      case ExplanationAnswerState.correct:
        return AppColors.successBg;
      case ExplanationAnswerState.incorrect:
        return AppColors.dangerBg;
      case ExplanationAnswerState.unanswered:
        return AppColors.warningBg;
    }
  }

  static Color _foregroundForState(ExplanationAnswerState state) {
    switch (state) {
      case ExplanationAnswerState.correct:
        return AppColors.success;
      case ExplanationAnswerState.incorrect:
        return AppColors.danger;
      case ExplanationAnswerState.unanswered:
        return AppColors.warning;
    }
  }

  static Color _borderForState(ExplanationAnswerState state) {
    switch (state) {
      case ExplanationAnswerState.correct:
        return AppColors.success.withValues(alpha: 0.35);
      case ExplanationAnswerState.incorrect:
        return AppColors.danger.withValues(alpha: 0.35);
      case ExplanationAnswerState.unanswered:
        return AppColors.warning.withValues(alpha: 0.35);
    }
  }
}

class _ExplanationFilterChip extends StatelessWidget {
  const _ExplanationFilterChip({
    required this.label,
    required this.filter,
    required this.provider,
  });

  final String label;
  final ExplanationFilter filter;
  final AnswerExplanationProvider provider;

  @override
  Widget build(BuildContext context) {
    final selected = provider.selectedFilter == filter;
    final count = provider.countForFilter(filter);

    return ChoiceChip(
      label: Text('$label ($count)'),
      selected: selected,
      showCheckmark: false,
      selectedColor: AppColors.blueChipBg,
      backgroundColor: AppColors.slate50,
      side: BorderSide(color: selected ? AppColors.brand : AppColors.border),
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: selected ? AppColors.brand : AppColors.slate700,
      ),
      onSelected: (_) => provider.setFilter(filter),
    );
  }
}

class _QuestionLegend extends StatelessWidget {
  const _QuestionLegend({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppColors.slate500),
        ),
      ],
    );
  }
}
