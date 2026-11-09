// ignore_for_file: prefer_initializing_formals
import '../../analytics/models/analytics_models.dart';
import '../../analytics/repositories/analytics_repository.dart';
import '../../learning/repositories/learning_repository.dart';
import '../models/dashboard_data.dart';
import 'home_repository.dart';

/// Composes Analytics and Learning data into a Dashboard-specific model.
/// Cross-feature dependencies are isolated in this adapter rather than the
/// HomeProvider or HomeScreen.
class AnalyticsHomeRepository implements HomeRepository {
  AnalyticsHomeRepository({
    required AnalyticsRepository analyticsRepository,
    required String? Function() currentUserName,
    LearningRepository? learningRepository,
  }) : _analyticsRepository = analyticsRepository,
       _learningRepository = learningRepository,
       _currentUserName = currentUserName;

  final AnalyticsRepository _analyticsRepository;
  final LearningRepository? _learningRepository;
  final String? Function() _currentUserName;

  @override
  Future<DashboardData> loadDashboard() async {
    final progress = await _analyticsRepository.getProgress(
      AnalyticsTimeRange.last30Days,
    );

    int? dueFlashcards;
    final learningRepository = _learningRepository;
    if (learningRepository != null) {
      try {
        final learningSummary = await learningRepository.getProgressSummary();
        dueFlashcards = learningSummary.dueVocabularies;
      } catch (_) {
        // Dashboard analytics remain useful when the optional Learning
        // summary endpoint is temporarily unavailable.
      }
    } else if (_analyticsRepository.isDemoData) {
      dueFlashcards = 15;
    }

    // The Analytics service defines activity days in Asia/Ho_Chi_Minh.
    final today = DateTime.now().toUtc().add(const Duration(hours: 7));
    final todayKey =
        '${today.year.toString().padLeft(4, '0')}-'
        '${today.month.toString().padLeft(2, '0')}-'
        '${today.day.toString().padLeft(2, '0')}';
    var todayActivityCount = 0;
    for (final item in progress.dailyActivity) {
      final date = item.date.toUtc().toIso8601String().substring(0, 10);
      if (date == todayKey) {
        todayActivityCount = item.count;
        break;
      }
    }

    final currentName = _currentUserName()?.trim();
    return DashboardData(
      userName: currentName?.isNotEmpty == true ? currentName! : 'bạn',
      predictedScore: progress.predictedToeicScore,
      streakDays: progress.learningStreakDays,
      vocabLearned: progress.lifetime.vocabulariesLearned,
      lessonsDone: progress.lifetime.grammarLessonsCompleted,
      mockTestCount: progress.lifetime.mockTestCount,
      todayActivityCount: todayActivityCount,
      dueFlashcards: dueFlashcards,
      weakAreas: progress.weakAreas
          .where((item) => item.isAvailable && item.accuracyPercent != null)
          .map(
            (item) =>
                WeakArea(part: item.part, accuracy: item.accuracyPercent!),
          )
          .toList(growable: false),
      isDemoData: _analyticsRepository.isDemoData,
    );
  }
}
