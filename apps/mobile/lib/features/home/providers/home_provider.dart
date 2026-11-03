import 'package:flutter/foundation.dart';

class WeakArea {
  const WeakArea({required this.label, required this.accuracy});
  final String label; // 'Part 5'
  final int accuracy; // 62 (%)
}

class DashboardData {
  const DashboardData({
    required this.userName,
    required this.predictedScore, // null = chưa đủ 3 bài thi / 30 ngày
    required this.streakDays,
    required this.vocabLearned,
    required this.lessonsDone,
    required this.mockTestCount,
    required this.todayVocab,
    required this.todayLessons,
    required this.dueFlashcards,
    required this.weakAreas,
  });

  final String userName;
  final int? predictedScore;
  final int streakDays;
  final int vocabLearned;
  final int lessonsDone;
  final int mockTestCount;
  final int todayVocab;
  final int todayLessons;
  final int dueFlashcards;
  final List<WeakArea> weakAreas;
}

enum HomeStatus { idle, loading, loaded, error }

class HomeProvider extends ChangeNotifier {
  HomeStatus status = HomeStatus.idle;
  DashboardData? data;
  String? errorMessage;

  Future<void> loadDashboard() async {
    if (status == HomeStatus.loading) return;
    status = HomeStatus.loading;
    errorMessage = null;
    notifyListeners();

    try {
      await Future.delayed(const Duration(milliseconds: 500));
      // TODO: repository.getDashboard() gộp:
      //  GET /users/me, /analytics/progress, /analytics/prediction,
      //  /analytics/weak-areas, /learning/review-today
      data = const DashboardData(
        userName: 'Hải',
        predictedScore: 685,
        streakDays: 12,
        vocabLearned: 248,
        lessonsDone: 14,
        mockTestCount: 5,
        todayVocab: 18,
        todayLessons: 1,
        dueFlashcards: 15,
        weakAreas: [
          WeakArea(label: 'Part 5', accuracy: 62),
          WeakArea(label: 'Part 3', accuracy: 68),
          WeakArea(label: 'Part 7', accuracy: 71),
        ],
      );
      status = HomeStatus.loaded;
    } catch (e) {
      errorMessage = 'Không tải được dữ liệu. Vui lòng thử lại.';
      status = HomeStatus.error; // data cũ (nếu có) vẫn được giữ
    }
    notifyListeners();
  }
}
