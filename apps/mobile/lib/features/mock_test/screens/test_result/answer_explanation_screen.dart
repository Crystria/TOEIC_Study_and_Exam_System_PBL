import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/navigation/app_navigation_state.dart';
import '../../../ai_chat/models/ai_chat_context.dart';
import '../../../ai_chat/providers/ai_chat_provider.dart';
import '../../../../core/navigation/full_screen_flow_scope.dart';
import '../../../../shared/widgets/answer_option_tile.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/text_link_button.dart';
import '../../../../theme/app_colors.dart';
import '../../models/mock_test_submission.dart';
import '../../models/test_attempt_group.dart';
import '../../providers/answer_explanation_provider.dart';
import '../../widgets/answer_explanation_question_navigator.dart';

class AnswerExplanationScreen extends StatelessWidget {
  const AnswerExplanationScreen({
    super.key,
    this.submission,
    this.initialIndex = 0,
    this.backLabel = 'Quay lại kết quả',
  });

  final MockTestSubmission? submission;
  final int initialIndex;
  final String backLabel;

  @override
  Widget build(BuildContext context) {
    final result = submission;
    if (result == null) {
      return const _ExplanationUnavailableScreen();
    }

    return ChangeNotifierProvider<AnswerExplanationProvider>(
      create: (_) => AnswerExplanationProvider(
        submission: result,
        initialIndex: initialIndex,
      ),
      child: _AnswerExplanationView(backLabel: backLabel),
    );
  }
}

class _AnswerExplanationView extends StatelessWidget {
  const _AnswerExplanationView({required this.backLabel});

  final String backLabel;

  void _askAi(BuildContext context, AnswerExplanationProvider provider) {
    final review = provider.currentReview;
    if (review == null) return;

    final question = review.question;
    context.read<AiChatProvider>().startContextualConversation(
      AiMockTestQuestionContext(
        testId: provider.submission.testId,
        testTitle: provider.submission.testTitle,
        questionId: question.questionId,
        part: question.part,
        questionNumber: question.orderNo,
        questionType: question.type,
        questionText: question.questionText,
        options: question.options
            .map(
              (option) => AiChatContextOption(
                code: option.optionCode,
                text: option.optionText,
              ),
            )
            .toList(growable: false),
        selectedOption: review.selectedOption,
        correctOption: review.correctOption,
        explanation: review.explanation,
        groupInstruction: provider.currentGroup?.instruction,
        groupTranscript: provider.currentGroup?.transcript,
        groupPassageText: provider.currentGroup?.passageText,
        groupAssetContent: provider.currentGroup?.assets
            .where((asset) => asset.content?.trim().isNotEmpty == true)
            .map((asset) => '${asset.kind}: ${asset.content}')
            .join('\n'),
        imageDescription: question.imageDescription,
      ),
    );
    Navigator.of(context).popUntil((route) => route.isFirst);
    AppNavigationState.requestTab(3);
  }

