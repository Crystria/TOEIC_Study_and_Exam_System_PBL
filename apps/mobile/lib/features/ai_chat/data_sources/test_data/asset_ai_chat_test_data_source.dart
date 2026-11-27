import 'dart:convert';

import 'package:flutter/services.dart';

import '../../mappers/ai_chat_data_mapper.dart';
import '../../models/ai_chat_data_snapshot.dart';
import 'ai_chat_test_data_source.dart';

/// Loads the Development conversation seed from the repository's test_data.
class AssetAiChatTestDataSource implements AiChatTestDataSource {
  AssetAiChatTestDataSource({AssetBundle? bundle})
    : _bundle = bundle ?? rootBundle;

  static const String assetPath =
      'test_data/ai_chat/conversations_and_messages_current_source.json';

  final AssetBundle _bundle;

  @override
  Future<AiChatDataSnapshot> loadInitialSnapshot() async {
    final raw = await _bundle.loadString(assetPath);
    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      throw const FormatException('AI Chat fixture phải là JSON object.');
    }
    return AiChatDataMapper.fromFixtureJson(Map<String, Object?>.from(decoded));
  }
}
