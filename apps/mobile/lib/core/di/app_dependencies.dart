import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../network/api_client.dart';
import '../storage/token_storage.dart';

/// Composition root quản lý các dependency cấp ứng dụng.
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
