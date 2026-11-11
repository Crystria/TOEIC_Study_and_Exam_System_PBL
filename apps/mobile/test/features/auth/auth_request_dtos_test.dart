import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/auth/requests/auth_request_dtos.dart';

void main() {
  group('UpdateProfileRequestDto', () {
    test('omits phoneNumber when the field should remain unchanged', () {
      final json = const UpdateProfileRequestDto(
        fullName: 'QA User',
        includePhoneNumber: false,
      ).toJson();

      expect(json, <String, dynamic>{'fullName': 'QA User'});
      expect(json.containsKey('phoneNumber'), isFalse);
    });

    test('sends explicit null when phoneNumber should be cleared', () {
      final json = const UpdateProfileRequestDto(
        fullName: 'QA User',
        phoneNumber: null,
        includePhoneNumber: true,
      ).toJson();

      expect(json.containsKey('phoneNumber'), isTrue);
      expect(json['phoneNumber'], isNull);
    });

    test('sends a value when phoneNumber is supplied', () {
      final json = const UpdateProfileRequestDto(phoneNumber: '+84901234567')
          .toJson();

      expect(json['phoneNumber'], '+84901234567');
    });
  });
}
