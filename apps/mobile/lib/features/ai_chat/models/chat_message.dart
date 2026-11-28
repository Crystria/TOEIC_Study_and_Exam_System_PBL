enum ChatRole { user, assistant }

enum ChatMessageStatus { sending, sent, failed }

class ChatMessage {
  const ChatMessage({
    required this.role,
    required this.text,
    this.bullets = const [],
    this.id,
    this.createdAt,
    this.status = ChatMessageStatus.sent,
  });

  final String? id;
  final ChatRole role;
  final String text;
  final List<String> bullets;
  final DateTime? createdAt;
  final ChatMessageStatus status;

  ChatMessage copyWith({
    String? id,
    String? text,
    List<String>? bullets,
    DateTime? createdAt,
    ChatMessageStatus? status,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      role: role,
      text: text ?? this.text,
      bullets: bullets ?? this.bullets,
      createdAt: createdAt ?? this.createdAt,
      status: status ?? this.status,
    );
  }
}
