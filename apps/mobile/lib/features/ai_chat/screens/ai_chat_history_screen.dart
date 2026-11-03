import 'package:flutter/material.dart';

import '../widgets/ai_chat_app_bar.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../theme/app_colors.dart';

class AiConversationSummary {
  const AiConversationSummary({required this.title, required this.timeLabel});
  final String title;
  final String timeLabel;
}

class AiChatHistoryScreen extends StatelessWidget {
  const AiChatHistoryScreen({super.key});

  static const int _usedToday = 17;
  static const int _dailyLimit = 20;
  static const List<AiConversationSummary> _conversations = [
    AiConversationSummary(
      title: 'Giải từ by / in / during',
      timeLabel: 'Hôm nay',
    ),
    AiConversationSummary(
      title: 'Phân biệt since vs for',
      timeLabel: 'Hôm qua',
    ),
    AiConversationSummary(title: 'Mệnh đề quan hệ Part 5', timeLabel: '12/10'),
    AiConversationSummary(
      title: 'Từ vựng Office & Business',
      timeLabel: '08/10',
    ),
  ];

  void _onNewConversation(BuildContext context) {}
  void _onOpenConversation(BuildContext context, AiConversationSummary c) {}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: AiChatAppBar(
                title: 'Lịch sử trò chuyện',
                remaining: _usedToday,
                limit: _dailyLimit,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: ElevatedButton.icon(
                onPressed: () => _onNewConversation(context),
                icon: const Icon(Icons.add),
                label: const Text('Cuộc trò chuyện mới'),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                decoration: const InputDecoration(
                  hintText: 'Tìm cuộc trò chuyện…',
                  prefixIcon: Icon(
                    Icons.search,
                    color: AppColors.slate400,
                    size: 20,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _conversations.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final c = _conversations[index];
                  return AppCard(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    child: InkWell(
                      onTap: () => _onOpenConversation(context, c),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              c.title,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.slate900,
                              ),
                            ),
                          ),
                          Text(
                            c.timeLabel,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.slate400,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
