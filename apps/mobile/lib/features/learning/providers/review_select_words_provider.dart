import 'package:flutter/foundation.dart';

enum WordMastery { chuaThuoc, moHo, daThuoc }

class ReviewWord {
  ReviewWord({
    required this.id,
    required this.word,
    required this.meaning,
    required this.mastery,
    this.phonetic = '',
    this.example = '',
    this.selected = false,
  });

  final String id;
  final String word;
  final String meaning;
  final WordMastery mastery;
  final String phonetic;
  final String example;
  bool selected;
}

enum ReviewSelectStatus { idle, loading, loaded, error }

class ReviewSelectWordsProvider extends ChangeNotifier {
  ReviewSelectStatus status = ReviewSelectStatus.idle;
  String? errorMessage;
  String selectedTopicId = 'office';
  final Map<String, List<ReviewWord>> _wordsByTopic = {
    'office': [
      ReviewWord(
        id: 'v1',
        word: 'negotiate',
        meaning: 'thương lượng',
        mastery: WordMastery.moHo,
        phonetic: '/nɪˈɡoʊʃieɪt/',
        example: 'We need to negotiate the contract terms.',
        selected: true,
      ),
      ReviewWord(
        id: 'v2',
        word: 'contract',
        meaning: 'hợp đồng',
        mastery: WordMastery.daThuoc,
        phonetic: '/ˈkɒntrækt/',
        example: 'Please read the contract carefully.',
      ),
      ReviewWord(
        id: 'v3',
        word: 'invoice',
        meaning: 'hóa đơn',
        mastery: WordMastery.chuaThuoc,
        phonetic: '/ˈɪnvɔɪs/',
        example: 'The invoice is due next Monday.',
        selected: true,
      ),
      ReviewWord(
        id: 'v4',
        word: 'deadline',
        meaning: 'hạn chót',
        mastery: WordMastery.daThuoc,
        phonetic: '/ˈdedlaɪn/',
        example: 'We must meet the deadline.',
      ),
      ReviewWord(
        id: 'v5',
        word: 'client',
        meaning: 'khách hàng',
        mastery: WordMastery.daThuoc,
        phonetic: '/ˈklaɪənt/',
        example: 'The client approved our proposal.',
      ),
      ReviewWord(
        id: 'v6',
        word: 'proposal',
        meaning: 'đề xuất',
        mastery: WordMastery.moHo,
        phonetic: '/prəˈpoʊzəl/',
        example: 'She submitted a new proposal.',
        selected: true,
      ),
    ],
    'marketing': [
      ReviewWord(
        id: 'v7',
        word: 'campaign',
        meaning: 'chiến dịch',
        mastery: WordMastery.moHo,
        phonetic: '/kæmˈpeɪn/',
        example: 'The campaign starts next week.',
        selected: true,
      ),
      ReviewWord(
        id: 'v8',
        word: 'advertise',
        meaning: 'quảng cáo',
        mastery: WordMastery.chuaThuoc,
        phonetic: '/ˈædvərtaɪz/',
        example: 'They advertise the product online.',
      ),
      ReviewWord(
        id: 'v9',
        word: 'audience',
        meaning: 'đối tượng khán giả',
        mastery: WordMastery.daThuoc,
        phonetic: '/ˈɔːdiəns/',
        example: 'The audience responded positively.',
      ),
    ],
  };

  static const Map<String, String> topics = {
    'office': 'Office & Business',
    'marketing': 'Marketing',
  };

  List<ReviewWord> get words =>
      List.unmodifiable(_wordsByTopic[selectedTopicId] ?? const []);
  List<ReviewWord> get selectedWords =>
      words.where((word) => word.selected).toList(growable: false);
  int get selectedCount => selectedWords.length;
  int get totalCount => words.length;

  Future<void> loadDueWords([String? topicId]) async {
    if (topicId != null && _wordsByTopic.containsKey(topicId)) {
      selectedTopicId = topicId;
    }
    status = ReviewSelectStatus.loading;
    errorMessage = null;
    notifyListeners();
    await Future<void>.delayed(const Duration(milliseconds: 250));
    status = ReviewSelectStatus.loaded;
    notifyListeners();
  }

  void selectTopic(String topicId) {
    if (!_wordsByTopic.containsKey(topicId) || topicId == selectedTopicId) {
      return;
    }
    selectedTopicId = topicId;
    notifyListeners();
  }

  void toggle(String id) {
    final matches = _wordsByTopic[selectedTopicId] ?? const <ReviewWord>[];
    for (final word in matches) {
      if (word.id == id) {
        word.selected = !word.selected;
        notifyListeners();
        return;
      }
    }
  }

  void selectAll() {
    for (final word in _wordsByTopic[selectedTopicId] ?? const <ReviewWord>[]) {
      word.selected = true;
    }
    notifyListeners();
  }
}
