// ignore_for_file: prefer_initializing_formals
import '../../../core/errors/app_exception.dart';
import '../mock_data/mock_test_mock_data.dart';
import '../models/exam_api_dtos.dart';
import '../models/mock_test.dart';
import '../models/test_part.dart';
import '../services/exam_api_service.dart';

/// Test catalogue repository. When configured with ExamApiService it reads the
/// Backend catalogue; otherwise it preserves the original Mock/Local data.
class MockTestRepository {
  MockTestRepository({ExamApiService? api}) : _api = api;

  ExamApiService? _api;
  String? Function()? _currentUserId;
  int _scopeRevision = 0;
  List<MockTest>? _apiTestsCache;

  bool get usesBackend => _api != null;

  void configureApi({
    required ExamApiService? api,
    String? Function()? currentUserId,
  }) {
    _api = api;
    _currentUserId = currentUserId;
    resetForUserScopeChange();
  }

  void resetForUserScopeChange() {
    _scopeRevision++;
    _apiTestsCache = null;
  }

  Future<List<MockTest>> getTests() async {
    final api = _api;
    if (api == null) {
      return List<MockTest>.unmodifiable(MockTestMockData.tests);
    }

    final scope = _captureScope();
    final cached = _apiTestsCache;
    if (cached != null) {
      _ensureScope(scope);
      return List.unmodifiable(cached);
    }

    final result = <MockTest>[];
    const pageSize = 50;
    var page = 1;
    var totalPages = 1;

    do {
      _ensureScope(scope);
      final raw = await api.listTests(page: page, size: pageSize);
      _ensureScope(scope);
      final parsed = ExamPageDto<ExamTestDto>.fromObject(
        raw,
        parseItem: ExamTestDto.fromObject,
      );
      if (parsed.page != page) {
        throw const FormatException('Exam API trả sai số trang được yêu cầu.');
      }
      if (page == 1) totalPages = parsed.totalPages;
      if (page > 1 && parsed.totalPages != totalPages) {
        throw const FormatException(
          'Danh sách đề thi thay đổi trong lúc phân trang. Vui lòng tải lại.',
        );
      }
      result.addAll(parsed.items.map((item) => item.toDomain()));
      page++;
      if (page > 501) {
        throw const FormatException(
          'Danh sách đề thi vượt giới hạn phân trang an toàn.',
        );
      }
    } while (page <= totalPages);

    _ensureScope(scope);
    _apiTestsCache = List.unmodifiable(result);
    return List.unmodifiable(result);
  }

  Future<MockTest> getTest(String testId) async {
    final api = _api;
    if (api == null) {
      for (final test in MockTestMockData.tests) {
        if (test.testId == testId) return test;
      }
      throw StateError('Không tìm thấy đề thi được chọn.');
    }

    final scope = _captureScope();
    final raw = await api.getTest(testId);
    _ensureScope(scope);
    return ExamTestDto.fromObject(raw).toDomain();
  }

  Future<List<TestPart>> getTestParts(String testId) async {
    final api = _api;
    if (api == null) {
      await getTest(testId);
      return List<TestPart>.unmodifiable(MockTestMockData.parts);
    }

    final scope = _captureScope();
    final raw = await api.getTestParts(testId);
    _ensureScope(scope);
    final result = ExamTestPartsDto.fromObject(raw);
    if (result.testId != testId) {
      throw const FormatException(
        'Cấu trúc Part trả về không thuộc đề thi được yêu cầu.',
      );
    }
    return result.parts;
  }

  _MockTestScope _captureScope() {
    final userId = _currentUserId?.call()?.trim();
    if (userId == null || userId.isEmpty) {
      throw const AppException.unauthorized(
        message: 'Bạn cần đăng nhập để tải danh sách đề thi.',
      );
    }
    return _MockTestScope(userId: userId, revision: _scopeRevision);
  }

  void _ensureScope(_MockTestScope scope) {
    if (scope.revision != _scopeRevision ||
        _currentUserId?.call()?.trim() != scope.userId) {
      throw const AppException.cancelled(
        message: 'Yêu cầu đề thi đã bị hủy do tài khoản thay đổi.',
      );
    }
  }
}

class _MockTestScope {
  const _MockTestScope({required this.userId, required this.revision});

  final String userId;
  final int revision;
}
