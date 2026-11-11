import '../mock_data/ai_chat_mock_data.dart';
import '../models/ai_chat_context.dart';
import '../models/ai_chat_failure.dart';
import '../models/ai_chat_usage.dart';
import '../models/ai_conversation.dart';
import '../models/chat_message.dart';

/// In-memory data repository for AI Chat.
///
/// Messaging remains mock-backed until the backend prerequisites documented
/// in Step 5.1 are resolved. The public boundary is intentionally shaped so
/// the implementation can later be replaced with API calls.
class AiChatRepository {
  AiChatRepository()
    : _conversations = List<AiConversation>.of(AiChatMockData.conversations),
      _messagesByConversation = {
        for (final entry in AiChatMockData.messagesByConversation.entries)
          entry.key: List<ChatMessage>.of(entry.value),
      };

  final List<AiConversation> _conversations;
  final Map<String, List<ChatMessage>> _messagesByConversation;
  int _scopeRevision = 0;
  int _nextConversationNumber = 1;
  int _nextMessageNumber = 1;
  AiChatUsage _usage = AiChatUsage.preview();

  /// Clears mutable mock conversations and restores the shared demo fixtures.
  /// Conversation data must never survive an account switch in this repository.
  void resetForUserScopeChange() {
    _scopeRevision++;
    _conversations
      ..clear()
      ..addAll(AiChatMockData.conversations);
    _messagesByConversation
      ..clear()
      ..addEntries(
        AiChatMockData.messagesByConversation.entries.map(
          (entry) => MapEntry(entry.key, List<ChatMessage>.of(entry.value)),
        ),
      );
    _nextConversationNumber = 1;
    _nextMessageNumber = 1;
    _usage = AiChatUsage.preview();
  }

  void _ensureScope(int revision) {
    if (revision != _scopeRevision) {
      throw StateError('Tài khoản đã thay đổi trong lúc xử lý AI Chat.');
    }
  }

  Future<AiChatUsage> getUsage() async {
    final revision = _scopeRevision;
    await Future<void>.delayed(const Duration(milliseconds: 100));
    _ensureScope(revision);
    _refreshPreviewUsage();
    return _usage;
  }

  Future<List<AiConversation>> getConversations() async {
    final revision = _scopeRevision;
    await Future<void>.delayed(const Duration(milliseconds: 250));

    _ensureScope(revision);
    final conversations = List<AiConversation>.of(_conversations)
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

    return List<AiConversation>.unmodifiable(conversations);
  }

  Future<AiConversation> getConversation(String conversationId) async {
    final revision = _scopeRevision;
    await Future<void>.delayed(const Duration(milliseconds: 120));
    _ensureScope(revision);

    for (final conversation in _conversations) {
      if (conversation.id == conversationId) return conversation;
    }
    throw StateError('Không tìm thấy cuộc trò chuyện được chọn.');
  }

  Future<List<ChatMessage>> getMessages(String conversationId) async {
    final revision = _scopeRevision;
    await Future<void>.delayed(const Duration(milliseconds: 200));
    _ensureScope(revision);

    final messages = _messagesByConversation[conversationId];
    if (messages == null) {
      throw StateError('Không tìm thấy cuộc trò chuyện được chọn.');
    }

    // Keep fixture messages (which have no timestamp) in their original order.
    // Messages created during this session are ordered by their timestamps.
    final indexed = messages.asMap().entries.toList()
      ..sort((a, b) {
        final aTime =
            a.value.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final bTime =
            b.value.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final comparison = aTime.compareTo(bTime);
        return comparison == 0 ? a.key.compareTo(b.key) : comparison;
      });

    return List<ChatMessage>.unmodifiable(indexed.map((entry) => entry.value));
  }

  Future<AiConversation> createConversation({
    String? title,
    AiChatContext? context,
  }) async {
    final revision = _scopeRevision;
    await Future<void>.delayed(const Duration(milliseconds: 150));
    _ensureScope(revision);

    final normalizedTitle = title?.trim();
    if (normalizedTitle != null && normalizedTitle.isEmpty) {
      throw ArgumentError('Tiêu đề cuộc trò chuyện không được để trống.');
    }

    final id =
        'ai-conversation-${DateTime.now().microsecondsSinceEpoch}-'
        '${_nextConversationNumber++}';
    final conversation = AiConversation(
      id: id,
      title: normalizedTitle ?? 'Cuộc trò chuyện mới',
      lastMessagePreview: 'Chưa có tin nhắn',
      updatedAt: DateTime.now(),
      context: context,
    );

    _conversations.add(conversation);
    _messagesByConversation[id] = <ChatMessage>[];
    return conversation;
  }

