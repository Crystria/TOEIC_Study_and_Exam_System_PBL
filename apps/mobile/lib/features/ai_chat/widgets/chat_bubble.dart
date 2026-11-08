import 'package:flutter/material.dart';

import '../../../shared/widgets/chip_button.dart';
import '../models/chat_message.dart';
import '../../../theme/app_colors.dart';

class UserChatBubble extends StatelessWidget {
  const UserChatBubble({
    super.key,
    required this.text,
    this.status = ChatMessageStatus.sent,
    this.onRetry,
    this.onEdit,
  });

  final String text;
  final ChatMessageStatus status;
  final VoidCallback? onRetry;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 280),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.brand,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(16),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              text,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                height: 1.4,
              ),
            ),
            if (status == ChatMessageStatus.sending) ...[
              const SizedBox(height: 6),
              const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 11,
                    height: 11,
                    child: CircularProgressIndicator(
                      strokeWidth: 1.5,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(width: 6),
                  Text(
                    'Đang gửi',
                    style: TextStyle(color: Colors.white70, fontSize: 11),
                  ),
                ],
              ),
            ],
            if (status == ChatMessageStatus.failed) ...[
              const SizedBox(height: 5),
              const Text(
                'Không gửi được tin nhắn',
                style: TextStyle(color: Colors.white70, fontSize: 11),
              ),
              if (onRetry != null || onEdit != null) ...[
                const SizedBox(height: 2),
                TextButton.icon(
                  onPressed: onRetry ?? onEdit,
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.white,
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 28),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  icon: Icon(
                    onRetry != null ? Icons.refresh : Icons.edit_outlined,
                    size: 14,
                  ),
                  label: Text(
                    onRetry != null ? 'Gửi lại' : 'Chỉnh sửa',
                    style: const TextStyle(fontSize: 11),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class AssistantChatBubble extends StatelessWidget {
  const AssistantChatBubble({
    super.key,
    required this.text,
    this.bullets = const [],
    this.onExplainMore,
    this.onGiveExample,
  });

  final String text;
  final List<String> bullets;
  final VoidCallback? onExplainMore;
  final VoidCallback? onGiveExample;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 300),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomRight: Radius.circular(16),
          ),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Trợ lý AI',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.brand,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              text,
              style: const TextStyle(
                fontSize: 14,
                height: 1.4,
                color: AppColors.slate900,
              ),
            ),
            if (bullets.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...bullets.map(
                (b) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    '•  $b',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.slate700,
                      height: 1.4,
                    ),
                  ),
                ),
              ),
            ],
            if (onExplainMore != null || onGiveExample != null) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (onExplainMore != null)
                    ChipButton(label: 'Giải thích thêm', onTap: onExplainMore!),
                  if (onGiveExample != null)
                    ChipButton(label: 'Cho ví dụ khác', onTap: onGiveExample!),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
