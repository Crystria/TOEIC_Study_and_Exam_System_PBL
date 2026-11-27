class TestAttemptGroupAsset {
  const TestAttemptGroupAsset({
    required this.assetId,
    required this.kind,
    required this.orderNo,
    this.content,
    this.publicUrl,
  });

  final String assetId;
  final String kind;
  final int orderNo;
  final String? content;
  final String? publicUrl;
}

/// Shared material for conversation, talk, passage, and multi-document sets.
class TestAttemptGroup {
  const TestAttemptGroup({
    required this.groupId,
    required this.part,
    required this.orderNo,
    required this.type,
    this.instruction,
    this.audioUrl,
    this.transcript,
    this.passageText,
    this.assets = const [],
  });

  final String groupId;
  final int part;
  final int orderNo;
  final String type;
  final String? instruction;
  final String? audioUrl;
  final String? transcript;
  final String? passageText;
  final List<TestAttemptGroupAsset> assets;
}
