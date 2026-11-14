import 'dart:async';

import '../../data_sources/local/ai_chat_local_data_source.dart';
import '../../data_sources/test_data/ai_chat_test_data_source.dart';
import '../../mappers/ai_chat_data_mapper.dart';
import '../../models/ai_chat_context.dart';
import '../../models/ai_chat_data_snapshot.dart';
import '../../models/ai_chat_failure.dart';
import '../../models/ai_chat_usage.dart';
import '../../models/ai_conversation.dart';
import '../../models/chat_message.dart';
import '../ai_chat_repository.dart';

/// Development implementation backed by immutable fixtures plus per-user
/// local runtime storage. It is never selected for Staging/Production/release.
class TestDataAiChatRepository implements AiChatRepository {
  TestDataAiChatRepository({
    required AiChatTestDataSource testDataSource,
    required AiChatLocalDataSource localDataSource,
    required String? Function() currentUserId,
  }) : _testData = testDataSource,
       _localData = localDataSource,
       _currentUserId = currentUserId;

  static const String _guestScope = '__guest__';

  final AiChatTestDataSource _testData;
  final AiChatLocalDataSource _localData;
  final String? Function() _currentUserId;

  AiChatDataSnapshot? _state;
  String? _stateUserId;
  int _scopeRevision = 0;
  Future<void>? _loading;
  String? _loadingUserId;
  Future<void> _writeQueue = Future<void>.value();

  @override
  void resetForUserScopeChange() {
    _scopeRevision++;
    _state = null;
    _stateUserId = null;
    _loading = null;
    _loadingUserId = null;
  }

  @override
  Future<AiChatUsage> getUsage() async {
    final scope = _captureScope();
    await _ensureLoaded(scope);
    final state = _requireState(scope);
    final resetAt = state.usage.resetAt;
    if (resetAt != null && !DateTime.now().isBefore(resetAt)) {
      state.usage = AiChatUsage.preview(limit: state.usage.limit, used: 0);
      await _persist(scope);
    }
    return state.usage;
  }

  @override
  Future<List<AiConversation>> getConversations() async {
    final scope = _captureScope();
    await _ensureLoaded(scope);
    final conversations = List<AiConversation>.of(
      _requireState(scope).conversations,
    )..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return List<AiConversation>.unmodifiable(conversations);
  }

  @override
  Future<AiConversation> getConversation(String conversationId) async {
    final scope = _captureScope();
    await _ensureLoaded(scope);
    final conversation = _findConversation(
      _requireState(scope),
      conversationId,
    );
    return conversation;
  }

