enum GrammarProgressStatus { notStarted, inProgress, completed }

class GrammarLesson {
  const GrammarLesson({
    required this.id,
    required this.title,
    required this.category,
    required this.summary,
    required this.level,
    required this.durationMinutes,
    required this.sections,
    required this.keyTakeaway,
  });

  final String id;
  final String title;
  final String category;
  final String summary;
  final String level;
  final int durationMinutes;
  final List<GrammarLessonSection> sections;
  final String keyTakeaway;
}

class GrammarLessonSection {
  const GrammarLessonSection({
    required this.title,
    required this.explanation,
    this.examples = const [],
  });

  final String title;
  final String explanation;
  final List<String> examples;
}
