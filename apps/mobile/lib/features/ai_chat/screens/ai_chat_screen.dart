import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:toeic_mobile/features/ai_chat/screens/ai_chat_history_screen.dart';

import '../providers/ai_chat_provider.dart';
import '../widgets/ai_chat_app_bar.dart';
import '../widgets/chat_bubble.dart';

import '../../../shared/widgets/chip_button.dart';
import '../../../shared/widgets/icon_badge_circle.dart';
import '../../../theme/app_colors.dart';

import '../models/chat_message.dart';

class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  final TextEditingController _inputController = TextEditingController();

  final ScrollController _scrollController = ScrollController();

  static const int _remainingMessages = 17;
  static const int _dailyLimit = 20;

  static const String _contextLabel = 'Đang hỏi về: Câu 12 · Part 5';

  static const List<String> _suggestions = [
    'Phân biệt since vs for',
    'Giải thích mệnh đề quan hệ',
    'Mẹo làm Part 5 nhanh',
    'Từ vựng Office & Business',
  ];

  // Danh sách tin nhắn của cuộc hội thoại hiện tại.
  final List<ChatMessage> _messages = [
    ChatMessage(
      role: ChatRole.user,
      text: 'Tại sao đáp án là "by" mà không phải "in"?',
    ),
    ChatMessage(
      role: ChatRole.assistant,
      text: 'Với mốc thời hạn, TOEIC thường dùng "by" nghĩa là chậm nhất vào.',
      bullets: [
        'by + thời điểm: hạn chót',
        'during + danh từ: trong suốt một khoảng',
        'since + mốc: kể từ khi',
      ],
    ),
  ];

  bool get _hasMessages => _messages.isNotEmpty;

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onNewConversation() {
    context.read<AiChatProvider>().startNewConversation();
    _inputController.clear();
  }

  void _onConversationList() {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const AiChatHistoryScreen()));
  }

  void _onSuggestion(String text) {
    _inputController.text = text;
  }

  void _onSend() {
    final text = _inputController.text.trim();
    if (text.isEmpty) return;

    final provider = context.read<AiChatProvider>();
    if (provider.conversationId == null) {
      provider.sendFirstMessage(text);
    } else {
      provider.sendMessage(text);
    }

    _inputController.clear();
    _scrollToBottom();

    // TODO: Gọi AI Chat API tại đây.
  }

  // Cuộn xuống tin nhắn mới nhất.
  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;

      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  void _onExplainMore() {
    // TODO: Yêu cầu AI giải thích chi tiết hơn.
  }

  void _onGiveExample() {
    // TODO: Yêu cầu AI đưa ra ví dụ.
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: AiChatAppBar(
                title: 'Trợ lý AI TOEIC',
                remaining: _remainingMessages,
                limit: _dailyLimit,
                onHistory: _onConversationList,
                onNewConversation: _onNewConversation,
              ),
            ),

            // Context label
            if (_hasMessages && _contextLabel.isNotEmpty)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.slate50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Row(
                  children: [
                    Icon(
                      Icons.push_pin_outlined,
                      size: 14,
                      color: AppColors.slate400,
                    ),
                    SizedBox(width: 6),
                    Text(
                      _contextLabel,
                      style: TextStyle(fontSize: 12, color: AppColors.slate500),
                    ),
                  ],
                ),
              ),

            // Main content
            Expanded(
              child: _hasMessages ? _buildConversation() : _buildEmptyState(),
            ),

            // Input
            _buildInput(),
          ],
        ),
      ),
    );
  }

  // Empty state: chưa có tin nhắn.
  Widget _buildEmptyState() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const IconBadgeCircle(icon: Icons.auto_awesome),

            const SizedBox(height: 16),

            const Text(
              'Xin chào! Mình là trợ lý AI TOEIC',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.slate900,
              ),
            ),

            const SizedBox(height: 4),

            const Text(
              'Hỏi mình về ngữ pháp, từ vựng hoặc câu hỏi bạn đang quan tâm.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.slate500),
            ),

            const SizedBox(height: 20),

            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: _suggestions.map((suggestion) {
                return ChipButton(
                  label: suggestion,
                  onTap: () => _onSuggestion(suggestion),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  // Conversation: hiển thị tin nhắn.
  Widget _buildConversation() {
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.all(16),
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final msg = _messages[index];

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: msg.role == ChatRole.user
              ? UserChatBubble(text: msg.text)
              : AssistantChatBubble(
                  text: msg.text,
                  bullets: msg.bullets,
                  onExplainMore: _onExplainMore,
                  onGiveExample: _onGiveExample,
                ),
        );
      },
    );
  }

  // Input dùng chung cho cả hai trạng thái.
  Widget _buildInput() {
    return Container(
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
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _onSend(),
              decoration: const InputDecoration(
                hintText: 'Nhập câu hỏi (tối đa 1000 ký tự)',
                counterText: '',
              ),
            ),
          ),

          const SizedBox(width: 8),

          IconButton.filled(
            style: IconButton.styleFrom(backgroundColor: AppColors.brand),
            onPressed: _onSend,
            icon: const Icon(Icons.arrow_forward, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
