import 'dart:convert';
import 'dart:io';

/// Explicit allow-list of source-aligned Learning fixtures used by tests only.
enum OfflineFixture {
  vocabularyCatalog(
    'test_data/learning/vocabulary_catalog_current_source.json',
  ),
  grammarCatalog('test_data/learning/grammar_catalog_current_source.json');

  const OfflineFixture(this.relativePath);

  final String relativePath;
}

/// Loads approved fixtures from the project filesystem in test processes.
/// This class deliberately lives under test/ and is not available to runtime lib/.
class OfflineFixtureLoader {
  Future<Map<String, dynamic>> loadObject(OfflineFixture fixture) async {
    final file = File(fixture.relativePath);
    if (!await file.exists()) {
      throw FileSystemException('Fixture not found', fixture.relativePath);
    }

    final source = await file.readAsString();
    final decoded = jsonDecode(source);
    if (decoded is! Map<String, dynamic>) {
      throw FormatException(
        'Fixture must contain a JSON object: ${fixture.relativePath}',
      );
    }

    return Map<String, dynamic>.unmodifiable(decoded);
  }
}
