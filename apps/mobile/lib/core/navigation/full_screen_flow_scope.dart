import 'package:flutter/widgets.dart';

import 'app_navigation_state.dart';

/// Marks a route as a full-screen flow so the Home bottom navigation stays
/// hidden for the entire lifetime of that route.
///
/// Route animation status is used to synchronize navigation visibility
/// with the route transition lifecycle.
class FullScreenFlowScope extends StatefulWidget {
  const FullScreenFlowScope({super.key, required this.child});

  final Widget child;

  @override
  State<FullScreenFlowScope> createState() => _FullScreenFlowScopeState();
}

class _FullScreenFlowScopeState extends State<FullScreenFlowScope> {
  bool _isRegistered = false;

  Animation<double>? _routeAnimation;

  @override
  void initState() {
    super.initState();

    // Initial registration is deferred until the first frame finishes
    // to avoid notifying Home's ValueListenableBuilder during route build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;

      _registerFullScreenRoute();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final nextAnimation = ModalRoute.of(context)?.animation;

    if (identical(nextAnimation, _routeAnimation)) {
      return;
    }

    _routeAnimation?.removeStatusListener(_handleRouteAnimationStatus);

    _routeAnimation = nextAnimation;

    _routeAnimation?.addStatusListener(_handleRouteAnimationStatus);
  }

  void _handleRouteAnimationStatus(AnimationStatus status) {
    switch (status) {
      case AnimationStatus.forward:
      case AnimationStatus.completed:
        _registerFullScreenRoute();
        break;

      case AnimationStatus.dismissed:
        _unregisterFullScreenRouteImmediately();
        break;

      case AnimationStatus.reverse:
        // Keep navigation hidden while the route is closing.
        break;
    }
  }

  void _registerFullScreenRoute() {
    if (_isRegistered) return;

    _isRegistered = true;

    AppNavigationState.registerFullScreenRoute(this);
  }

  void _unregisterFullScreenRouteImmediately() {
    if (!_isRegistered) return;

    _isRegistered = false;

    AppNavigationState.unregisterFullScreenRouteNow(this);
  }

  @override
  void dispose() {
    _routeAnimation?.removeStatusListener(_handleRouteAnimationStatus);

    // Fallback for routes removed without completing their normal
    // reverse animation lifecycle.
    if (_isRegistered) {
      _isRegistered = false;

      AppNavigationState.unregisterFullScreenRoute(this);
    }

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
