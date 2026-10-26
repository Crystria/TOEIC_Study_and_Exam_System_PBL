import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

enum ChatRole { user, assistant }

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

class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  final _inputController = TextEditingController();

  // TODO: lấy lịch sử từ GET /ai/conversations/:id/messages
  static const int _remainingMessages = 17;
  static const int _dailyLimit = 20;
  static const String _contextLabel = 'Đang hỏi về: Câu 12 · Part 5';

  final List<ChatMessage> _messages = const [
    ChatMessage(
      role: ChatRole.user,
      text: 'Tại sao đáp án là "by" mà không phải "in"?',
    ),
    ChatMessage(
      role: ChatRole.assistant,
      text:
      'Với mốc thời hạn, TOEIC thường dùng "by" nghĩa là chậm nhất vào.',
      bullets: [
        'by + thời điểm: hạn chót',
        'during + danh từ: trong suốt một khoảng',
        'since + mốc: kể từ khi',
      ],
    ),
  ];

  @override
  void dispose() {
    _inputController.dispose();
    super.dispose();
  }

  // TODO: gọi POST /ai/conversations/:id/messages
  void _onSend() {}

  void _onExplainMore() {}
  void _onGiveExample() {}
  void _onNewConversation() {}
  void _onConversationList() {}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Trợ lý AI TOEIC',
                      style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.slate900),
                    ),
                  ),
                  Container(
                    padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.blueChipBg,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      'Còn $_remainingMessages/$_dailyLimit lượt',
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.blueChipFg),
                    ),
                  ),
                  IconButton(
                    onPressed: _onConversationList,
                    icon: const Icon(Icons.list_alt_outlined,
                        color: AppColors.slate500),
                  ),
                  IconButton(
                    onPressed: _onNewConversation,
                    icon: const Icon(Icons.add, color: AppColors.slate500),
                  ),
                ],
              ),
            ),
            if (_contextLabel.isNotEmpty)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.slate50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.push_pin_outlined,
                        size: 14, color: AppColors.slate400),
                    SizedBox(width: 6),
                    Text(
                      _contextLabel,
                      style: TextStyle(fontSize: 12, color: AppColors.slate500),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _messages.length,
                itemBuilder: (context, index) {
                  final msg = _messages[index];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: msg.role == ChatRole.user
                        ? _UserBubble(text: msg.text)
                        : _AssistantBubble(
                      text: msg.text,
                      bullets: msg.bullets,
                      onExplainMore: _onExplainMore,
                      onGiveExample: _onGiveExample,
                    ),
                  );
                },
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _inputController,
                      maxLength: 1000,
                      decoration: const InputDecoration(
                        hintText: 'Nhập câu hỏi (tối đa 1000 ký tự)',
                        counterText: '',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.brand,
                    ),
                    onPressed: _onSend,
                    icon: const Icon(Icons.arrow_forward, color: Colors.white),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.text});
  final String text;

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
        child: Text(
          text,
          style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.4),
        ),
      ),
    );
  }
}

class _AssistantBubble extends StatelessWidget {
  const _AssistantBubble({
    required this.text,
    required this.bullets,
    required this.onExplainMore,
    required this.onGiveExample,
  });

  final String text;
  final List<String> bullets;
  final VoidCallback onExplainMore;
  final VoidCallback onGiveExample;

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
                  color: AppColors.brand),
            ),
            const SizedBox(height: 6),
            Text(
              text,
              style: const TextStyle(
                  fontSize: 14, height: 1.4, color: AppColors.slate900),
            ),
            if (bullets.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...bullets.map(
                    (b) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    '•  $b',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.slate700, height: 1.4),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _ChipButton(label: 'Giải thích thêm', onTap: onExplainMore),
                _ChipButton(label: 'Cho ví dụ khác', onTap: onGiveExample),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ChipButton extends StatelessWidget {
  const _ChipButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.slate50,
      borderRadius: BorderRadius.circular(99),
      child: InkWell(
        borderRadius: BorderRadius.circular(99),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: Text(
            label,
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.slate700),
          ),
        ),
      ),
    );
  }
}
