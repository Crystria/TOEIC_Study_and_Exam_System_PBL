import 'package:image_picker/image_picker.dart';

import '../../auth/models/avatar_api_dtos.dart';

/// A validated image selected by the learner for their own profile avatar.
class AvatarImageSelection {
  AvatarImageSelection({required List<int> bytes, required this.contentType})
    : bytes = List<int>.unmodifiable(bytes);

  final List<int> bytes;
  final String contentType;
}

abstract interface class AvatarImageSource {
  /// Opens the system photo picker. Returns null when the user cancels.
  Future<AvatarImageSelection?> pickFromGallery();
}

class AvatarImageSelectionException implements Exception {
  const AvatarImageSelectionException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Device implementation backed by the platform photo picker.
///
/// It intentionally does not request camera access. Images are resized before
/// they are read into memory and are validated against the Backend's 2 MiB
/// limit using their actual byte signature rather than the filename.
class DeviceAvatarImageSource implements AvatarImageSource {
  DeviceAvatarImageSource({ImagePicker? picker})
    : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<AvatarImageSelection?> pickFromGallery() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 640,
      maxHeight: 640,
      imageQuality: 85,
      requestFullMetadata: false,
    );
    if (file == null) return null;

    final size = await file.length();
    if (size == 0) {
      throw const AvatarImageSelectionException(
        'Ảnh được chọn không có dữ liệu.',
      );
    }
    if (size > AvatarUploadConstraints.maxBytes) {
      throw const AvatarImageSelectionException(
        'Ảnh đại diện không được vượt quá 2 MiB. Hãy chọn ảnh nhỏ hơn.',
      );
    }

    final bytes = await file.readAsBytes();
    return avatarSelectionFromBytes(bytes);
  }
}

/// Validates image bytes and derives a safe Content-Type from the file header.
/// Only formats supported by the mobile avatar upload flow are accepted.
AvatarImageSelection avatarSelectionFromBytes(List<int> bytes) {
  if (bytes.isEmpty) {
    throw const AvatarImageSelectionException(
      'Ảnh được chọn không có dữ liệu.',
    );
  }
  if (bytes.length > AvatarUploadConstraints.maxBytes) {
    throw const AvatarImageSelectionException(
      'Ảnh đại diện không được vượt quá 2 MiB. Hãy chọn ảnh nhỏ hơn.',
    );
  }

  final isJpeg =
      bytes.length >= 3 &&
      bytes[0] == 0xff &&
      bytes[1] == 0xd8 &&
      bytes[2] == 0xff;
  final isPng =
      bytes.length >= 8 &&
      bytes[0] == 0x89 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x4e &&
      bytes[3] == 0x47 &&
      bytes[4] == 0x0d &&
      bytes[5] == 0x0a &&
      bytes[6] == 0x1a &&
      bytes[7] == 0x0a;
  final isWebp =
      bytes.length >= 12 &&
      bytes[0] == 0x52 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46 &&
      bytes[3] == 0x46 &&
      bytes[8] == 0x57 &&
      bytes[9] == 0x45 &&
      bytes[10] == 0x42 &&
      bytes[11] == 0x50;

  final contentType = isJpeg
      ? 'image/jpeg'
      : isPng
      ? 'image/png'
      : isWebp
      ? 'image/webp'
      : null;

  if (contentType == null) {
    throw const AvatarImageSelectionException(
      'Định dạng ảnh chưa được hỗ trợ. Vui lòng chọn JPEG, PNG hoặc WebP.',
    );
  }

  return AvatarImageSelection(bytes: bytes, contentType: contentType);
}
