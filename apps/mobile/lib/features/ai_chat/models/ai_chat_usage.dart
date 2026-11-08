/// Usage/quota snapshot for the AI Chat feature.
///
/// The current app repository supplies a session-local preview. Production
/// usage must be constructed from the authenticated backend response.
class AiChatUsage {
  const AiChatUsage({
    required this.limit,
    required this.used,
    required this.remaining,
    this.resetAt,
    required this.isAuthoritative,
  }) : assert(limit >= 0),
       assert(used >= 0),
       assert(remaining >= 0);

  final int limit;
  final int used;
  final int remaining;
  final DateTime? resetAt;
  final bool isAuthoritative;

  bool get isExhausted => remaining <= 0;

  factory AiChatUsage.preview({int limit = 20, int used = 3, DateTime? now}) {
    final current = now ?? DateTime.now();
    final resetAt = DateTime(current.year, current.month, current.day + 1);
    final normalizedUsed = used.clamp(0, limit).toInt();

    return AiChatUsage(
      limit: limit,
      used: normalizedUsed,
      remaining: (limit - normalizedUsed).clamp(0, limit).toInt(),
      resetAt: resetAt,
      isAuthoritative: false,
    );
  }

  /// Parses the proposed backend response contract:
  /// `{limit, used, remaining, reset_at}`.
  factory AiChatUsage.fromJson(Map<String, Object?> json) {
    int readInt(String key) {
      final value = json[key];
      if (value is int) return value;
      if (value is num && value == value.toInt()) return value.toInt();
      throw FormatException('Trường "$key" phải là số nguyên.');
    }

    final limit = readInt('limit');
    final used = readInt('used');
    final remaining = readInt('remaining');

    if (limit < 0 ||
        used < 0 ||
        used > limit ||
        remaining < 0 ||
        remaining > limit) {
      throw const FormatException('Dữ liệu hạn mức AI không hợp lệ.');
    }
    if (remaining != limit - used) {
      throw const FormatException(
        'Trường remaining không khớp với limit và used.',
      );
    }

    DateTime? resetAt;
    final rawResetAt = json['reset_at'];
    if (rawResetAt != null) {
      if (rawResetAt is! String) {
        throw const FormatException(
          'Trường "reset_at" phải là chuỗi ISO-8601.',
        );
      }
      resetAt = DateTime.tryParse(rawResetAt);
      if (resetAt == null) {
        throw const FormatException('Thời điểm làm mới hạn mức không hợp lệ.');
      }
    }

    return AiChatUsage(
      limit: limit,
      used: used,
      remaining: remaining,
      resetAt: resetAt,
      isAuthoritative: true,
    );
  }

  AiChatUsage copyWith({
    int? limit,
    int? used,
    int? remaining,
    DateTime? resetAt,
    bool? isAuthoritative,
    bool clearResetAt = false,
  }) {
    return AiChatUsage(
      limit: limit ?? this.limit,
      used: used ?? this.used,
      remaining: remaining ?? this.remaining,
      resetAt: clearResetAt ? null : resetAt ?? this.resetAt,
      isAuthoritative: isAuthoritative ?? this.isAuthoritative,
    );
  }
}
