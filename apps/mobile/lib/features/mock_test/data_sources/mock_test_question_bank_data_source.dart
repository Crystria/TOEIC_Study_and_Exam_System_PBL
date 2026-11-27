import '../models/mock_test_question_bank.dart';

/// Source-neutral port for loading the question-bank model used by attempt
/// repositories. Production API attempts receive question snapshots from the
/// Backend and do not inject a local Test Data implementation.
abstract interface class MockTestQuestionBankDataSource {
  MockTestQuestionBank loadQuestionBank();
}
