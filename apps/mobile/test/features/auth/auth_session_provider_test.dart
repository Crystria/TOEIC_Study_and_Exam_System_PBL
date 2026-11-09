import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/core/session/user_scoped_data_coordinator.dart';
import 'package:toeic_mobile/core/storage/vocabulary_progress_storage.dart';
import 'package:toeic_mobile/features/auth/providers/auth_session_provider.dart';
import 'package:toeic_mobile/features/auth/repositories/fake_auth_repository.dart';
import 'package:toeic_mobile/shared/models/app_user.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test('activates the account and clears its local scope on logout', () async {
    final storage = VocabularyProgressStorage();
    var resetCount = 0;
    final coordinator = UserScopedDataCoordinator(
      vocabularyStorage: storage,
      resetCallbacks: [() => resetCount++],
      loadCallbacks: const [],
    );
    final repository = _SessionAuthRepository();
    final provider = AuthSessionProvider(
      repository: repository,
      userDataCoordinator: coordinator,
    );
    addTearDown(provider.dispose);

    await provider.setCurrentUser(_user('learner-a'));

    expect(provider.isAuthenticated, isTrue);
    expect(provider.currentUserId, 'learner-a');
    expect(coordinator.activeUserId, 'learner-a');
    expect(provider.currentSession?.userId, 'learner-a');

    final logoutConfirmed = await provider.logout();

    expect(logoutConfirmed, isTrue);
    expect(provider.status, AuthSessionStatus.unauthenticated);
    expect(provider.currentUser, isNull);
    expect(provider.currentSession, isNull);
    expect(coordinator.activeUserId, isNull);
    expect(storage.activeUserId, isNull);
    expect(resetCount, 2);
  });

  test(
    'keeps local UI unauthenticated when server logout cannot be confirmed',
    () async {
      final coordinator = UserScopedDataCoordinator(
        vocabularyStorage: VocabularyProgressStorage(),
        resetCallbacks: const [],
        loadCallbacks: const [],
      );
      final repository = _SessionAuthRepository()..logoutResult = false;
      final provider = AuthSessionProvider(
        repository: repository,
        userDataCoordinator: coordinator,
      );
      addTearDown(provider.dispose);

      await provider.setCurrentUser(_user('learner-b'));
      final logoutConfirmed = await provider.logout();

      expect(logoutConfirmed, isFalse);
      expect(provider.isAuthenticated, isFalse);
      expect(provider.currentUser, isNull);
      expect(coordinator.activeUserId, isNull);
    },
  );

  test('a late session restore cannot overwrite a newer login', () async {
    final coordinator = UserScopedDataCoordinator(
      vocabularyStorage: VocabularyProgressStorage(),
      resetCallbacks: const [],
      loadCallbacks: const [],
    );
    final repository = _DelayedAuthRepository();
    final provider = AuthSessionProvider(
      repository: repository,
      userDataCoordinator: coordinator,
    );
    addTearDown(provider.dispose);

    final pendingRestore = provider.restoreSession();
    await provider.setCurrentUser(_user('learner-b'));
    repository.restoreCompleter.complete(null);
    await pendingRestore;

    expect(provider.isAuthenticated, isTrue);
    expect(provider.currentUserId, 'learner-b');
    expect(coordinator.activeUserId, 'learner-b');
  });

  test('switching accounts invalidates a pending profile update', () async {
    final coordinator = UserScopedDataCoordinator(
      vocabularyStorage: VocabularyProgressStorage(),
      resetCallbacks: const [],
      loadCallbacks: const [],
    );
    final repository = _DelayedAuthRepository();
    final provider = AuthSessionProvider(
      repository: repository,
      userDataCoordinator: coordinator,
    );
    addTearDown(provider.dispose);

    await provider.setCurrentUser(_user('learner-a'));
    final pendingUpdate = provider.updateProfile(
      fullName: 'Stale profile name',
      phoneNumber: null,
    );
    expect(provider.isUpdatingProfile, isTrue);

    await provider.setCurrentUser(_user('learner-b'));
    expect(provider.isUpdatingProfile, isFalse);

    repository.profileCompleter.complete(
      _user('learner-a').copyWith(fullName: 'Stale profile name'),
    );
    expect(await pendingUpdate, isNull);
    expect(provider.currentUserId, 'learner-b');
    expect(provider.currentUser?.fullName, 'TOEIC Learner');
    expect(provider.isUpdatingProfile, isFalse);
  });
}

AppUser _user(String id) =>
    AppUser(id: id, fullName: 'TOEIC Learner', email: '$id@example.test');

class _SessionAuthRepository extends FakeAuthRepository {
  bool logoutResult = true;

  @override
  Future<bool> logout() async => logoutResult;
}

class _DelayedAuthRepository extends FakeAuthRepository {
  final Completer<AppUser?> restoreCompleter = Completer<AppUser?>();
  final Completer<AppUser> profileCompleter = Completer<AppUser>();

  @override
  Future<AppUser?> restoreSession() => restoreCompleter.future;

  @override
  Future<AppUser> updateProfile({
    required String userId,
    required String fullName,
    required String? phoneNumber,
  }) => profileCompleter.future;
}
