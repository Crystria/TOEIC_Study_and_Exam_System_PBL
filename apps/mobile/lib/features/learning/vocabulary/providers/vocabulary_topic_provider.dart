import 'package:flutter/foundation.dart';

class TopicSummary {
  const TopicSummary({required this.id, required this.name, required this.learned, required this.total});
  final String id;
  final String name;
  final int learned;
  final int total;
}

enum TopicsStatus { idle, loading, loaded, error }

class VocabularyTopicsProvider extends ChangeNotifier {
  TopicsStatus status = TopicsStatus.idle;
  List<TopicSummary> topics = [];
  int dailyLearned = 0;
  int dailyGoal = 20;
  int dueForReview = 0;

  Future<void> loadTopics() async {
    status = TopicsStatus.loading;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 500));
    // TODO: repository.getTopics() + repository.getProgress()
    topics = const [
      TopicSummary(id: 't1', name: 'Office & Business', learned: 7, total: 20),
      TopicSummary(id: 't2', name: 'Travel & Transport', learned: 12, total: 24),
    ];
    dailyLearned = 8;
    dueForReview = 27;
    status = TopicsStatus.loaded;
    notifyListeners();
  }
}
