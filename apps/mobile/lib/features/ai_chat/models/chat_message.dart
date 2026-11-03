enum ChatRole {
  user,
  assistant,
}

class ChatMessage {
  const ChatMessage({
    required this.role,
    required this.text,
    this.bullets = const [],
  });

  final ChatRole role;
  final String text;
  final List<String> bullets;
}
