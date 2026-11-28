import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/errors/app_exception.dart';
import 'package:toeic_mobile/features/analytics/data_sources/analytics_data_source.dart';
import 'package:toeic_mobile/features/analytics/data_sources/test_data/analytics_test_data_source.dart';
import 'package:toeic_mobile/features/analytics/models/analytics_models.dart';
import 'package:toeic_mobile/features/analytics/repositories/analytics_repository.dart';
import 'package:toeic_mobile/features/analytics/repositories/test_data/test_data_analytics_repository.dart';

void main() {
  group('Analytics repository implementations', () {
    test(
      'Test Data repository returns clearly illustrative Analytics models',
      () async {
        final repository = TestDataAnalyticsRepository(
          testDataSource: AnalyticsTestDataSource(),
        );

        final progress = await repository.getProgress(
          AnalyticsTimeRange.last30Days,
        );
        final scores = await repository.getScores(page: 1, size: 10);
        final practices = await repository.getPractices(page: 1, size: 10);

        expect(progress.isIllustrative, isTrue);
        expect(progress.weakAreas, hasLength(7));
        expect(scores.items.every((item) => item.isFull), isTrue);
        expect(practices.items.every((item) => !item.isFull), isTrue);
      },
    );

    test(
      'API repository propagates API data-source failures without fallback',
      () async {
        final failure = StateError('analytics API unavailable');
        final repository = ApiAnalyticsRepository(
          remoteDataSource: _FailingAnalyticsDataSource(failure),
          currentUserId: () => 'user-a',
        );

        await expectLater(
          repository.getProgress(AnalyticsTimeRange.last30Days),
          throwsA(same(failure)),
        );
      },
    );

    test('API repository requires an authenticated user scope', () async {
      final repository = ApiAnalyticsRepository(
        remoteDataSource: _UnusedAnalyticsDataSource(),
        currentUserId: () => null,
      );

      await expectLater(
        repository.getProgress(AnalyticsTimeRange.last30Days),
        throwsA(
          isA<AppException>().having(
            (error) => error.type,
            'type',
            AppExceptionType.unauthorized,
          ),
        ),
      );
    });

    test(
      'API repository rejects invalid pagination before calling data source',
      () async {
        final repository = ApiAnalyticsRepository(
          remoteDataSource: _UnusedAnalyticsDataSource(),
          currentUserId: () => 'user-a',
        );

        await expectLater(repository.getScores(page: 0), throwsArgumentError);
        await expectLater(
          repository.getPractices(size: 51),
          throwsArgumentError,
        );
      },
    );

    test(
      'Test Data repository discards a response after account changes',
      () async {
        var activeUserId = 'user-a';
        final dataSource = _DelayedAnalyticsDataSource();
        final repository = TestDataAnalyticsRepository(
          testDataSource: dataSource,
          currentUserId: () => activeUserId,
        );

        final pending = repository.getProgress(AnalyticsTimeRange.last30Days);
        activeUserId = 'user-b';
        dataSource.progressCompleter.complete(
          await AnalyticsTestDataSource().getProgress(
            AnalyticsTimeRange.last30Days,
          ),
        );

        await expectLater(
          pending,
          throwsA(
            isA<AppException>().having(
              (error) => error.type,
              'type',
              AppExceptionType.cancelled,
            ),
          ),
        );
      },
    );
  });
}

class _FailingAnalyticsDataSource extends _UnusedAnalyticsDataSource {
  _FailingAnalyticsDataSource(this.failure);
  final Object failure;

  @override
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range) async {
    throw failure;
  }
}

class _DelayedAnalyticsDataSource extends _UnusedAnalyticsDataSource {
  final Completer<AnalyticsProgress> progressCompleter =
      Completer<AnalyticsProgress>();

  @override
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range) =>
      progressCompleter.future;
}

class _UnusedAnalyticsDataSource implements AnalyticsDataSource {
  Never _notCalled() =>
      throw UnimplementedError('This method is not used here.');

  @override
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range) async =>
      _notCalled();

  @override
  Future<AnalyticsHistoryPage> getScores({int page = 1, int size = 20}) async =>
      _notCalled();

  @override
  Future<AnalyticsHistoryPage> getPractices({
    int page = 1,
    int size = 20,
  }) async => _notCalled();

  @override
  Future<AnalyticsStreak> getStreak() async => _notCalled();

  @override
  Future<AnalyticsPrediction> getPrediction() async => _notCalled();

  @override
  Future<AnalyticsWeakAreaSummary> getWeakAreas() async => _notCalled();
}
