// ignore_for_file: prefer_initializing_formals
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/ai_chat_context.dart';
import '../models/ai_chat_failure.dart';
import '../models/ai_chat_usage.dart';
import '../models/chat_message.dart';
import '../repositories/ai_chat_repository.dart';

enum ChatStatus { idle, loading, sending, loaded, error }

enum UsageStatus { idle, loading, loaded, error }

class AiChatProvider extends ChangeNotifier {
  AiChatProvider({required AiChatRepository repository})
    : _repository = repository;

  final AiChatRepository _repository;
  int _loadRequestId = 0;
  int _usageRequestId = 0;
  int _nextLocalMessageId = 1;
  Timer? _retryTimer;
  DateTime? _retryAvailableAt;
  bool _disposed = false;

  ChatStatus status = ChatStatus.idle;
  UsageStatus usageStatus = UsageStatus.idle;
  List<ChatMessage> messages = [];

  AiChatUsage usage = AiChatUsage.preview();
  AiChatFailure? failure;
  AiChatFailure? usageFailure;
  String? errorMessage;

  String? conversationId;
  AiChatContext? activeContext;

  String? get contextLabel => activeContext?.displayLabel;
  int get remainingMessages => usage.remaining;
  int get dailyLimit => usage.limit;
  bool get isUsageLoading => usageStatus == UsageStatus.loading;
  bool get usageIsPreview => !usage.isAuthoritative;
  bool get isQuotaBlocked =>
      usage.isExhausted ||
      failure?.kind == AiChatFailureKind.dailyQuotaExceeded;

  bool get isLoading => status == ChatStatus.loading;
  bool get isSending => status == ChatStatus.sending;
  bool get hasMessages => messages.isNotEmpty;
  bool get hasFailedMessage => messages.any(
    (message) =>
        message.role == ChatRole.user &&
        message.status == ChatMessageStatus.failed,
  );

  bool get canRetryLastMessage {
    if (isSending || usageStatus != UsageStatus.loaded || usage.isExhausted) {
      return false;
    }
    final currentFailure = failure;
    if (currentFailure == null || !currentFailure.isRetryable) return false;
    final retryAvailableAt = _retryAvailableAt;
    if (retryAvailableAt != null && DateTime.now().isBefore(retryAvailableAt)) {
      return false;
    }
    return messages.any(
      (message) =>
          message.role == ChatRole.user &&
          message.status == ChatMessageStatus.failed,
    );
  }

  bool get canSend =>
      usage.remaining > 0 &&
      !isSending &&
      usageStatus == UsageStatus.loaded &&
      !(failure?.blocksSending ?? false) &&
      !(hasFailedMessage && (failure?.isRetryable ?? false));

  Future<void> loadUsage({bool forceRefresh = false}) async {
    if (isUsageLoading && !forceRefresh) return;

    final requestId = ++_usageRequestId;
    usageStatus = UsageStatus.loading;
    usageFailure = null;
    notifyListeners();

    try {
      final result = await _repository.getUsage();
      if (requestId != _usageRequestId) return;

      usage = result;
      usageStatus = UsageStatus.loaded;
      usageFailure = null;

      // A fresh authoritative quota snapshot may unblock a request after the
      // previous daily-quota response, for example after the reset boundary.
      if (usage.remaining > 0 &&
          failure?.kind == AiChatFailureKind.dailyQuotaExceeded) {
        _clearFailure();
        errorMessage = null;
        if (status == ChatStatus.error) {
          status = ChatStatus.loaded;
        }
      }
    } catch (error) {
      if (requestId != _usageRequestId) return;
      usageFailure = AiChatFailure.from(error);
      usageStatus = UsageStatus.error;
    }

    notifyListeners();
  }

  Future<void> loadConversation(String id) async {
    final requestId = ++_loadRequestId;
    status = ChatStatus.loading;
    errorMessage = null;
    _clearFailure();
    conversationId = id;
    activeContext = null;
    messages = [];
    notifyListeners();

    try {
      final conversation = await _repository.getConversation(id);
      if (requestId != _loadRequestId) return;

      final result = await _repository.getMessages(id);
      if (requestId != _loadRequestId) return;

      activeContext = conversation.context;
      messages = List<ChatMessage>.of(result);
      status = ChatStatus.loaded;
    } catch (error) {
      if (requestId != _loadRequestId) return;
      failure = AiChatFailure.from(error);
      errorMessage = failure!.userMessage;
      status = ChatStatus.error;
    }

    notifyListeners();
  }

  /// Adds the user message optimistically, then asks the repository to send it.
  /// Usage is refreshed only after a successful assistant response.
  Future<bool> sendMessage(String text) async {
    final content = text.trim();
    if (content.isEmpty || !canSend) return false;

    final requestId = _loadRequestId;
    final userMessage = ChatMessage(
      id: 'local-message-${_nextLocalMessageId++}',
      role: ChatRole.user,
      text: content,
      createdAt: DateTime.now(),
      status: ChatMessageStatus.sending,
    );

    messages = [...messages, userMessage];
    status = ChatStatus.sending;
    _clearFailure();
    errorMessage = null;
    notifyListeners();

    try {
      var targetConversationId = conversationId;
      if (targetConversationId == null) {
        final created = await _repository.createConversation(
          context: activeContext,
        );
        if (requestId != _loadRequestId) {
          await _repository.deleteConversation(created.id);
          return false;
        }
        targetConversationId = created.id;
        conversationId = targetConversationId;
        activeContext = created.context;
      }

      final assistantMessage = await _repository.sendMessage(
        targetConversationId,
        userMessage,
      );
      if (requestId != _loadRequestId ||
          conversationId != targetConversationId) {
        return false;
      }

      _replaceMessageStatus(userMessage.id, ChatMessageStatus.sent);
      messages = [...messages, assistantMessage];
      status = ChatStatus.loaded;
      _clearFailure();
      errorMessage = null;
      notifyListeners();
      await _refreshUsageAfterSuccessfulSend();
      return true;
    } catch (error) {
      if (requestId != _loadRequestId) return false;

      _setFailure(error);
      _replaceMessageStatus(userMessage.id, ChatMessageStatus.failed);
      errorMessage = failure!.userMessage;
      status = ChatStatus.error;
      notifyListeners();
      return false;
    }
  }

