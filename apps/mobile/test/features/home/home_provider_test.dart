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

  @override
  Future<DashboardData> loadDashboard() {
    loadCount++;
    final value = result;
    return value == null ? completer.future : Future.value(value);
  }
}
