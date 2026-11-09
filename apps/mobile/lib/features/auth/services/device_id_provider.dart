import 'dart:math';

import '../../../core/storage/token_storage.dart';

abstract interface class DeviceIdProvider {
  Future<String> getOrCreate();
}

/// Stores a random installation identifier independently from auth tokens.
class SecureDeviceIdProvider implements DeviceIdProvider {
  SecureDeviceIdProvider({SecureKeyValueStore? secureStore})
    : _secureStore = secureStore ?? FlutterSecureKeyValueStore();

  static const String _key = 'toeic_mobile.device.id.v1';
  final SecureKeyValueStore _secureStore;

  @override
  Future<String> getOrCreate() async {
    final saved = await _secureStore.read(key: _key);
    if (saved != null && saved.trim().isNotEmpty) return saved.trim();

    final id = _newUuidV4();
    await _secureStore.write(key: _key, value: id);
    return id;
  }

  String _newUuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
        '${hex.substring(20, 32)}';
  }
}
