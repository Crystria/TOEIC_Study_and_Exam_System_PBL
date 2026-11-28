/// Transport-level contract for the Exam Service.
///
/// It returns decoded response objects; DTO validation and domain mapping are
/// performed by the repository/mapper layer.
abstract interface class MockTestRemoteDataSource {
  Future<Object?> listTests({required int page, required int size});
  Future<Object?> getTest(String testId);
  Future<Object?> getTestParts(String testId);
  Future<Object?> startFullAttempt({
    required String testId,
    required String idempotencyKey,
  });
  Future<Object?> startPartAttempt({
    required String testId,
    required List<int> parts,
    required int durationSeconds,
    required String idempotencyKey,
  });
  Future<Object?> getAttempt(String attemptId);
  Future<void> saveAnswer({
    required String attemptId,
    required String questionId,
    required String? selectedOption,
  });
  Future<void> saveDraft({
    required String attemptId,
    required Map<String, String?> answers,
  });
  Future<Object?> submitAttempt({
    required String attemptId,
    required Map<String, String?> answers,
  });
  Future<Object?> getAttemptHistory({
    required int page,
    required int size,
    String? testId,
    String? mode,
  });
}
