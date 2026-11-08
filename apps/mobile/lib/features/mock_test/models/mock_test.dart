class MockTest {
  const MockTest({
    required this.testId,
    required this.title,
    required this.durationSeconds,
    required this.createdAt,
    required this.totalQuestions,
  });

  final String testId;
  final String title;
  final int durationSeconds;
  final DateTime createdAt;
  final int totalQuestions;

  String get durationLabel {
    final minutes = durationSeconds ~/ 60;
    if (minutes % 60 == 0) return '${minutes ~/ 60} giờ';
    if (minutes > 60) return '${minutes ~/ 60} giờ ${minutes % 60} phút';
    return '$minutes phút';
  }
}
