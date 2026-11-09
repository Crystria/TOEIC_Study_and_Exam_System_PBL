import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:toeic_mobile/app.dart';
import 'package:toeic_mobile/core/config/app_config.dart';
import 'package:toeic_mobile/core/session/user_scoped_data_coordinator.dart';
import 'package:toeic_mobile/core/storage/vocabulary_progress_storage.dart';
import 'package:toeic_mobile/features/auth/providers/auth_session_provider.dart';
import 'package:toeic_mobile/features/auth/providers/login_provider.dart';
import 'package:toeic_mobile/features/auth/repositories/fake_auth_repository.dart';

void main() {
  testWidgets('TOEIC Master displays the login screen', (
    WidgetTester tester,
  ) async {
    final repository = FakeAuthRepository();
    final coordinator = UserScopedDataCoordinator(
      vocabularyStorage: VocabularyProgressStorage(),
      resetCallbacks: const [],
      loadCallbacks: const [],
    );
    final sessionProvider = AuthSessionProvider(
      repository: repository,
      userDataCoordinator: coordinator,
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider<AppConfig>.value(
            value: AppConfig(
              environment: AppEnvironment.development,
              baseUrl: '',
              apiEnabled: false,
            ),
          ),
          ChangeNotifierProvider<AuthSessionProvider>.value(
            value: sessionProvider,
          ),
          ChangeNotifierProvider(
            create: (_) => LoginProvider(repository: repository),
          ),
        ],
        child: const ToeicMobileApp(),
      ),
    );

    await sessionProvider.restoreSession();
    await tester.pumpAndSettle();

    expect(find.text('TOEIC Master'), findsOneWidget);
    expect(find.text('Email hoặc tên đăng nhập'), findsOneWidget);
    expect(find.text('Mật khẩu'), findsOneWidget);
    expect(find.text('Đăng nhập'), findsOneWidget);

    final loginButton = find.widgetWithText(ElevatedButton, 'Đăng nhập');
    await tester.ensureVisible(loginButton);
    await tester.tap(loginButton);
    await tester.pumpAndSettle();

    expect(find.text('Vui lòng nhập email hoặc tên đăng nhập'), findsOneWidget);
    expect(find.text('Vui lòng nhập mật khẩu'), findsOneWidget);
  });
}
