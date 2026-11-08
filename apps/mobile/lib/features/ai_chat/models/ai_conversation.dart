import 'ai_chat_context.dart';

/// A conversation summary used by the in-app AI Chat history.
///
/// This model is intentionally independent of backend DTOs. The current
/// feature implementation uses local in-memory data.
class AiConversation {
  const AiConversation({
    required this.id,
    required this.title,
    required this.lastMessagePreview,
    required this.updatedAt,
    this.context,
  });

  final String id;
  final String title;
  final String lastMessagePreview;
  final DateTime updatedAt;
  final AiChatContext? context;

  AiConversation copyWith({
    String? title,
    String? lastMessagePreview,
    DateTime? updatedAt,
    AiChatContext? context,
    bool clearContext = false,
  }) {
    return AiConversation(
      id: id,
      title: title ?? this.title,
      lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
      updatedAt: updatedAt ?? this.updatedAt,
      context: clearContext ? null : context ?? this.context,
    );
  }

  String get timeLabel {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final date = DateTime(updatedAt.year, updatedAt.month, updatedAt.day);
    final difference = today.difference(date).inDays;

    if (difference == 0) return 'Hôm nay';
    if (difference == 1) return 'Hôm qua';

    final day = updatedAt.day.toString().padLeft(2, '0');
    final month = updatedAt.month.toString().padLeft(2, '0');
    if (updatedAt.year == now.year) return '$day/$month';
    return '$day/$month/${updatedAt.year}';
  }
}
