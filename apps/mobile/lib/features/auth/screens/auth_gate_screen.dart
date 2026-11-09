import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../theme/app_colors.dart';
import '../../home/screens/home_screen.dart';
import '../providers/auth_session_provider.dart';
import 'login_screen.dart';

/// Startup gate: restore persisted auth once, then replace with Home or Login.
class AuthGateScreen extends StatefulWidget {
  const AuthGateScreen({super.key});

  @override
  State<AuthGateScreen> createState() => _AuthGateScreenState();
}

class _AuthGateScreenState extends State<AuthGateScreen> {
  bool _isNavigating = false;
  AuthSessionProvider? _provider;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final provider = context.read<AuthSessionProvider>();
    if (!identical(provider, _provider)) {
      _provider?.removeListener(_handleStatusChanged);
      _provider = provider;
      provider.addListener(_handleStatusChanged);
    }
    _handleStatusChanged();
  }

  @override
  void dispose() {
    _provider?.removeListener(_handleStatusChanged);
    super.dispose();
  }

  void _handleStatusChanged() {
    if (!mounted || _isNavigating) return;
    final status = _provider?.status;
    if (status == AuthSessionStatus.authenticated) {
      _replaceWith(
        HomeScreen(loginRouteBuilder: (_) => const LoginScreen()),
      );
    } else if (status == AuthSessionStatus.unauthenticated) {
      _replaceWith(const LoginScreen());
    }
  }

  void _replaceWith(Widget screen) {
    if (_isNavigating) return;
    _isNavigating = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => screen),
      );
    });
  }

  void _retry() {
    _isNavigating = false;
    _provider?.restoreSession();
  }

  void _continueToLogin() => _replaceWith(const LoginScreen());

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AuthSessionProvider>();
    if (provider.status == AuthSessionStatus.error) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.cloud_off_outlined, size: 48),
                    const SizedBox(height: 16),
                    const Text(
                      'Không thể khôi phục phiên đăng nhập',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      provider.errorMessage ??
                          'Vui lòng kiểm tra kết nối và thử lại.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.slate500),
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _retry,
                      child: const Text('Thử khôi phục lại'),
                    ),
                    TextButton(
                      onPressed: _continueToLogin,
                      child: const Text('Chuyển đến đăng nhập'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return const Scaffold(
      backgroundColor: AppColors.bg,
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
