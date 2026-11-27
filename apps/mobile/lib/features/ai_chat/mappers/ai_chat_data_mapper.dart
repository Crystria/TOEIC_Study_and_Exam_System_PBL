import '../models/ai_chat_context.dart';
import '../models/ai_chat_data_snapshot.dart';
import '../models/ai_chat_usage.dart';
import '../models/ai_conversation.dart';
import '../models/chat_message.dart';

/// Converts AI Chat fixture and persisted JSON into the feature's domain models.
class AiChatDataMapper {
  AiChatDataMapper._();

  static AiChatDataSnapshot fromFixtureJson(Map<String, Object?> json) {
    final rawConversations = json['conversations'];
    if (rawConversations is! List) {
      throw const FormatException('AI Chat fixture thiếu conversations.');
    }

    final conversations = <AiConversation>[];
    final messagesByConversation = <String, List<ChatMessage>>{};
    final now = DateTime.now();

    for (final rawItem in rawConversations) {
      if (rawItem is! Map) {
        throw const FormatException('Conversation fixture không hợp lệ.');
      }
      final item = Map<String, Object?>.from(rawItem);
      final id = _requiredString(item, 'id');
      final updatedAt = _fixtureUpdatedAt(item, now);
      conversations.add(
        AiConversation(
          id: id,
          title: _requiredString(item, 'title'),
          lastMessagePreview: _requiredString(item, 'lastMessagePreview'),
          updatedAt: updatedAt,
          context: _contextFromJson(item['context']),
        ),
      );

      final rawMessages = item['messages'];
      if (rawMessages is! List) {
        throw FormatException('Conversation $id thiếu messages.');
      }
      messagesByConversation[id] = rawMessages.map((rawMessage) {
        if (rawMessage is! Map) {
          throw FormatException('Message fixture trong $id không hợp lệ.');
        }
        final message = Map<String, Object?>.from(rawMessage);
        final role = _enumByName(ChatRole.values, message['role'], 'role');
        final bullets = message['bullets'];
        return ChatMessage(
          id: message['id'] as String?,
          role: role,
          text: _requiredString(message, 'text'),
          bullets: bullets is List
              ? bullets.whereType<String>().toList(growable: false)
              : const <String>[],
          createdAt: _dateTimeOrNull(message['createdAt']),
          status: ChatMessageStatus.sent,
        );
      }).toList();
    }

    return AiChatDataSnapshot(
      conversations: conversations,
      messagesByConversation: messagesByConversation,
      usage: AiChatUsage.preview(),
    );
  }

  static Map<String, Object?> toPersistedJson(AiChatDataSnapshot snapshot) => {
    'version': 1,
    'conversations': snapshot.conversations.map(_conversationToJson).toList(),
    'messagesByConversation': {
      for (final entry in snapshot.messagesByConversation.entries)
        entry.key: entry.value.map(_messageToJson).toList(),
    },
    'usage': {
      'limit': snapshot.usage.limit,
      'used': snapshot.usage.used,
      'remaining': snapshot.usage.remaining,
      'resetAt': snapshot.usage.resetAt?.toIso8601String(),
      'isAuthoritative': snapshot.usage.isAuthoritative,
    },
  };

  static AiChatDataSnapshot fromPersistedJson(Map<String, Object?> json) {
    if (json['version'] != 1) {
      throw const FormatException(
        'Phiên bản lịch sử AI Chat không được hỗ trợ.',
      );
    }
    final rawConversations = json['conversations'];
    final rawMessages = json['messagesByConversation'];
    final rawUsage = json['usage'];
    if (rawConversations is! List || rawMessages is! Map || rawUsage is! Map) {
      throw const FormatException('Snapshot AI Chat không đầy đủ.');
    }

    final conversations = rawConversations.map((raw) {
      if (raw is! Map) {
        throw const FormatException('Conversation đã lưu không hợp lệ.');
      }
      return _conversationFromJson(Map<String, Object?>.from(raw));
    }).toList();

    final messagesByConversation = <String, List<ChatMessage>>{};
    for (final entry in rawMessages.entries) {
      if (entry.key is! String || entry.value is! List) {
        throw const FormatException('Danh sách tin nhắn đã lưu không hợp lệ.');
      }
      messagesByConversation[entry.key as String] = (entry.value as List).map((
        raw,
      ) {
        if (raw is! Map) {
          throw const FormatException('Tin nhắn đã lưu không hợp lệ.');
        }
        return _messageFromJson(Map<String, Object?>.from(raw));
      }).toList();
    }

    final usageJson = Map<String, Object?>.from(rawUsage);
    final limit = _requiredInt(usageJson, 'limit');
    final used = _requiredInt(usageJson, 'used');
    final remaining = _requiredInt(usageJson, 'remaining');
    final resetAt = _dateTimeOrNull(usageJson['resetAt']);
    final isAuthoritative = usageJson['isAuthoritative'] == true;
    if (limit < 0 || used < 0 || used > limit || remaining != limit - used) {
      throw const FormatException('Hạn mức AI Chat đã lưu không hợp lệ.');
    }

    return AiChatDataSnapshot(
      conversations: conversations,
      messagesByConversation: messagesByConversation,
      usage: AiChatUsage(
        limit: limit,
        used: used,
        remaining: remaining,
        resetAt: resetAt,
        isAuthoritative: isAuthoritative,
      ),
    );
  }

