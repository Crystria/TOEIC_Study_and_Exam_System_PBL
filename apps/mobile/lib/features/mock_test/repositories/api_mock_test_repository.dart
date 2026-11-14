import '../../../core/errors/app_exception.dart';
import '../data_sources/remote/mock_test_remote_data_source.dart';
import '../models/exam_api_dtos.dart';
import '../models/mock_test.dart';
import '../models/test_part.dart';
import 'mock_test_repository.dart';

/// Backend implementation of the Test Catalog Repository contract.
class ApiMockTestRepository implements MockTestRepository {
  ApiMockTestRepository({
    required MockTestRemoteDataSource remoteDataSource,
    required String? Function() currentUserId,
  }) : _remoteDataSource = remoteDataSource,
       _currentUserId = currentUserId;

  final MockTestRemoteDataSource _remoteDataSource;
  final String? Function() _currentUserId;
  int _scopeRevision = 0;
  List<MockTest>? _testsCache;

  @override
  void resetForUserScopeChange() {
    _scopeRevision++;
    _testsCache = null;
  }

  @override
  Future<List<MockTest>> getTests() async {
    final scope = _captureScope();
    final cached = _testsCache;
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
      final raw = await _remoteDataSource.listTests(page: page, size: pageSize);
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
    _testsCache = List.unmodifiable(result);
    return List.unmodifiable(result);
  }

  @override
  Future<MockTest> getTest(String testId) async {
    final scope = _captureScope();
    final raw = await _remoteDataSource.getTest(testId);
    _ensureScope(scope);
    return ExamTestDto.fromObject(raw).toDomain();
  }

  @override
  Future<List<TestPart>> getTestParts(String testId) async {
    final scope = _captureScope();
    final raw = await _remoteDataSource.getTestParts(testId);
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
    final userId = _currentUserId()?.trim();
    if (userId == null || userId.isEmpty) {
      throw const AppException.unauthorized(
        message: 'Bạn cần đăng nhập để tải danh sách đề thi.',
      );
    }
    return _MockTestScope(userId: userId, revision: _scopeRevision);
  }

  void _ensureScope(_MockTestScope scope) {
    if (scope.revision != _scopeRevision ||
        _currentUserId()?.trim() != scope.userId) {
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