  @override
  Future<List<ChatMessage>> getMessages(String conversationId) async {
    final scope = _captureScope();
    await _ensureLoaded(scope);
    final state = _requireState(scope);
    final messages = state.messagesByConversation[conversationId];
    if (messages == null ||
        !state.conversations.any(
          (conversation) => conversation.id == conversationId,
        )) {
      throw const AiChatFailure(
        kind: AiChatFailureKind.conversationNotFound,
        message: 'Conversation not found in the current user scope.',
        statusCode: 404,
      );
    }

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

  @override
  Future<AiConversation> createConversation({
    String? title,
    AiChatContext? context,
  }) async {
    final scope = _captureScope();
    await _ensureLoaded(scope);
    final normalizedTitle = title?.trim();
    if (normalizedTitle != null && normalizedTitle.isEmpty) {
      throw ArgumentError('Tiêu đề cuộc trò chuyện không được để trống.');
    }

    final state = _requireState(scope);
    final now = DateTime.now();
    final conversation = AiConversation(
      id: 'ai-conversation-${now.microsecondsSinceEpoch}',
      title: normalizedTitle ?? 'Cuộc trò chuyện mới',
      lastMessagePreview: 'Chưa có tin nhắn',
      updatedAt: now,
      context: context,
    );
    state.conversations.add(conversation);
    state.messagesByConversation[conversation.id] = <ChatMessage>[];
    await _persist(scope);
    return conversation;
  }

  @override
  Future<ChatMessage> sendMessage(
    String conversationId,
    ChatMessage userMessage,
  ) async {
    final scope = _captureScope();
    await _ensureLoaded(scope);
    _ensureScope(scope);

    final state = _requireState(scope);
    if (userMessage.role != ChatRole.user || userMessage.text.trim().isEmpty) {
      throw ArgumentError('Tin nhắn gửi đi không hợp lệ.');
    }
    if (state.usage.isExhausted) {
      throw const AiChatFailure(
        kind: AiChatFailureKind.dailyQuotaExceeded,
        message: 'Daily AI message quota exceeded.',
        statusCode: 429,
      );
    }

    final messages = state.messagesByConversation[conversationId];
    final conversationIndex = state.conversations.indexWhere(
      (conversation) => conversation.id == conversationId,
    );
    if (messages == null || conversationIndex < 0) {
      throw const AiChatFailure(
        kind: AiChatFailureKind.conversationNotFound,
        message: 'Conversation not found in the current user scope.',
        statusCode: 404,
      );
    }

    await Future<void>.delayed(const Duration(milliseconds: 40));
    _ensureScope(scope);

    final now = DateTime.now();
    final persistedUserMessage = userMessage.copyWith(
      status: ChatMessageStatus.sent,
      createdAt: userMessage.createdAt ?? now,
    );
    final assistantMessage = ChatMessage(
      id: 'ai-message-${now.microsecondsSinceEpoch}',
      role: ChatRole.assistant,
      text: _buildMockReply(
        userMessage.text,
        state.conversations[conversationIndex].context,
      ),
      createdAt: now.add(const Duration(microseconds: 1)),
    );

    messages
      ..add(persistedUserMessage)
      ..add(assistantMessage);
    final current = state.conversations[conversationIndex];
    final title = current.title == 'Cuộc trò chuyện mới'
        ? _buildTitle(userMessage.text)
        : current.title;
    state.conversations[conversationIndex] = current.copyWith(
      title: title,
      lastMessagePreview: assistantMessage.text,
      updatedAt: now,
    );
    state.usage = AiChatUsage.preview(
      limit: state.usage.limit,
      used: state.usage.used + 1,
      now: now,
    );

    await _persist(scope);
    return assistantMessage;
  }

  @override
  Future<AiConversation> renameConversation(
    String conversationId,
    String newTitle,
  ) async {
    final scope = _captureScope();
    await _ensureLoaded(scope);
    final normalizedTitle = newTitle.trim();
    if (normalizedTitle.isEmpty) {
      throw ArgumentError('Tiêu đề cuộc trò chuyện không được để trống.');
    }

    final state = _requireState(scope);
    final index = state.conversations.indexWhere(
      (conversation) => conversation.id == conversationId,
    );
    if (index < 0) throw _conversationNotFound();

    final updated = state.conversations[index].copyWith(
      title: normalizedTitle,
      updatedAt: DateTime.now(),
    );
    state.conversations[index] = updated;
    await _persist(scope);
    return updated;
  }

  @override
  Future<void> deleteConversation(String conversationId) async {
    final scope = _captureScope();
    await _ensureLoaded(scope);
    final state = _requireState(scope);
    final index = state.conversations.indexWhere(
      (conversation) => conversation.id == conversationId,
    );
    if (index < 0) throw _conversationNotFound();

    state.conversations.removeAt(index);
    state.messagesByConversation.remove(conversationId);
    await _persist(scope);
  }

  Future<void> _ensureLoaded(_AiChatScope scope) {
    _ensureScope(scope);
    if (_state != null && _stateUserId == scope.userId) {
      return Future<void>.value();
    }
    final pending = _loading;
    if (pending != null && _loadingUserId == scope.userId) return pending;

    final future = _loadForScope(scope);
    _loading = future;
    _loadingUserId = scope.userId;
    return future.whenComplete(() {
      if (identical(_loading, future)) {
        _loading = null;
        _loadingUserId = null;
      }
    });
  }

  Future<void> _loadForScope(_AiChatScope scope) async {
    final persisted = await _localData.readSnapshot(scope.userId);
    _ensureScope(scope);

    final snapshot = persisted == null
        ? await _testData.loadInitialSnapshot()
        : AiChatDataMapper.fromPersistedJson(persisted);
    _ensureScope(scope);
    _state = snapshot;
    _stateUserId = scope.userId;

    if (persisted == null) await _persist(scope);
  }

  AiChatDataSnapshot _requireState(_AiChatScope scope) {
    _ensureScope(scope);
    final state = _state;
    if (state == null || _stateUserId != scope.userId) {
      throw StateError('AI Chat chưa nạp dữ liệu cho tài khoản hiện tại.');
    }
    return state;
  }

  Future<void> _persist(_AiChatScope scope) {
    final state = _requireState(scope);
    final payload = AiChatDataMapper.toPersistedJson(state);
    final completer = Completer<void>();

    _writeQueue = _writeQueue.then((_) async {
      try {
        _ensureScope(scope);
        await _localData.writeSnapshot(scope.userId, payload);
        _ensureScope(scope);
        completer.complete();
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }

  _AiChatScope _captureScope() {
    final currentId = _currentUserId()?.trim();
    return _AiChatScope(
      userId: currentId == null || currentId.isEmpty ? _guestScope : currentId,
      revision: _scopeRevision,
    );
  }

  void _ensureScope(_AiChatScope scope) {
    final currentId = _currentUserId()?.trim();
    final currentScope = currentId == null || currentId.isEmpty
        ? _guestScope
        : currentId;
    if (scope.revision != _scopeRevision || scope.userId != currentScope) {
      throw StateError('Tài khoản đã thay đổi trong lúc xử lý AI Chat.');
    }
  }

  AiConversation _findConversation(AiChatDataSnapshot state, String id) {
    for (final conversation in state.conversations) {
      if (conversation.id == id) return conversation;
    }
    throw _conversationNotFound();
  }

  AiChatFailure _conversationNotFound() => const AiChatFailure(
    kind: AiChatFailureKind.conversationNotFound,
    message: 'Conversation not found in the current user scope.',
    statusCode: 404,
  );

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
        'Đây là phản hồi mô phỏng trong môi trường Development.';
  }
}

class _AiChatScope {
  const _AiChatScope({required this.userId, required this.revision});
  final String userId;
  final int revision;
}
