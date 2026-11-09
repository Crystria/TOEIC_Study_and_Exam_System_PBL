import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/mock_test/models/exam_api_dtos.dart';
import 'package:toeic_mobile/features/mock_test/models/test_attempt.dart';
import 'package:toeic_mobile/features/mock_test/models/test_history_item.dart';

void main() {
  group('ExamAttemptDto', () {
    test('preserves the read-only snapshot flag from the API response', () {
      final dto = ExamAttemptDto.fromObject(_readOnlyAttemptJson());

      expect(dto.readOnlySnapshot, isTrue);
      expect(dto.totalQuestions, 0);
      expect(dto.parts, isEmpty);
      expect(dto.toAttempt().readOnlySnapshot, isTrue);
      expect(dto.status, TestAttemptStatus.submitted);
    });

    test('rejects a read-only snapshot with an invalid UUID', () {
      final json = _readOnlyAttemptJson()..['attemptId'] = 'not-a-uuid';

      expect(() => ExamAttemptDto.fromObject(json), throwsFormatException);
    });
  });

  group('ExamHistoryPageDto', () {
    test('converts the API page DTO into the domain history page', () {
      final dto = ExamHistoryPageDto.fromObject({
        'items': <Object?>[],
        'total': 0,
        'page': 1,
        'size': 10,
        'totalPages': 0,
      });

      expect(dto.page, isA<TestHistoryPage>());
      expect(dto.page.items, isEmpty);
      expect(dto.page.total, 0);
      expect(dto.page.page, 1);
      expect(dto.page.size, 10);
      expect(dto.page.totalPages, 0);
      expect(dto.totalPages, 0);
    });
  });
}

Map<String, dynamic> _readOnlyAttemptJson() => <String, dynamic>{
  'attemptId': '11111111-1111-4111-8111-111111111111',
  'testId': '22222222-2222-4222-8222-222222222222',
  'testTitle': 'Historical Full TOEIC',
  'mode': 'FULL',
  'status': 'SUBMITTED',
  'startedAt': '2026-01-01T08:00:00.000Z',
  'deadlineAt': '2026-01-01T10:00:00.000Z',
  'durationSeconds': 7200,
  'serverTime': '2026-01-01T10:00:00.000Z',
  'remainingSeconds': 0,
  'readOnly': true,
  'parts': <Object?>[],
  'groups': <Object?>[],
  'questions': <Object?>[],
  'answers': <Object?>[],
};
