import '../../models/mock_test.dart';
import '../../models/test_part.dart';

/// Maps the JSON shapes stored in test_data/exam into domain models.
class TestDataMockTestMapper {
  const TestDataMockTestMapper();

  MockTest mapTest(Object? raw) {
    if (raw is! Map) {
      throw const FormatException('Test Catalog item phải là object.');
    }
    final item = Map<String, dynamic>.from(raw);
    final testId = item['testId'];
    final title = item['title'];
    final duration = item['durationSeconds'];
    final createdAt = DateTime.tryParse(item['createdAt'] as String? ?? '');
    final totalQuestions = item['totalQuestions'];
    if (testId is! String ||
        title is! String ||
        duration is! int ||
        createdAt == null ||
        totalQuestions is! int) {
      throw const FormatException('Test Catalog item thiếu trường bắt buộc.');
    }
    return MockTest(
      testId: testId,
      title: title,
      durationSeconds: duration,
      createdAt: createdAt,
      totalQuestions: totalQuestions,
    );
  }

  TestPart mapPart(Object? raw) {
    if (raw is! Map) {
      throw const FormatException('Part fixture phải là object.');
    }
    final item = Map<String, dynamic>.from(raw);
    final number = item['part'];
    final title = item['title'];
    final total = item['totalQuestions'];
    final groupCount = item['groupCount'];
    final available = item['available'];
    final errors = item['errors'];
    if (number is! int ||
        title is! String ||
        total is! int ||
        groupCount is! int ||
        available is! bool ||
        (errors != null &&
            (errors is! List || errors.any((value) => value is! String)))) {
      throw const FormatException('Part fixture thiếu trường hoặc sai kiểu.');
    }
    return TestPart(
      part: number,
      title: title,
      totalQuestions: total,
      groupCount: groupCount,
      available: available,
      errors: List<String>.unmodifiable(
        (errors as List? ?? const []).cast<String>(),
      ),
    );
  }
}
