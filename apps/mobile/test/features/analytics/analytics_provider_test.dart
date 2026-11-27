import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/analytics/data_sources/test_data/analytics_test_data_source.dart';
import 'package:toeic_mobile/features/analytics/models/analytics_models.dart';
import 'package:toeic_mobile/features/analytics/providers/analytics_provider.dart';
import 'package:toeic_mobile/features/analytics/repositories/test_data/test_data_analytics_repository.dart';

void main() {
  test('loads the selected range and clearly identifies demo data', () async {
    final provider = AnalyticsProvider(
      repository: TestDataAnalyticsRepository(
        testDataSource: AnalyticsTestDataSource(),
      ),
    );
    addTearDown(provider.dispose);

    await provider.load(range: AnalyticsTimeRange.last7Days);

    expect(provider.status, AnalyticsStatus.loaded);
    expect(provider.progress?.isIllustrative, isTrue);
    expect(provider.progress?.timeRange, AnalyticsTimeRange.last7Days);
    expect(provider.scores, isNotNull);
    expect(provider.practices, isNotNull);
    expect(provider.progress?.weakAreas, hasLength(7));
  });

  test('does not apply a stale response after account scope reset', () async {
    final repository = _DelayedProgressAnalyticsRepository();
    final provider = AnalyticsProvider(repository: repository);
    addTearDown(provider.dispose);

    final pendingLoad = provider.load(range: AnalyticsTimeRange.last30Days);
    provider.resetForUserScopeChange();
    repository.progressCompleter.complete(
      await AnalyticsTestDataSource().getProgress(
        AnalyticsTimeRange.last30Days,
      ),
    );
    await pendingLoad;

    expect(provider.status, AnalyticsStatus.idle);
    expect(provider.progress, isNull);
    expect(provider.scores, isNull);
    expect(provider.practices, isNull);
  });
}

class _DelayedProgressAnalyticsRepository extends TestDataAnalyticsRepository {
  _DelayedProgressAnalyticsRepository()
    : super(testDataSource: AnalyticsTestDataSource());

  final Completer<AnalyticsProgress> progressCompleter =
      Completer<AnalyticsProgress>();

  @override
  Future<AnalyticsProgress> getProgress(AnalyticsTimeRange range) {
    return progressCompleter.future;
  }
}