  /// Retries the most recent failed message without appending a duplicate.
  Future<bool> retryLastMessage() async {
    if (!canRetryLastMessage) return false;

    final failedIndex = messages.lastIndexWhere(
      (message) =>
          message.role == ChatRole.user &&
          message.status == ChatMessageStatus.failed,
    );
    if (failedIndex == -1) return false;

    final requestId = _loadRequestId;
    final failedMessage = messages[failedIndex];
    _replaceMessageStatus(failedMessage.id, ChatMessageStatus.sending);
    status = ChatStatus.sending;
    _clearFailure();
    errorMessage = null;
    notifyListeners();

    try {
      var targetConversationId = conversationId;
      if (targetConversationId == null) {
        final created = await _repository.createConversation(
          context: activeContext,
        );
        if (requestId != _loadRequestId) {
          await _repository.deleteConversation(created.id);
          return false;
        }
        targetConversationId = created.id;
        conversationId = targetConversationId;
      }

      final assistantMessage = await _repository.sendMessage(
        targetConversationId,
        failedMessage,
      );
      if (requestId != _loadRequestId ||
          conversationId != targetConversationId) {
        return false;
      }

      _replaceMessageStatus(failedMessage.id, ChatMessageStatus.sent);
      messages = [...messages, assistantMessage];
      status = ChatStatus.loaded;
      _clearFailure();
      errorMessage = null;
      notifyListeners();
      await _refreshUsageAfterSuccessfulSend();
      return true;
    } catch (error) {
      if (requestId != _loadRequestId) return false;

      _setFailure(error);
      _replaceMessageStatus(failedMessage.id, ChatMessageStatus.failed);
      errorMessage = failure!.userMessage;
      status = ChatStatus.error;
      notifyListeners();
      return false;
    }
  }

  Future<void> _refreshUsageAfterSuccessfulSend() async {
    final requestId = ++_usageRequestId;
    usageStatus = UsageStatus.loading;
    usageFailure = null;
    notifyListeners();

    try {
      final result = await _repository.getUsage();
      if (requestId != _usageRequestId) return;
      usage = result;
      usageStatus = UsageStatus.loaded;
      usageFailure = null;
    } catch (error) {
      if (requestId != _usageRequestId) return;
      usageFailure = AiChatFailure.from(error);
      usageStatus = UsageStatus.error;
    }

    notifyListeners();
  }

  void _setFailure(Object error) {
    final nextFailure = AiChatFailure.from(error);
    failure = nextFailure;
    _retryTimer?.cancel();
    _retryAvailableAt = null;

    final retryAfterSeconds = nextFailure.retryAfterSeconds;
    if (nextFailure.kind == AiChatFailureKind.rateLimited &&
        retryAfterSeconds != null &&
        retryAfterSeconds > 0) {
      _retryAvailableAt = DateTime.now().add(
        Duration(seconds: retryAfterSeconds),
      );
      _retryTimer = Timer(Duration(seconds: retryAfterSeconds), () {
        if (!_disposed) notifyListeners();
      });
    }
  }

  void _clearFailure() {
    _retryTimer?.cancel();
    _retryTimer = null;
    _retryAvailableAt = null;
    failure = null;
  }

  Future<void> sendFirstMessage(String text) async {
    await sendMessage(text);
  }

  Future<void> explainMore() async {
    await sendMessage('Giải thích thêm');
  }

  Future<void> giveExample() async {
    await sendMessage('Cho ví dụ khác');
  }

  void _replaceMessageStatus(String? messageId, ChatMessageStatus nextStatus) {
    if (messageId == null) return;
    final index = messages.indexWhere((message) => message.id == messageId);
    if (index == -1) return;

    final updated = List<ChatMessage>.of(messages);
    updated[index] = updated[index].copyWith(status: nextStatus);
    messages = updated;
  }

  /// Clears the active chat after its conversation is deleted.
  void clearConversation() {
    _loadRequestId++;
    conversationId = null;
    activeContext = null;
    messages = [];
    _clearFailure();
    errorMessage = null;
    status = ChatStatus.idle;
    notifyListeners();
  }

  /// Invalidates in-flight chat work and drops all account-specific chat state.
  void resetForUserScopeChange() {
    _loadRequestId++;
    _usageRequestId++;
    _nextLocalMessageId = 1;
    _retryTimer?.cancel();
    _retryTimer = null;
    _retryAvailableAt = null;
    status = ChatStatus.idle;
    usageStatus = UsageStatus.idle;
    messages = [];
    usage = AiChatUsage.preview();
    failure = null;
    usageFailure = null;
    errorMessage = null;
    conversationId = null;
    activeContext = null;
    notifyListeners();
  }

  /// Starts a clean chat with a typed Learning/Mock Test context.
  void startContextualConversation(AiChatContext context) {
    _loadRequestId++;
    conversationId = null;
    activeContext = context;
    messages = [];
    _clearFailure();
    errorMessage = null;
    status = ChatStatus.idle;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _retryTimer?.cancel();
    super.dispose();
  }
}