  Future<ChatMessage> sendMessage(
    String conversationId,
    ChatMessage userMessage,
  ) async {
    final revision = _scopeRevision;
    await Future<void>.delayed(const Duration(milliseconds: 650));
    _ensureScope(revision);

    _refreshPreviewUsage();
    if (_usage.isExhausted) {
      throw const AiChatFailure(
        kind: AiChatFailureKind.dailyQuotaExceeded,
        message: 'Daily AI message quota exceeded.',
        statusCode: 429,
      );
    }

    final messages = _messagesByConversation[conversationId];
    if (messages == null) {
      throw StateError('Cuộc trò chuyện không còn tồn tại.');
    }
    if (userMessage.role != ChatRole.user || userMessage.text.trim().isEmpty) {
      throw ArgumentError('Tin nhắn gửi đi không hợp lệ.');
    }

    final conversationIndex = _conversations.indexWhere(
      (conversation) => conversation.id == conversationId,
    );
    if (conversationIndex == -1) {
      throw StateError('Cuộc trò chuyện không còn tồn tại.');
    }

    final now = DateTime.now();
    final persistedUserMessage = userMessage.copyWith(
      status: ChatMessageStatus.sent,
      createdAt: userMessage.createdAt ?? now,
    );
    final assistantMessage = ChatMessage(
      id: 'mock-message-${_nextMessageNumber++}',
      role: ChatRole.assistant,
      text: _buildMockReply(
        userMessage.text,
        _conversations[conversationIndex].context,
      ),
      createdAt: now.add(const Duration(microseconds: 1)),
    );

    messages
      ..add(persistedUserMessage)
      ..add(assistantMessage);

    final currentConversation = _conversations[conversationIndex];
    final title = currentConversation.title == 'Cuộc trò chuyện mới'
        ? _buildTitle(userMessage.text)
        : currentConversation.title;
    _conversations[conversationIndex] = currentConversation.copyWith(
      title: title,
      lastMessagePreview: assistantMessage.text,
      updatedAt: now,
    );
    _usage = AiChatUsage.preview(
      limit: _usage.limit,
      used: _usage.used + 1,
      now: now,
    );

    return assistantMessage;
  }

  Future<AiConversation> renameConversation(
    String conversationId,
    String newTitle,
  ) async {
    final revision = _scopeRevision;
    await Future<void>.delayed(const Duration(milliseconds: 150));
    _ensureScope(revision);

    final normalizedTitle = newTitle.trim();
    if (normalizedTitle.isEmpty) {
      throw ArgumentError('Tiêu đề cuộc trò chuyện không được để trống.');
    }

    final index = _conversations.indexWhere(
      (conversation) => conversation.id == conversationId,
    );
    if (index == -1) {
      throw StateError('Cuộc trò chuyện không còn tồn tại.');
    }

    final updated = _conversations[index].copyWith(
      title: normalizedTitle,
      updatedAt: DateTime.now(),
    );
    _conversations[index] = updated;
    return updated;
  }

  Future<void> deleteConversation(String conversationId) async {
    final revision = _scopeRevision;
    await Future<void>.delayed(const Duration(milliseconds: 150));
    _ensureScope(revision);

    final index = _conversations.indexWhere(
      (conversation) => conversation.id == conversationId,
    );
    if (index == -1) {
      throw StateError('Cuộc trò chuyện không còn tồn tại.');
    }

    _conversations.removeAt(index);
    _messagesByConversation.remove(conversationId);
  }

  void _refreshPreviewUsage() {
    final resetAt = _usage.resetAt;
    if (resetAt == null || DateTime.now().isBefore(resetAt)) return;

    _usage = AiChatUsage.preview(limit: _usage.limit, used: 0);
  }

  String _buildTitle(String content) {
    final normalized = content.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (normalized.length <= 40) return normalized;
    return '${normalized.substring(0, 37)}...';
  }

  String _buildMockReply(String content, AiChatContext? context) {
    final normalized = content.toLowerCase();

    final contextPrefix = switch (context) {
      AiGrammarLessonContext(:final title) =>
        'Mình đang tham chiếu bài học "$title". ',
      AiMockTestSummaryContext(:final testTitle) =>
        'Mình đang tham chiếu kết quả bài "$testTitle". ',
      AiMockTestQuestionContext(:final questionNumber, :final part) =>
        'Mình đang tham chiếu câu $questionNumber · Part $part. ',
      null => '',
    };

    if (normalized.contains('since') || normalized.contains('for')) {
      return '$contextPrefix'
          'Since dùng với mốc thời gian bắt đầu; for dùng với khoảng thời gian. '
          '(Phản hồi mô phỏng)';
    }
    if (normalized.contains('by') || normalized.contains('during')) {
      return '$contextPrefix'
          'By thường diễn tả hạn chót (chậm nhất vào thời điểm nào đó), '
          'còn during nhấn mạnh một sự việc diễn ra trong suốt một khoảng thời gian. '
          '(Phản hồi mô phỏng)';
    }
    if (normalized.contains('mệnh đề quan hệ')) {
      return '$contextPrefix'
          'Để làm câu mệnh đề quan hệ trong TOEIC, hãy xác định danh từ được '
          'bổ nghĩa và vai trò của chỗ trống trong mệnh đề. (Phản hồi mô phỏng)';
    }

    return '$contextPrefix'
        'Mình đã nhận được câu hỏi của bạn: "$content". '
        'Đây là phản hồi mô phỏng ở Step 5.5; khi tích hợp backend, '
        'nội dung sẽ được thay bằng phản hồi từ AI service.';
  }
}
