/// Domain constraints shared by Full TOEIC and Part practice attempts.
class MockTestExamRules {
  MockTestExamRules._();

  static const int fullDurationSeconds = 7200;
  static const int minPartDurationSeconds = 300;
  static const int maxPartDurationSeconds = 10800;
  static const List<int> fullParts = [1, 2, 3, 4, 5, 6, 7];
  static const Map<int, int> expectedQuestionCounts = {
    1: 6,
    2: 25,
    3: 39,
    4: 30,
    5: 30,
    6: 16,
    7: 54,
  };
}
