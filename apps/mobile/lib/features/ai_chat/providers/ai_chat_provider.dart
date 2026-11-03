import 'package:flutter/foundation.dart';
import '../models/chat_message.dart';

enum ChatStatus {
  idle,
  loading,
  sending,
  loaded,
  error,
}


class AiChatProvider extends ChangeNotifier {
  ChatStatus status = ChatStatus.idle;

  List<ChatMessage> messages = [];

  int remainingMessages = 20;
  final int dailyLimit = 20;

  String? conversationId;
  String? contextLabel;

  String? errorMessage;

  bool get isLoading => status == ChatStatus.loading;
  bool get isSending => status == ChatStatus.sending;
  bool get hasMessages => messages.isNotEmpty;
  bool get canSend => remainingMessages > 0;

  Future<void> loadConversation(String id) async {
    status = ChatStatus.loading;
    errorMessage = null;
    conversationId = id;

    messages = [];

    notifyListeners();

    try {
      // TODO:
      // final result = await repository.getMessages(id);

      await Future.delayed(
        const Duration(milliseconds: 400),
      );

      messages = const [
        ChatMessage(
          role: ChatRole.user,
          text: 'Tại sao đáp án là "by" mà không phải "in"?',
        ),
        ChatMessage(
          role: ChatRole.assistant,
          text: 'Với mốc thời hạn, TOEIC thường dùng "by".',
        ),
      ];

      status = ChatStatus.loaded;
    } catch (e) {
      errorMessage = e.toString();
      status = ChatStatus.error;
    }

    notifyListeners();
  }

  Future<void> sendFirstMessage(String text) async {
    final content = text.trim();

    if (content.isEmpty || !canSend || isSending) return;

    status = ChatStatus.sending;
    errorMessage = null;

    messages = [
      ChatMessage(
        role: ChatRole.user,
        text: content,
      ),
    ];

    notifyListeners();

    try {
      // TODO:
      // 1. repository.createConversation()
      // 2. Nhận conversationId
      // 3. repository.sendMessage(conversationId, content)

      await Future.delayed(
        const Duration(milliseconds: 600),
      );

      conversationId = 'mock-conversation-id';

      messages = [
        ...messages,
        const ChatMessage(
          role: ChatRole.assistant,
          text: 'Xin chào! Mình có thể giúp bạn giải đáp câu hỏi TOEIC.',
        ),
      ];

      remainingMessages--;

      status = ChatStatus.loaded;
    } catch (e) {
      errorMessage = e.toString();
      status = ChatStatus.error;
    }

    notifyListeners();
  }

  Future<void> sendMessage(String text) async {
    final content = text.trim();

    if (content.isEmpty || !canSend || isSending) return;

    if (conversationId == null) {
      await sendFirstMessage(content);
      return;
    }

    messages = [
      ...messages,
      ChatMessage(
        role: ChatRole.user,
        text: content,
      ),
    ];

    status = ChatStatus.sending;
    errorMessage = null;

    notifyListeners();

    try {
      // TODO:
      // final response = await repository.sendMessage(
      //   conversationId!,
      //   content,
      // );

      await Future.delayed(
        const Duration(milliseconds: 700),
      );

      messages = [
        ...messages,
        const ChatMessage(
          role: ChatRole.assistant,
          text: 'Với mốc thời hạn, TOEIC thường dùng "by".',
        ),
      ];

      remainingMessages--;

      status = ChatStatus.loaded;
    } catch (e) {
      errorMessage = e.toString();
      status = ChatStatus.error;
    }

    notifyListeners();
  }

  Future<void> explainMore() async {
    await sendMessage('Giải thích thêm');
  }

  Future<void> giveExample() async {
    await sendMessage('Cho ví dụ khác');
  }

  void startNewConversation() {
    conversationId = null;
    contextLabel = null;
    messages = [];

    errorMessage = null;
    status = ChatStatus.idle;

    notifyListeners();
  }

  void setContext(String? label) {
    contextLabel = label;
    notifyListeners();
  }
}
