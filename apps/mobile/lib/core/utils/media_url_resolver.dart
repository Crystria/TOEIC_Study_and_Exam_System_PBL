import 'dart:io';

class MediaUrlResolver {
  const MediaUrlResolver._();

  /// Chuyển URL localhost của máy host sang địa chỉ có thể truy cập
  /// từ Android Emulator.
  ///
  /// Ví dụ:
  /// http://localhost:19000/media/audio.mp3
  /// -> http://10.0.2.2:19000/media/audio.mp3
  static String resolve(String sourceUrl) {
    final trimmedUrl = sourceUrl.trim();

    if (trimmedUrl.isEmpty) {
      throw const FormatException('Audio URL is empty.');
    }

    final uri = Uri.tryParse(trimmedUrl);

    if (uri == null || !uri.hasAuthority || uri.host.isEmpty) {
      throw FormatException('Invalid audio URL: $trimmedUrl');
    }

    final scheme = uri.scheme.toLowerCase();

    if (scheme != 'http' && scheme != 'https') {
      throw FormatException('Unsupported audio URL scheme: $scheme');
    }

    final host = uri.host.toLowerCase();

    final isLocalHost =
        host == 'localhost' || host == '127.0.0.1' || host == '::1';

    if (Platform.isAndroid && isLocalHost) {
      return uri.replace(host: '10.0.2.2').toString();
    }

    return uri.toString();
  }
}
