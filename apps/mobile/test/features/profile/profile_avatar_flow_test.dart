import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:toeic_mobile/core/config/app_config.dart';
import 'package:toeic_mobile/core/session/user_scoped_data_coordinator.dart';
import 'package:toeic_mobile/core/storage/vocabulary_progress_storage.dart';
import 'package:toeic_mobile/features/auth/providers/auth_session_provider.dart';
import 'package:toeic_mobile/features/auth/repositories/fake_auth_repository.dart';
import 'package:toeic_mobile/features/profile/screens/profile_screen.dart';
import 'package:toeic_mobile/features/profile/services/avatar_image_source.dart';
import 'package:toeic_mobile/shared/models/app_user.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  testWidgets('Profile UI sends a selected image through AuthSessionProvider', (
    tester,
  ) async {
    final repository = _AvatarRepository();
    final sessionProvider = AuthSessionProvider(
      repository: repository,
      userDataCoordinator: UserScopedDataCoordinator(
        vocabularyStorage: VocabularyProgressStorage(),
        resetCallbacks: const [],
        loadCallbacks: const [],
      ),
    );
    addTearDown(sessionProvider.dispose);
    await sessionProvider.setCurrentUser(
      const AppUser(
        id: 'profile-user',
        fullName: 'TOEIC Learner',
        email: 'learner@example.test',
      ),
    );

    final appConfig = AppConfig(
      environment: AppEnvironment.development,
      baseUrl: 'https://api.example.test',
      authApiEnabled: true,
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthSessionProvider>.value(
            value: sessionProvider,
          ),
          Provider<AppConfig>.value(value: appConfig),
        ],
        child: MaterialApp(
          home: ProfileScreen(
            loginRouteBuilder: (_) => const Scaffold(body: Text('Login')),
            avatarImageSource: _FakeAvatarImageSource(),
          ),
        ),
      ),
    );

    await tester.tap(find.byTooltip('Thay đổi ảnh đại diện'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(repository.receivedUserId, 'profile-user');
    expect(repository.receivedContentType, 'image/jpeg');
    expect(repository.receivedBytes, const [0xff, 0xd8, 0xff, 0x00]);
    expect(sessionProvider.currentUser?.avatarKey, 'avatars/profile-user.jpg');
    expect(find.text('Đã cập nhật ảnh đại diện.'), findsOneWidget);
  });

  testWidgets(
    'hides avatar upload when the current session is unauthenticated',
    (tester) async {
      final source = _FakeAvatarImageSource();
      final sessionProvider = AuthSessionProvider(
        repository: _AvatarRepository(),
        userDataCoordinator: UserScopedDataCoordinator(
          vocabularyStorage: VocabularyProgressStorage(),
          resetCallbacks: const [],
          loadCallbacks: const [],
        ),
      );
      addTearDown(sessionProvider.dispose);

      final appConfig = AppConfig(
        environment: AppEnvironment.development,
        baseUrl: 'https://api.example.test',
        authApiEnabled: true,
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<AuthSessionProvider>.value(
              value: sessionProvider,
            ),
            Provider<AppConfig>.value(value: appConfig),
          ],
          child: MaterialApp(
            home: ProfileScreen(
              loginRouteBuilder: (_) => const Scaffold(body: Text('Login')),
              avatarImageSource: source,
            ),
          ),
        ),
      );

      expect(sessionProvider.isAuthenticated, isFalse);
      expect(find.byTooltip('Thay đổi ảnh đại diện'), findsNothing);
      expect(find.text('Đổi ảnh đại diện'), findsNothing);
      expect(source.callCount, 0);
    },
  );

  testWidgets('hides avatar upload while Auth API is disabled', (tester) async {
    final source = _FakeAvatarImageSource();
    final sessionProvider = AuthSessionProvider(
      repository: _AvatarRepository(),
      userDataCoordinator: UserScopedDataCoordinator(
        vocabularyStorage: VocabularyProgressStorage(),
        resetCallbacks: const [],
        loadCallbacks: const [],
      ),
    );
    addTearDown(sessionProvider.dispose);
    await sessionProvider.setCurrentUser(
      const AppUser(
        id: 'offline-user',
        fullName: 'Offline Learner',
        email: 'offline@example.test',
      ),
    );

    final appConfig = AppConfig(
      environment: AppEnvironment.development,
      baseUrl: '',
      authApiEnabled: false,
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthSessionProvider>.value(
            value: sessionProvider,
          ),
          Provider<AppConfig>.value(value: appConfig),
        ],
        child: MaterialApp(
          home: ProfileScreen(
            loginRouteBuilder: (_) => const Scaffold(body: Text('Login')),
            avatarImageSource: source,
          ),
        ),
      ),
    );

    expect(find.byTooltip('Thay đổi ảnh đại diện'), findsNothing);
    expect(find.text('Đổi ảnh đại diện'), findsNothing);
    expect(source.callCount, 0);
  });
}

class _FakeAvatarImageSource implements AvatarImageSource {
  int callCount = 0;

  @override
  Future<AvatarImageSelection?> pickFromGallery() async {
    callCount++;
    return AvatarImageSelection(
      bytes: const [0xff, 0xd8, 0xff, 0x00],
      contentType: 'image/jpeg',
    );
  }
}

class _AvatarRepository extends FakeAuthRepository {
  String? receivedUserId;
  String? receivedContentType;
  List<int>? receivedBytes;

  @override
  Future<AppUser> updateAvatar({
    required String userId,
    required List<int> imageBytes,
    required String contentType,
  }) async {
    receivedUserId = userId;
    receivedContentType = contentType;
    receivedBytes = List<int>.of(imageBytes);
    return AppUser(
      id: userId,
      fullName: 'TOEIC Learner',
      email: 'learner@example.test',
      avatarKey: 'avatars/$userId.jpg',
    );
  }
}