  static Map<String, Object?> _conversationToJson(AiConversation value) => {
    'id': value.id,
    'title': value.title,
    'lastMessagePreview': value.lastMessagePreview,
    'updatedAt': value.updatedAt.toIso8601String(),
    'context': _contextToJson(value.context),
  };

  static AiConversation _conversationFromJson(Map<String, Object?> json) =>
      AiConversation(
        id: _requiredString(json, 'id'),
        title: _requiredString(json, 'title'),
        lastMessagePreview: _requiredString(json, 'lastMessagePreview'),
        updatedAt: _requiredDateTime(json, 'updatedAt'),
        context: _contextFromJson(json['context']),
      );

  static Map<String, Object?> _messageToJson(ChatMessage value) => {
    'id': value.id,
    'role': value.role.name,
    'text': value.text,
    'bullets': value.bullets,
    'createdAt': value.createdAt?.toIso8601String(),
    // In-flight UI statuses are never persisted as runtime history.
    'status': value.status == ChatMessageStatus.failed
        ? ChatMessageStatus.failed.name
        : ChatMessageStatus.sent.name,
  };

  static ChatMessage _messageFromJson(Map<String, Object?> json) => ChatMessage(
    id: json['id'] as String?,
    role: _enumByName(ChatRole.values, json['role'], 'role'),
    text: _requiredString(json, 'text'),
    bullets: json['bullets'] is List
        ? (json['bullets'] as List).whereType<String>().toList()
        : const <String>[],
    createdAt: _dateTimeOrNull(json['createdAt']),
    status: _enumByName(
      ChatMessageStatus.values,
      json['status'] ?? ChatMessageStatus.sent.name,
      'status',
    ),
  );

  static Map<String, Object?>? _contextToJson(AiChatContext? context) {
    return switch (context) {
      null => null,
      AiGrammarLessonContext value => {
        'type': value.sourceType,
        'lessonId': value.lessonId,
        'title': value.title,
        'category': value.category,
        'summary': value.summary,
        'content': value.content,
        'keyTakeaway': value.keyTakeaway,
      },
      AiMockTestSummaryContext value => {
        'type': value.sourceType,
        'testId': value.testId,
        'testTitle': value.testTitle,
        'mode': value.mode,
        'parts': value.parts,
        'totalQuestions': value.totalQuestions,
        'answeredCount': value.answeredCount,
        'correctCount': value.correctCount,
        'incorrectCount': value.incorrectCount,
        'unansweredCount': value.unansweredCount,
        'accuracy': value.accuracy,
      },
      AiMockTestQuestionContext value => {
        'type': value.sourceType,
        'testId': value.testId,
        'testTitle': value.testTitle,
        'questionId': value.questionId,
        'part': value.part,
        'questionNumber': value.questionNumber,
        'questionType': value.questionType,
        'questionText': value.questionText,
        'options': value.options
            .map((option) => {'code': option.code, 'text': option.text})
            .toList(),
        'selectedOption': value.selectedOption,
        'correctOption': value.correctOption,
        'explanation': value.explanation,
        'groupInstruction': value.groupInstruction,
        'groupTranscript': value.groupTranscript,
        'groupPassageText': value.groupPassageText,
        'groupAssetContent': value.groupAssetContent,
        'imageDescription': value.imageDescription,
      },
    };
  }

