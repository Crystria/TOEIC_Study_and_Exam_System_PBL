class TestPart {
  const TestPart({
    required this.part,
    required this.title,
    required this.totalQuestions,
    required this.groupCount,
    required this.available,
    this.errors = const [],
  });

  final int part;
  final String title;
  final int totalQuestions;
  final int groupCount;
  final bool available;
  final List<String> errors;
}
