class WeakArea {
  const WeakArea({required this.part, required this.accuracy});

  final int part;
  final int accuracy;

  String get label => 'Part $part';
}

class DashboardData {
  const DashboardData({
    required this.userName,
    required this.predictedScore,
    required this.streakDays,
    required this.vocabLearned,
    required this.lessonsDone,
    required this.mockTestCount,
    required this.todayActivityCount,
    required this.dueFlashcards,
    required this.weakAreas,
    required this.isDemoData,
  });

  final String userName;
  final int? predictedScore;
  final int streakDays;
  final int vocabLearned;
  final int lessonsDone;
  final int mockTestCount;
  final int todayActivityCount;
  final int? dueFlashcards;
  final List<WeakArea> weakAreas;
  final bool isDemoData;
}
