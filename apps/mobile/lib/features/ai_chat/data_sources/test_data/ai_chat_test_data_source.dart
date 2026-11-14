import '../../models/ai_chat_data_snapshot.dart';

/// Reads immutable seed fixtures for the Development AI Chat repository.
abstract interface class AiChatTestDataSource {
  Future<AiChatDataSnapshot> loadInitialSnapshot();
}
