import 'package:flutter/widgets.dart';

class AppNavigationState {
  AppNavigationState._();

  static final ValueNotifier<bool> isFullScreenFlow = ValueNotifier<bool>(
    false,
  );

  static final ValueNotifier<int?> requestedTabIndex = ValueNotifier<int?>(
    null,
  );

  static final Set<Object> _fullScreenOwners = <Object>{};

  /// Registers a route that should temporarily hide the Home bottom navigation.
  /// Owner tokens allow multiple full-screen routes to coexist safely.
  static void registerFullScreenRoute(Object owner) {
    final wasInactive = _fullScreenOwners.isEmpty;

    _fullScreenOwners.add(owner);

    if (wasInactive) {
      isFullScreenFlow.value = true;
    }
  }

  /// Releases a previously registered full-screen route.
  ///
  /// The owner is removed immediately, but the ValueNotifier is updated
  /// after the current frame to avoid notifying ValueListenableBuilder
  /// while Flutter is finalizing the widget tree.
  static void unregisterFullScreenRoute(Object owner) {
    final removed = _fullScreenOwners.remove(owner);

    if (!removed || _fullScreenOwners.isNotEmpty) {
      return;
    }

    final binding = WidgetsBinding.instance;
    binding.addPostFrameCallback((_) {
      // A new full-screen route may have registered before this callback.
      // Recheck the owner set to avoid showing the navigation bar too early.
      final shouldHideNavigation = _fullScreenOwners.isNotEmpty;

      if (isFullScreenFlow.value != shouldHideNavigation) {
        isFullScreenFlow.value = shouldHideNavigation;
      }
    });

    // addPostFrameCallback does not itself request a frame. Ensure the
    // deferred notifier update is processed even when no other frame is due.
    binding.ensureVisualUpdate();
  }

  /// Releases a full-screen route immediately.
  ///
  /// This method should be called from a route animation callback,
  /// not from State.dispose().
  static void unregisterFullScreenRouteNow(Object owner) {
    final removed = _fullScreenOwners.remove(owner);

    if (!removed || _fullScreenOwners.isNotEmpty) {
      return;
    }

    if (isFullScreenFlow.value) {
      isFullScreenFlow.value = false;
    }
  }

  /// Requests a tab change from a route hosted by the root Navigator.
  static void requestTab(int index) {
    requestedTabIndex.value = index;
  }

  /// Clears a request that can no longer be consumed by the current Home tree.
  /// This prevents a route transition (especially logout/root replacement)
  /// from carrying a stale tab request into a later authenticated session.
  static void clearPendingTabRequest() {
    if (requestedTabIndex.value != null) {
      requestedTabIndex.value = null;
    }
  }
}