  static AiChatContext? _contextFromJson(Object? raw) {
    if (raw == null) return null;
    if (raw is! Map) {
      throw const FormatException('Ngữ cảnh hội thoại đã lưu không hợp lệ.');
    }
    final json = Map<String, Object?>.from(raw);
    switch (json['type']) {
      case 'grammar_lesson':
        return AiGrammarLessonContext(
          lessonId: _requiredString(json, 'lessonId'),
          title: _requiredString(json, 'title'),
          category: _requiredString(json, 'category'),
          summary: _requiredString(json, 'summary'),
          content: _requiredString(json, 'content'),
          keyTakeaway: _requiredString(json, 'keyTakeaway'),
        );
      case 'mock_test_summary':
        return AiMockTestSummaryContext(
          testId: _requiredString(json, 'testId'),
          testTitle: _requiredString(json, 'testTitle'),
          mode: _requiredString(json, 'mode'),
          parts: _intList(json['parts']),
          totalQuestions: _requiredInt(json, 'totalQuestions'),
          answeredCount: _requiredInt(json, 'answeredCount'),
          correctCount: _requiredInt(json, 'correctCount'),
          incorrectCount: _requiredInt(json, 'incorrectCount'),
          unansweredCount: _requiredInt(json, 'unansweredCount'),
          accuracy: _requiredDouble(json, 'accuracy'),
        );
      case 'mock_test_question':
        final rawOptions = json['options'];
        if (rawOptions is! List) {
          throw const FormatException('Options ngữ cảnh AI không hợp lệ.');
        }
        final options = rawOptions.map((rawOption) {
          if (rawOption is! Map) {
            throw const FormatException('Option ngữ cảnh AI không hợp lệ.');
          }
          final option = Map<String, Object?>.from(rawOption);
          return AiChatContextOption(
            code: _requiredString(option, 'code'),
            text: _requiredString(option, 'text'),
          );
        }).toList();
        return AiMockTestQuestionContext(
          testId: _requiredString(json, 'testId'),
          testTitle: _requiredString(json, 'testTitle'),
          questionId: _requiredString(json, 'questionId'),
          part: _requiredInt(json, 'part'),
          questionNumber: _requiredInt(json, 'questionNumber'),
          questionType: _requiredString(json, 'questionType'),
          questionText: _requiredString(json, 'questionText'),
          options: options,
          selectedOption: json['selectedOption'] as String?,
          correctOption: _requiredString(json, 'correctOption'),
          explanation: json['explanation'] as String?,
          groupInstruction: json['groupInstruction'] as String?,
          groupTranscript: json['groupTranscript'] as String?,
          groupPassageText: json['groupPassageText'] as String?,
          groupAssetContent: json['groupAssetContent'] as String?,
          imageDescription: json['imageDescription'] as String?,
        );
      default:
        throw FormatException(
          'Loại ngữ cảnh AI không được hỗ trợ: ${json['type']}',
        );
    }
  }

  static DateTime _fixtureUpdatedAt(Map<String, Object?> json, DateTime now) {
    if (json['updatedMinutesAgo'] is num) {
      return now.subtract(
        Duration(minutes: (json['updatedMinutesAgo'] as num).toInt()),
      );
    }
    if (json['updatedDaysAgo'] is num) {
      final days = (json['updatedDaysAgo'] as num).toInt();
      final hours = json['updatedHoursAgo'] is num
          ? (json['updatedHoursAgo'] as num).toInt()
          : 0;
      return now.subtract(Duration(days: days, hours: hours));
    }
    throw const FormatException(
      'Fixture conversation thiếu thời điểm cập nhật.',
    );
  }

  static String _requiredString(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is! String || value.trim().isEmpty) {
      throw FormatException('Trường "$key" phải là chuỗi không rỗng.');
    }
    return value;
  }

  static int _requiredInt(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is int) return value;
    if (value is num && value == value.toInt()) return value.toInt();
    throw FormatException('Trường "$key" phải là số nguyên.');
  }

  static double _requiredDouble(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is num) return value.toDouble();
    throw FormatException('Trường "$key" phải là số.');
  }

  static DateTime _requiredDateTime(Map<String, Object?> json, String key) {
    final value = _dateTimeOrNull(json[key]);
    if (value == null) throw FormatException('Trường "$key" thiếu thời điểm.');
    return value;
  }

  static DateTime? _dateTimeOrNull(Object? value) {
    if (value == null) return null;
    if (value is! String) {
      throw const FormatException('Thời điểm AI Chat phải là chuỗi ISO-8601.');
    }
    final result = DateTime.tryParse(value);
    if (result == null)
      throw const FormatException('Thời điểm AI Chat không hợp lệ.');
    return result;
  }

  static T _enumByName<T extends Enum>(
    List<T> values,
    Object? raw,
    String field,
  ) {
    if (raw is String) {
      for (final value in values) {
        if (value.name == raw) return value;
      }
    }
    throw FormatException('Giá trị "$field" không hợp lệ.');
  }

  static List<int> _intList(Object? raw) {
    if (raw is! List) throw const FormatException('Danh sách số không hợp lệ.');
    return raw.map((value) {
      if (value is int) return value;
      if (value is num && value == value.toInt()) return value.toInt();
      throw const FormatException('Phần tử danh sách phải là số nguyên.');
    }).toList();
  }
}
