import 'package:flutter/foundation.dart';

class AiConversationSummary {
  const AiConversationSummary({required this.id, required this.title, required this.timeLabel});
  final String id;
  final String title;
  final String timeLabel;
}

enum HistoryStatus { idle, loading, loaded }

class AiChatHistoryProvider extends ChangeNotifier {
  HistoryStatus status = HistoryStatus.idle;
  List<AiConversationSummary> conversations = [];
  String searchQuery = '';

  List<AiConversationSummary> get filtered => searchQuery.isEmpty
      ? conversations
      : conversations.where((c) => c.title.toLowerCase().contains(searchQuery.toLowerCase())).toList();

  Future<void> loadConversations() async {
    status = HistoryStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 400));
    // TODO: repository.getConversations()
    conversations = const [
      AiConversationSummary(id: 'c1', title: 'Giải từ by / in / during', timeLabel: 'Hôm nay'),
    ];
    status = HistoryStatus.loaded;
    notifyListeners();
  }

  void search(String query) {
    searchQuery = query;
    notifyListeners();
  }
}
