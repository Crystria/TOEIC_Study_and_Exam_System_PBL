import 'package:flutter/material.dart';

import '../../../shared/widgets/answer_option_tile.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../theme/app_colors.dart';
import '../models/test_attempt_group.dart';
import '../models/test_attempt_question.dart';

class TestTakingQuestionContent extends StatelessWidget {
  const TestTakingQuestionContent({
    super.key,
    required this.question,
    required this.group,
    required this.selectedOption,
    required this.onSelect,
    required this.onClear,
  });

  final TestAttemptQuestion question;
  final TestAttemptGroup? group;
  final String? selectedOption;
  final ValueChanged<String> onSelect;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            AppBadge(
              label: 'Part ${question.part}',
              bg: AppColors.blueChipBg,
              fg: AppColors.blueChipFg,
            ),
            const SizedBox(width: 8),
            AppBadge(
              label: question.isListening ? 'Listening' : 'Reading',
              bg: question.isListening
                  ? AppColors.purpleChipBg
                  : AppColors.successBg,
              fg: question.isListening
                  ? AppColors.purpleChipFg
                  : AppColors.success,
            ),
            const Spacer(),
            if (selectedOption != null)
              TextButton.icon(
                onPressed: onClear,
                icon: const Icon(Icons.undo, size: 16),
                label: const Text('Bỏ chọn'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.slate500,
                  textStyle: const TextStyle(fontSize: 11),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (question.part == 1) ...[
          _ImageQuestionMaterial(question: question),
          const SizedBox(height: 12),
          _AudioPromptCard(
            sourceUrl: question.audioUrl,
            title: 'Audio mô tả hình ảnh',
            description:
                'Nghe bốn câu mô tả và chọn câu phù hợp nhất với hình ảnh.',
          ),
        ] else if (question.part == 2) ...[
          _AudioPromptCard(
            sourceUrl: question.audioUrl,
            title: 'Audio câu hỏi – đáp án',
            description: 'Nghe câu hỏi hoặc phát biểu, sau đó chọn phản hồi phù hợp nhất.',
          ),
        ] else if (question.part == 3 || question.part == 4) ...[
          if (group != null)
            _AudioPromptCard(
              sourceUrl: group!.audioUrl,
              title: question.part == 3 ? 'Audio hội thoại' : 'Audio bài nói',
              description:
                  group!.instruction ??
                  'Nghe nội dung và trả lời các câu hỏi bên dưới.',
            ),
        ] else if (question.part == 6 || question.part == 7) ...[
          if (group != null)
            _ReadingMaterialCard(group: group!, part: question.part),
        ],
        if (question.questionText.trim().isNotEmpty) ...[
          const SizedBox(height: 14),
          AppCard(
            child: Text(
              question.questionText,
              style: const TextStyle(
                fontSize: 15,
                height: 1.5,
                fontWeight: FontWeight.w600,
                color: AppColors.slate900,
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        const Text(
          'Chọn một đáp án',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: AppColors.slate900,
          ),
        ),
        const SizedBox(height: 10),
        ...question.options.map((option) {
          final selected = selectedOption == option.optionCode;
          final letterOnly = question.part == 1 || question.part == 2;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: AnswerOptionTile(
              letter: option.optionCode,
              text: letterOnly ? ' ' : option.optionText,
              state: selected ? OptionState.selected : OptionState.neutral,
              onTap: () => onSelect(option.optionCode),
            ),
          );
        }),
      ],
    );
  }
}

class _ImageQuestionMaterial extends StatelessWidget {
  const _ImageQuestionMaterial({required this.question});

  final TestAttemptQuestion question;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (question.imageUrl != null && question.imageUrl!.isNotEmpty)
            Image.network(
              question.imageUrl!,
              width: double.infinity,
              height: 220,
              fit: BoxFit.contain,
              semanticLabel: 'Hình ảnh câu hỏi Part 1',
              errorBuilder: (_, _, _) => const _ImagePlaceholder(),
            )
          else
            Semantics(
              label: 'Hình ảnh câu hỏi Part 1',
              child: const _ImagePlaceholder(),
            ),
        ],
      ),
    );
  }
}

class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 210,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.slate50, AppColors.blueChipBg],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.image_outlined, size: 48, color: AppColors.slate400),
          const SizedBox(height: 8),
          const Text(
            'Hình ảnh câu hỏi',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.slate500,
            ),
          ),
        ],
      ),
    );
  }
}

class _AudioPromptCard extends StatelessWidget {
  const _AudioPromptCard({
    required this.sourceUrl,
    required this.title,
    required this.description,
  });

  final String? sourceUrl;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final hasSource = sourceUrl != null && sourceUrl!.isNotEmpty;
    return AppCard(
      color: AppColors.purpleChipBg.withValues(alpha: 0.35),
      borderColor: AppColors.purpleChipFg.withValues(alpha: 0.18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.purpleChipBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.headphones, color: AppColors.purpleChipFg),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppColors.slate900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 12,
                    height: 1.4,
                    color: AppColors.slate700,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  hasSource
                      ? 'Đã nhận nguồn audio. Trình phát chưa được kết nối trong bản mock.'
                      : 'Chưa có tệp audio trong bộ dữ liệu mẫu.',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.slate500,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          const Icon(
            Icons.play_circle_outline,
            color: AppColors.slate400,
            size: 28,
          ),
        ],
      ),
    );
  }
}

class _ReadingMaterialCard extends StatelessWidget {
  const _ReadingMaterialCard({required this.group, required this.part});

  final TestAttemptGroup group;
  final int part;

  String _formatPassage(String text) {
    if (part != 6) return text;
    return text.replaceAllMapped(
      RegExp(r'\[\[(\d+)\]\]'),
      (match) => '________ (${match.group(1)})',
    );
  }

  @override
  Widget build(BuildContext context) {
    final assets = [...group.assets]
      ..sort((a, b) => a.orderNo.compareTo(b.orderNo));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (group.instruction != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              group.instruction!,
              style: const TextStyle(fontSize: 12, color: AppColors.slate500),
            ),
          ),
        if (group.passageText != null && group.passageText!.trim().isNotEmpty)
          AppCard(
            child: SelectableText(
              _formatPassage(group.passageText!),
              style: const TextStyle(
                fontSize: 14,
                height: 1.6,
                color: AppColors.slate900,
              ),
            ),
          ),
        if (assets.isNotEmpty) ...[
          if (group.passageText != null && group.passageText!.trim().isNotEmpty)
            const SizedBox(height: 10),
          ...assets.map(
            (asset) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ReadingAssetCard(asset: asset),
            ),
          ),
        ],
      ],
    );
  }
}

class _ReadingAssetCard extends StatelessWidget {
  const _ReadingAssetCard({required this.asset});

  final TestAttemptGroupAsset asset;

  @override
  Widget build(BuildContext context) {
    if (asset.kind.toUpperCase() == 'IMAGE' && asset.publicUrl != null) {
      return AppCard(
        padding: EdgeInsets.zero,
        child: Image.network(
          asset.publicUrl!,
          width: double.infinity,
          fit: BoxFit.contain,
          errorBuilder: (_, _, _) => const Padding(
            padding: EdgeInsets.all(16),
            child: Text('Không thể tải hình minh họa.'),
          ),
        ),
      );
    }
    return AppCard(
      child: SelectableText(
        asset.content ?? 'Tài liệu không có nội dung hiển thị.',
        style: const TextStyle(
          fontSize: 13,
          height: 1.55,
          color: AppColors.slate900,
        ),
      ),
    );
  }
}
