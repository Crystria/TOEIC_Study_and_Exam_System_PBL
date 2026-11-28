import '../models/ai_conversation.dart';
import '../models/chat_message.dart';

/// Local fixtures for the AI Chat feature until backend integration is started.
class AiChatMockData {
  AiChatMockData._();

  static final DateTime _now = DateTime.now();

  static final List<AiConversation> conversations = [
    AiConversation(
      id: 'ai-conversation-001',
      title: 'Giải từ by / in / during',
      lastMessagePreview: 'Với mốc thời hạn, TOEIC thường dùng "by".',
      updatedAt: _now.subtract(const Duration(minutes: 18)),
    ),
    AiConversation(
      id: 'ai-conversation-002',
      title: 'Phân biệt since và for',
      lastMessagePreview:
          'Since đi với mốc thời gian, for đi với khoảng thời gian.',
      updatedAt: _now.subtract(const Duration(days: 1, hours: 2)),
    ),
    AiConversation(
      id: 'ai-conversation-003',
      title: 'Mệnh đề quan hệ Part 5',
      lastMessagePreview:
          'Cần phân biệt đại từ quan hệ làm chủ ngữ và tân ngữ.',
      updatedAt: _now.subtract(const Duration(days: 4)),
    ),
    AiConversation(
      id: 'ai-conversation-004',
      title: 'Từ vựng Office & Business',
      lastMessagePreview:
          'Một số collocation thường gặp trong môi trường văn phòng.',
      updatedAt: _now.subtract(const Duration(days: 12)),
    ),
  ];

  static const Map<String, List<ChatMessage>> messagesByConversation = {
    'ai-conversation-001': [
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
    ],
    'ai-conversation-002': [
      ChatMessage(
        role: ChatRole.user,
        text: 'Phân biệt since và for như thế nào?',
      ),
      ChatMessage(
        role: ChatRole.assistant,
        text: 'Since dùng với mốc bắt đầu; for dùng với khoảng thời gian.',
        bullets: [
          'since Monday: kể từ thứ Hai',
          'for two weeks: trong hai tuần',
        ],
      ),
    ],
    'ai-conversation-003': [
      ChatMessage(
        role: ChatRole.user,
        text: 'Mệnh đề quan hệ thường xuất hiện thế nào trong Part 5?',
      ),
      ChatMessage(
        role: ChatRole.assistant,
        text: 'Hãy xác định danh từ đứng trước chỗ trống và vai trò ngữ pháp của chỗ trống.',
        bullets: [
          'who / that: thường thay thế người làm chủ ngữ',
          'which / that: thường thay thế vật',
          'whose: thể hiện quan hệ sở hữu',
        ],
      ),
    ],
    'ai-conversation-004': [
      ChatMessage(
        role: ChatRole.user,
        text: 'Cho tôi một số từ vựng Office & Business thường gặp.',
      ),
      ChatMessage(
        role: ChatRole.assistant,
        text: 'Một số từ thường gặp gồm appointment, assignment, department và colleague.',
        bullets: [
          'schedule an appointment: lên lịch cuộc hẹn',
          'complete an assignment: hoàn thành nhiệm vụ',
        ],
      ),
    ],
  };
}
