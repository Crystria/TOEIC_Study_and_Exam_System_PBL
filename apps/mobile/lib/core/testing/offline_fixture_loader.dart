import 'dart:convert';

import 'package:flutter/services.dart';

/// Safe, app-readable fixtures. Tester-only answer keys and QA credentials
/// are deliberately excluded from this allow-list.
enum OfflineFixture {
  vocabularyCatalog(
    'test_data/learning/vocabulary_catalog_current_source.json',
  ),
  grammarCatalog('test_data/learning/grammar_catalog_current_source.json');

  const OfflineFixture(this.assetPath);

  final String assetPath;
}

/// Reads only explicitly approved offline fixtures from Flutter's asset bundle.
///
/// Keeping an enum allow-list prevents callers from loading arbitrary files
/// such as `auth/qa_accounts.json` or `exam/answer_key_TESTER_ONLY.json`.
class OfflineFixtureLoader {
  OfflineFixtureLoader({AssetBundle? bundle}) : _bundle = bundle ?? rootBundle;

  final AssetBundle _bundle;

  Future<Map<String, dynamic>> loadObject(OfflineFixture fixture) async {
    final source = await _bundle.loadString(fixture.assetPath);
    final decoded = jsonDecode(source);

    if (decoded is! Map<String, dynamic>) {
      throw FormatException(
        'Fixture must contain a JSON object: ${fixture.assetPath}',
      );
    }

    return Map<String, dynamic>.unmodifiable(decoded);
  }
}
