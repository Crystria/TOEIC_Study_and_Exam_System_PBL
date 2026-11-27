import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/ai_chat/data_sources/test_data/asset_ai_chat_test_data_source.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'AI Chat Test Data source loads seed history from JSON fixture',
    () async {
      final snapshot = await AssetAiChatTestDataSource().loadInitialSnapshot();

      expect(snapshot.conversations, hasLength(4));
      expect(
        snapshot.messagesByConversation['ai-conversation-001'],
        hasLength(2),
      );
      expect(snapshot.usage.isAuthoritative, isFalse);
    },
  );
}
