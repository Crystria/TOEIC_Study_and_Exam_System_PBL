import 'package:flutter/foundation.dart';

class AppNavigationState {
  AppNavigationState._();

  static final ValueNotifier<bool> isFullScreenFlow =
  ValueNotifier<bool>(false);

  static final ValueNotifier<int?> requestedTabIndex =
  ValueNotifier<int?>(null);

  static void hideBottomNavigation() {
    isFullScreenFlow.value = true;
  }

  static void showBottomNavigation() {
    isFullScreenFlow.value = false;
  }

  static void requestTab(int index) {
    requestedTabIndex.value = index;
  }
}
