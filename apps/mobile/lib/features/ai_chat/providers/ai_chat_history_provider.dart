import 'package:flutter/foundation.dart';

import '../models/ai_chat_failure.dart';
import '../models/ai_conversation.dart';
import '../repositories/ai_chat_repository.dart';

enum HistoryStatus { idle, loading, loaded, error }

class AiChatHistoryProvider extends ChangeNotifier {
  AiChatHistoryProvider({required AiChatRepository repository})
    : _repository = repository;

  final AiChatRepository _repository;
  final List<AiConversation> _conversations = [];
  final Set<String> _busyConversationIds = <String>{};

  HistoryStatus status = HistoryStatus.idle;
  String searchQuery = '';
  String? errorMessage;
  String? operationErrorMessage;
  AiChatFailure? failure;
  AiChatFailure? operationFailure;
  bool isCreating = false;
  int _requestId = 0;

  List<AiConversation> get conversations =>
      List<AiConversation>.unmodifiable(_conversations);

  List<AiConversation> get filteredConversations {
    final query = searchQuery.trim().toLowerCase();
    if (query.isEmpty) return conversations;

    return List<AiConversation>.unmodifiable(
      _conversations.where((conversation) {
        return conversation.title.toLowerCase().contains(query);
      }),
    );
  }

  bool get hasConversations => _conversations.isNotEmpty;
  bool get isLoading => status == HistoryStatus.loading;
  bool get isInitialLoading =>
      status == HistoryStatus.idle || (isLoading && !hasConversations);
  bool get hasSearchResults => filteredConversations.isNotEmpty;

  bool isConversationBusy(String conversationId) =>
      _busyConversationIds.contains(conversationId);

  Future<void> loadConversations({bool forceRefresh = false}) async {
    if (isLoading) return;
    if (status == HistoryStatus.loaded && !forceRefresh) return;

    final requestId = ++_requestId;
    status = HistoryStatus.loading;
    errorMessage = null;
    failure = null;
    notifyListeners();

    try {
      final result = await _repository.getConversations();
      if (requestId != _requestId) return;

      _replaceConversations(result);
      status = HistoryStatus.loaded;
    } catch (error) {
      if (requestId != _requestId) return;
      failure = AiChatFailure.from(error);
      errorMessage = failure!.userMessage;
      status = HistoryStatus.error;
    }

    notifyListeners();
  }

  Future<AiConversation?> createConversation({String? title}) async {
    if (isCreating) return null;

    isCreating = true;
    operationErrorMessage = null;
    operationFailure = null;
    errorMessage = null;
    final requestId = ++_requestId;
    notifyListeners();

    try {
      final created = await _repository.createConversation(title: title);
      final result = await _repository.getConversations();
      if (requestId == _requestId) {
        _replaceConversations(result);
        status = HistoryStatus.loaded;
      }
      return created;
    } catch (error) {
      operationFailure = AiChatFailure.from(error);
      operationErrorMessage = operationFailure!.userMessage;
      await _recoverAfterMutationFailure();
      return null;
    } finally {
      isCreating = false;
      notifyListeners();
    }
  }

  Future<bool> renameConversation(
    String conversationId,
    String newTitle,
  ) async {
    final normalizedTitle = newTitle.trim();
    if (normalizedTitle.isEmpty) {
      operationErrorMessage = 'Tiêu đề cuộc trò chuyện không được để trống.';
      notifyListeners();
      return false;
    }
    if (!_beginConversationOperation(conversationId)) return false;

    try {
      await _repository.renameConversation(conversationId, normalizedTitle);
      await _synchronizeAfterMutation();
      return true;
    } catch (error) {
      operationFailure = AiChatFailure.from(error);
      operationErrorMessage = operationFailure!.userMessage;
      await _recoverAfterMutationFailure();
      return false;
    } finally {
      _finishConversationOperation(conversationId);
    }
  }

  Future<bool> deleteConversation(String conversationId) async {
    if (!_beginConversationOperation(conversationId)) return false;

    try {
      await _repository.deleteConversation(conversationId);
      await _synchronizeAfterMutation();
      return true;
    } catch (error) {
      operationFailure = AiChatFailure.from(error);
      operationErrorMessage = operationFailure!.userMessage;
      await _recoverAfterMutationFailure();
      return false;
    } finally {
      _finishConversationOperation(conversationId);
    }
  }

  Future<void> _synchronizeAfterMutation() async {
    final requestId = ++_requestId;
    final result = await _repository.getConversations();
    if (requestId != _requestId) return;

    _replaceConversations(result);
    status = HistoryStatus.loaded;
    errorMessage = null;
    failure = null;
  }

  Future<void> _recoverAfterMutationFailure() async {
    final requestId = ++_requestId;
    try {
      final result = await _repository.getConversations();
      if (requestId != _requestId) return;
      _replaceConversations(result);
      status = HistoryStatus.loaded;
      errorMessage = null;
      failure = null;
    } catch (error) {
      if (requestId != _requestId) return;
      status = HistoryStatus.error;
      failure = AiChatFailure.from(error);
      errorMessage = failure!.userMessage;
    }
  }

  bool _beginConversationOperation(String conversationId) {
    if (_busyConversationIds.contains(conversationId)) return false;

    operationErrorMessage = null;
    operationFailure = null;
    _busyConversationIds.add(conversationId);
    _requestId++;
    notifyListeners();
    return true;
  }

  void _finishConversationOperation(String conversationId) {
    _busyConversationIds.remove(conversationId);
    notifyListeners();
  }

  void _replaceConversations(List<AiConversation> conversations) {
    _conversations
      ..clear()
      ..addAll(conversations);
  }

  void search(String query) {
    if (searchQuery == query) return;
    searchQuery = query;
    notifyListeners();
  }

  void clearOperationError() {
    if (operationErrorMessage == null && operationFailure == null) return;
    operationErrorMessage = null;
    operationFailure = null;
    notifyListeners();
  }
}
