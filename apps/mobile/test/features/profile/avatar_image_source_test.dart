import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/auth/models/avatar_api_dtos.dart';
import 'package:toeic_mobile/features/profile/services/avatar_image_source.dart';

void main() {
  group('avatarSelectionFromBytes', () {
    test('detects JPEG from its signature', () {
      final selection = avatarSelectionFromBytes(const [
        0xff,
        0xd8,
        0xff,
        0x00,
      ]);

      expect(selection.contentType, 'image/jpeg');
      expect(selection.bytes, const [0xff, 0xd8, 0xff, 0x00]);
    });

    test('detects PNG from its signature', () {
      final selection = avatarSelectionFromBytes(const [
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ]);

      expect(selection.contentType, 'image/png');
    });

    test('detects WebP from RIFF/WEBP signature', () {
      final selection = avatarSelectionFromBytes(const [
        0x52,
        0x49,
        0x46,
        0x46,
        0x00,
        0x00,
        0x00,
        0x00,
        0x57,
        0x45,
        0x42,
        0x50,
      ]);

      expect(selection.contentType, 'image/webp');
    });

    test('rejects empty, oversized and unsupported files', () {
      expect(
        () => avatarSelectionFromBytes(const []),
        throwsA(isA<AvatarImageSelectionException>()),
      );
      expect(
        () => avatarSelectionFromBytes(
          List<int>.filled(AvatarUploadConstraints.maxBytes + 1, 0),
        ),
        throwsA(isA<AvatarImageSelectionException>()),
      );
      expect(
        () => avatarSelectionFromBytes(const [0x00, 0x01, 0x02]),
        throwsA(isA<AvatarImageSelectionException>()),
      );
    });

    test('accepts a file at the exact upload size limit', () {
      final bytes = List<int>.filled(AvatarUploadConstraints.maxBytes, 0)
        ..[0] = 0xff
        ..[1] = 0xd8
        ..[2] = 0xff;

      final selection = avatarSelectionFromBytes(bytes);

      expect(selection.bytes, hasLength(AvatarUploadConstraints.maxBytes));
      expect(selection.contentType, 'image/jpeg');
    });

    test('returns an immutable byte snapshot', () {
      final bytes = <int>[0xff, 0xd8, 0xff];
      final selection = avatarSelectionFromBytes(bytes);
      bytes[0] = 0;

      expect(selection.bytes.first, 0xff);
      expect(() => selection.bytes[0] = 0, throwsUnsupportedError);
    });
  });
}
