enum GrammarProgressStatus { notStarted, inProgress, completed }

class GrammarLesson {
  const GrammarLesson({
    required this.id,
    required this.title,
    required this.category,
    required this.summary,
    this.level,
    this.durationMinutes,
    required this.sections,
    this.keyTakeaway,
    this.contentMarkdown,
    this.contentHtml,
    this.serverStatus,
  });

  final String id;
  final String title;
  final String category;
  final String summary;
  final String? level;
  final int? durationMinutes;
  final List<GrammarLessonSection> sections;
  final String? keyTakeaway;

  /// Backend content fields. The mobile client renders the Markdown as safe
  /// plain text sections and never injects Backend HTML into a WebView.
  final String? contentMarkdown;
  final String? contentHtml;
  final String? serverStatus;
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
