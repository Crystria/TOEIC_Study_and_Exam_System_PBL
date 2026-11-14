import 'dart:convert';

import 'package:flutter/services.dart';

import '../../models/mock_test.dart';
import '../../models/test_part.dart';
import '../../repositories/mappers/test_data_mock_test_mapper.dart';
import '../mock_test_catalog_data_source.dart';

/// Runtime Development fixture source for the Test Catalog.
///
/// The assets are intentionally declared individually in pubspec.yaml so the
/// Release asset audit can distinguish runtime fixtures from test-only data.
class MockTestTestDataSource implements MockTestCatalogDataSource {
  MockTestTestDataSource({
    AssetBundle? bundle,
    TestDataMockTestMapper mapper = const TestDataMockTestMapper(),
  }) : _bundle = bundle ?? rootBundle,
       _mapper = mapper;

  static const String catalogAsset = 'test_data/exam/test_catalog.json';
  static const String partsAsset = 'test_data/exam/part_structure.json';

  final AssetBundle _bundle;
  final TestDataMockTestMapper _mapper;
  List<MockTest>? _testsCache;
  List<TestPart>? _partsCache;

  @override
  Future<List<MockTest>> getTests() async {
    final cached = _testsCache;
    if (cached != null) return List.unmodifiable(cached);

    final decoded = jsonDecode(await _bundle.loadString(catalogAsset));
    if (decoded is! Map || decoded['items'] is! List) {
      throw const FormatException('Test Catalog fixture không hợp lệ.');
    }
    final items = decoded['items'] as List;
    final tests = items.map(_mapper.mapTest).toList(growable: false);

    _testsCache = List.unmodifiable(tests);
    return List.unmodifiable(tests);
  }

  @override
  Future<MockTest> getTest(String testId) async {
    final tests = await getTests();
    for (final test in tests) {
      if (test.testId == testId) return test;
    }
    throw StateError('Không tìm thấy đề thi được chọn.');
  }

  @override
  Future<List<TestPart>> getTestParts(String testId) async {
    await getTest(testId);
    final cached = _partsCache;
    if (cached != null) return List.unmodifiable(cached);

    final decoded = jsonDecode(await _bundle.loadString(partsAsset));
    if (decoded is! Map || decoded['parts'] is! List) {
      throw const FormatException('Part structure fixture không hợp lệ.');
    }
    final parts = (decoded['parts'] as List)
        .map(_mapper.mapPart)
        .toList(growable: false);

    if (parts.length != 7 ||
        parts.map((part) => part.part).toSet().length != 7) {
      throw const FormatException('Part fixture phải có đủ Part 1–7.');
    }
    _partsCache = List.unmodifiable(parts);
    return List.unmodifiable(parts);
  }

  void clearCache() {
    _testsCache = null;
    _partsCache = null;
  }
}