  @override
  Widget build(BuildContext context) {
    return FullScreenFlowScope(
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Consumer<AnswerExplanationProvider>(
            builder: (context, provider, _) {
              final review = provider.currentReview;
              if (review == null) {
                return const Center(child: Text('Không có dữ liệu lời giải.'));
              }

              final question = review.question;
              final group = provider.currentGroup;
              final selected = review.selectedOption;
              final isCorrect = review.isCorrect;

              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    child: TextLinkButton(
                      label: backLabel,
                      leadingIcon: Icons.arrow_back,
                      centered: false,
                      onTap: () => Navigator.of(context).pop(),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Lời giải chi tiết',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: AppColors.slate900,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${provider.submission.testTitle} · '
                          '${provider.submission.isFullTest ? 'FULL' : 'PART'}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.slate500,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                provider.currentMatchesFilter
                                    ? 'Câu ${question.orderNo} · Part ${question.part}'
                                    : 'Không có câu hỏi phù hợp với bộ lọc',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.slate700,
                                ),
                              ),
                            ),
                            Text(
                              '${provider.currentNumber}/${provider.filteredQuestionCount}',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.slate500,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                            value: provider.filteredQuestionCount == 0
                                ? 0
                                : provider.currentNumber /
                                      provider.filteredQuestionCount,
                            minHeight: 5,
                            backgroundColor: AppColors.border,
                            valueColor: const AlwaysStoppedAnimation(
                              AppColors.brand,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (provider.currentMatchesFilter)
                    Expanded(
                      child: SingleChildScrollView(
                        key: ValueKey(question.questionId),
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            AppCard(
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      selected == null
                                          ? 'Chưa trả lời'
                                          : isCorrect
                                          ? 'Bạn đã trả lời đúng'
                                          : 'Bạn đã trả lời sai',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: selected == null
                                            ? AppColors.warning
                                            : isCorrect
                                            ? AppColors.success
                                            : AppColors.danger,
                                      ),
                                    ),
                                  ),
                                  AppBadge(
                                    label: selected == null
                                        ? 'Bỏ trống'
                                        : isCorrect
                                        ? 'Chính xác'
                                        : 'Chưa chính xác',
                                    bg: selected == null
                                        ? AppColors.warningBg
                                        : isCorrect
                                        ? AppColors.successBg
                                        : AppColors.dangerBg,
                                    fg: selected == null
                                        ? AppColors.warning
                                        : isCorrect
                                        ? AppColors.success
                                        : AppColors.danger,
                                  ),
                                ],
                              ),
                            ),
                            if (group != null) ...[
                              const SizedBox(height: 12),
                              _GroupMaterialCard(group: group),
                            ],
                            const SizedBox(height: 12),
                            AppCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    question.questionText.isEmpty
                                        ? _listeningPrompt(question.part)
                                        : question.questionText,
                                    style: const TextStyle(
                                      fontSize: 15,
                                      height: 1.5,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.slate900,
                                    ),
                                  ),
                                  if (question.imageUrl != null) ...[
                                    const SizedBox(height: 12),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: Image.network(
                                        question.imageUrl!,
                                        fit: BoxFit.contain,
                                        errorBuilder: (_, _, _) => const Text(
                                          'Không thể tải hình ảnh của câu hỏi.',
                                          style: TextStyle(
                                            color: AppColors.slate500,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                  if (question.imageDescription != null) ...[
                                    const SizedBox(height: 8),
                                    Text(
                                      'Mô tả hình minh họa: ${question.imageDescription}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.slate500,
                                        height: 1.4,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 14),
                                  ...question.options.map((option) {
                                    final isAnswer =
                                        option.optionCode ==
                                        review.correctOption;
                                    final isSelected =
                                        option.optionCode == selected;
                                    final state = isAnswer
                                        ? OptionState.correct
                                        : isSelected
                                        ? OptionState.wrongSelected
                                        : OptionState.neutral;
                                    final label =
                                        option.optionText.trim().isEmpty
                                        ? 'Nội dung lựa chọn không có trong dữ liệu mẫu.'
                                        : option.optionText;
                                    return Padding(
                                      padding: const EdgeInsets.only(bottom: 9),
                                      child: AnswerOptionTile(
                                        letter: option.optionCode,
                                        text: label,
                                        state: state,
                                        tag: isAnswer
                                            ? 'Đáp án đúng'
                                            : isSelected
                                            ? 'Bạn đã chọn'
                                            : null,
                                      ),
                                    );
                                  }),
                                  const SizedBox(height: 2),
                                  Text(
                                    selected == null
                                        ? 'Bạn chưa chọn đáp án. Đáp án đúng là ${review.correctOption}.'
                                        : selected == review.correctOption
                                        ? 'Đáp án của bạn: $selected · Chính xác.'
                                        : 'Bạn chọn: $selected · Đáp án đúng: ${review.correctOption}.',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.slate700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'Giải thích đáp án',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: AppColors.slate900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            AppCard(
                              child: Text(
                                review.explanation ??
                                    'Bộ dữ liệu mẫu chưa có phần giải thích chi tiết cho câu này. '
                                        'Khi kết nối Exam Service, nội dung explanation sẽ được lấy từ kết quả Attempt đã nộp.',
                                style: const TextStyle(
                                  fontSize: 14,
                                  height: 1.55,
                                  color: AppColors.slate700,
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                            OutlinedButton.icon(
                              onPressed: () => _askAi(context, provider),
                              icon: const Icon(Icons.chat_bubble_outline),
                              label: const Text('Hỏi trợ lý AI về câu này'),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    const Expanded(
                      child: Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Text(
                            'Không có câu hỏi phù hợp với bộ lọc hiện tại. '
                            'Mở danh sách câu hỏi để chọn bộ lọc khác.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.5,
                              color: AppColors.slate500,
                            ),
                          ),
                        ),
                      ),
                    ),
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(top: BorderSide(color: AppColors.border)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: provider.canGoPrevious
                                ? provider.goPrev
                                : null,
                            child: const Text('← Câu trước'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filledTonal(
                          tooltip: 'Danh sách câu hỏi',
                          onPressed: () =>
                              AnswerExplanationQuestionNavigator.show(
                                context,
                                provider,
                              ),
                          icon: const Icon(Icons.grid_view_rounded),
                          style: IconButton.styleFrom(
                            foregroundColor: AppColors.brand,
                            backgroundColor: AppColors.blueChipBg,
                            minimumSize: const Size(48, 48),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: FilledButton(
                            onPressed: provider.canGoNext
                                ? provider.goNext
                                : null,
                            child: const Text('Câu sau →'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  String _listeningPrompt(int part) {
    switch (part) {
      case 1:
        return 'Quan sát hình ảnh và chọn câu mô tả phù hợp nhất.';
      case 2:
        return 'Nghe câu hỏi hoặc phát biểu và chọn phản hồi phù hợp nhất.';
      case 3:
        return 'Nghe đoạn hội thoại và trả lời câu hỏi.';
      case 4:
        return 'Nghe bài nói chuyện ngắn và trả lời câu hỏi.';
      default:
        return 'Câu hỏi của bài thi.';
    }
  }
}

class _GroupMaterialCard extends StatelessWidget {
  const _GroupMaterialCard({required this.group});

  final TestAttemptGroup group;

  String _formatPassage(String value) {
    return value.replaceAllMapped(
      RegExp(r'\[\[(\d+)\]\]'),
      (match) => '(${match.group(1)}) __________',
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasContent =
        (group.passageText?.trim().isNotEmpty ?? false) ||
        (group.transcript?.trim().isNotEmpty ?? false) ||
        group.assets.any((asset) => asset.content?.trim().isNotEmpty ?? false);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Tài liệu dùng chung cho nhóm câu hỏi',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: AppColors.slate900,
            ),
          ),
          if (group.instruction != null) ...[
            const SizedBox(height: 5),
            Text(
              group.instruction!,
              style: const TextStyle(fontSize: 12, color: AppColors.slate500),
            ),
          ],
          if (group.passageText?.trim().isNotEmpty ?? false) ...[
            const SizedBox(height: 10),
            Text(
              _formatPassage(group.passageText!),
              style: const TextStyle(
                fontSize: 13,
                height: 1.55,
                color: AppColors.slate700,
              ),
            ),
          ],
          if (group.transcript?.trim().isNotEmpty ?? false) ...[
            const SizedBox(height: 10),
            const Text(
              'Transcript',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: AppColors.slate900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              group.transcript!,
              style: const TextStyle(
                fontSize: 13,
                height: 1.5,
                color: AppColors.slate700,
              ),
            ),
          ],
          for (final asset in group.assets)
            if (asset.content?.trim().isNotEmpty ?? false) ...[
              const SizedBox(height: 10),
              Text(
                asset.content!,
                style: const TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: AppColors.slate700,
                ),
              ),
            ],
          if (!hasContent) ...[
            const SizedBox(height: 8),
            Text(
              group.audioUrl == null
                  ? 'Audio hoặc nội dung media của nhóm chưa có trong dữ liệu mẫu.'
                  : 'Nhóm có audio đính kèm; trình phát media sẽ được kết nối cùng API ở giai đoạn tích hợp.',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.slate500,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ExplanationUnavailableScreen extends StatelessWidget {
  const _ExplanationUnavailableScreen();

  @override
  Widget build(BuildContext context) {
    return FullScreenFlowScope(
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          title: const Text('Lời giải chi tiết'),
          backgroundColor: AppColors.bg,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.info_outline,
                  size: 42,
                  color: AppColors.slate500,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Chưa có dữ liệu Attempt để hiển thị lời giải. '
                  'Hãy mở phần lời giải từ màn hình kết quả sau khi nộp bài.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.slate700, height: 1.5),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Quay lại'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
