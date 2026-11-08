import '../models/mock_test.dart';
import '../models/test_part.dart';

class MockTestMockData {
  MockTestMockData._();

  static final List<MockTest> tests = [
    MockTest(
      testId: '11111111-1111-4111-8111-000000000005',
      title: 'ETS 2026 Test 05',
      durationSeconds: 7200,
      createdAt: DateTime(2026, 10, 30),
      totalQuestions: 200,
    ),
    MockTest(
      testId: '11111111-1111-4111-8111-000000000004',
      title: 'ETS 2026 Test 04',
      durationSeconds: 7200,
      createdAt: DateTime(2026, 10, 20),
      totalQuestions: 200,
    ),
    MockTest(
      testId: '11111111-1111-4111-8111-000000000003',
      title: 'ETS 2026 Test 03',
      durationSeconds: 7200,
      createdAt: DateTime(2026, 10, 10),
      totalQuestions: 200,
    ),
  ];

  static const List<TestPart> parts = [
    TestPart(
      part: 1,
      title: 'Mô tả hình ảnh',
      totalQuestions: 6,
      groupCount: 6,
      available: true,
    ),
    TestPart(
      part: 2,
      title: 'Hỏi - đáp',
      totalQuestions: 25,
      groupCount: 25,
      available: true,
    ),
    TestPart(
      part: 3,
      title: 'Hội thoại ngắn',
      totalQuestions: 39,
      groupCount: 13,
      available: true,
    ),
    TestPart(
      part: 4,
      title: 'Bài nói ngắn',
      totalQuestions: 30,
      groupCount: 10,
      available: true,
    ),
    TestPart(
      part: 5,
      title: 'Điền vào câu',
      totalQuestions: 30,
      groupCount: 0,
      available: true,
    ),
    TestPart(
      part: 6,
      title: 'Điền vào đoạn văn',
      totalQuestions: 16,
      groupCount: 4,
      available: true,
    ),
    TestPart(
      part: 7,
      title: 'Đọc hiểu',
      totalQuestions: 54,
      groupCount: 15,
      available: true,
    ),
  ];
}
