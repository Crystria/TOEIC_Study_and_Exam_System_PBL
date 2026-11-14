import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../network/api_client.dart';
import '../storage/token_storage.dart';

/// Builds application-wide infrastructure dependencies (configuration,
/// secure token storage, and the shared API client). Feature repositories are
/// selected separately by `AppFeatureDependencies` at the composition root.
class AppDependencies {
  AppDependencies._({
    required this.config,
    required this.tokenStorage,
    required this.apiClient,
  });

  /// Khởi tạo các dependency dùng chung của ứng dụng.
  factory AppDependencies.fromEnvironment({
    AppConfig? config,
    TokenStorage? tokenStorage,
    HttpClientAdapter? adapter,
  }) {
    final resolvedConfig = config ?? AppConfig.fromEnvironment();

    final resolvedTokenStorage = tokenStorage ?? TokenStorage();

    final resolvedApiClient = ApiClient(
      config: resolvedConfig,
      tokenStorage: resolvedTokenStorage,
      adapter: adapter,
    );

    return AppDependencies._(
      config: resolvedConfig,
      tokenStorage: resolvedTokenStorage,
      apiClient: resolvedApiClient,
    );
  }

  final AppConfig config;
  final TokenStorage tokenStorage;
  final ApiClient apiClient;
}
