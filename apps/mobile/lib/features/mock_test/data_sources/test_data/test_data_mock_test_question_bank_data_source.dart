import '../../models/mock_test_question_bank.dart';
import 'mock_test_question_bank_fixture.dart';
import '../mock_test_question_bank_data_source.dart';

/// Development-only question bank populated from deterministic fixture data.
class TestDataMockTestQuestionBankDataSource
    implements MockTestQuestionBankDataSource {
  const TestDataMockTestQuestionBankDataSource();

  @override
  MockTestQuestionBank loadQuestionBank() =>
      MockTestQuestionBankFixture.buildBank();
}
