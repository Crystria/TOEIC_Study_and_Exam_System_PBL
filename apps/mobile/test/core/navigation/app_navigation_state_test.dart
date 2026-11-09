import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/navigation/app_navigation_state.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    AppNavigationState.clearPendingTabRequest();
    AppNavigationState.isFullScreenFlow.value = false;
  });

  testWidgets(
    'keeps navigation hidden until the last full-screen owner exits',
    (tester) async {
      final firstRoute = Object();
      final secondRoute = Object();

      AppNavigationState.registerFullScreenRoute(firstRoute);
      AppNavigationState.registerFullScreenRoute(secondRoute);
      expect(AppNavigationState.isFullScreenFlow.value, isTrue);

      AppNavigationState.unregisterFullScreenRoute(firstRoute);
      await tester.pump();
      expect(AppNavigationState.isFullScreenFlow.value, isTrue);

      AppNavigationState.unregisterFullScreenRoute(secondRoute);
      await tester.pump();
      expect(AppNavigationState.isFullScreenFlow.value, isFalse);
    },
  );

  test(
    'clears a tab request that cannot be consumed by the current Home tree',
    () {
      AppNavigationState.requestTab(3);
      expect(AppNavigationState.requestedTabIndex.value, 3);

      AppNavigationState.clearPendingTabRequest();
      expect(AppNavigationState.requestedTabIndex.value, isNull);
    },
  );
}
