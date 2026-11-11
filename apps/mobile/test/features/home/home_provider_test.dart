import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/features/home/models/dashboard_data.dart';
import 'package:toeic_mobile/features/home/providers/home_provider.dart';
import 'package:toeic_mobile/features/home/repositories/home_repository.dart';

void main() {
  test('loads dashboard data through the HomeRepository boundary', () async {
    final repository = _FakeHomeRepository()..result = _dashboard();
    final provider = HomeProvider(repository: repository);
    addTearDown(provider.dispose);

    await provider.loadDashboard();

    expect(repository.loadCount, 1);
    expect(provider.status, HomeStatus.loaded);
    expect(provider.data?.userName, 'Learner');
    expect(provider.data?.isDemoData, isTrue);
  });

  test('coalesces overlapping initial-load and refresh requests', () async {
    final repository = _FakeHomeRepository();
    final provider = HomeProvider(repository: repository);
    addTearDown(provider.dispose);

    final firstRequest = provider.loadDashboard();
    final secondRequest = provider.loadDashboard();

    expect(identical(firstRequest, secondRequest), isTrue);
    expect(repository.loadCount, 1);

    repository.completer.complete(_dashboard());
    await Future.wait([firstRequest, secondRequest]);

    expect(provider.status, HomeStatus.loaded);
    expect(provider.data?.userName, 'Learner');
  });

  test('allows a retry after a failed request', () async {
    final repository = _FakeHomeRepository()..failNext = true;
    final provider = HomeProvider(repository: repository);
    addTearDown(provider.dispose);

    await provider.loadDashboard();
    expect(provider.status, HomeStatus.error);
    expect(provider.data, isNull);

    repository.result = _dashboard();
    await provider.loadDashboard();

    expect(repository.loadCount, 2);
    expect(provider.status, HomeStatus.loaded);
    expect(provider.errorMessage, isNull);
  });

  test('ignores an in-flight dashboard response after user reset', () async {
    final repository = _FakeHomeRepository();
    final provider = HomeProvider(repository: repository);
    addTearDown(provider.dispose);

    final pendingLoad = provider.loadDashboard();
    provider.resetForUserScopeChange();
    repository.completer.complete(_dashboard());
    await pendingLoad;

    expect(provider.status, HomeStatus.idle);
    expect(provider.data, isNull);
    expect(provider.errorMessage, isNull);
  });
}

DashboardData _dashboard() => const DashboardData(
  userName: 'Learner',
  predictedScore: 650,
  streakDays: 4,
  vocabLearned: 20,
  lessonsDone: 3,
  mockTestCount: 1,
  todayActivityCount: 5,
  dueFlashcards: 2,
  weakAreas: [WeakArea(part: 5, accuracy: 62)],
  isDemoData: true,
);

class _FakeHomeRepository implements HomeRepository {
  final Completer<DashboardData> completer = Completer<DashboardData>();
  DashboardData? result;
  int loadCount = 0;
  bool failNext = false;

  @override
  Future<DashboardData> loadDashboard() {
    loadCount++;
    if (failNext) {
      failNext = false;
      return Future<DashboardData>.error(StateError('temporary error'));
    }
    final value = result;
    return value == null ? completer.future : Future.value(value);
  }
}
