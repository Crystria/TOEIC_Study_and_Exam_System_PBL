/// Application environments used to load environment-specific settings.
enum AppEnvironment {
  development,
  staging,
  production;

  /// Parses an environment name supplied through a build-time define.
  static AppEnvironment parse(String value) {
    switch (value.trim().toLowerCase()) {
      case 'development':
      case 'dev':
        return AppEnvironment.development;
      case 'staging':
      case 'stage':
        return AppEnvironment.staging;
      case 'production':
      case 'prod':
        return AppEnvironment.production;
      default:
        throw FormatException(
          'Unsupported APP_ENV "$value". Use development, staging, or '
          'production.',
        );
    }
  }
}

/// Immutable application configuration loaded from Flutter build-time defines.
///
/// The API is disabled by default so the existing mock/local application flow
/// continues to work until a feature is explicitly connected to the backend.
/// No secret (API key, password, or signing credential) should be stored here:
/// values passed with --dart-define are bundled into the application.
class AppConfig {
  AppConfig({
    required this.environment,
    required String baseUrl,
    this.apiEnabled = false,
    this.connectTimeout = const Duration(seconds: 15),
    this.sendTimeout = const Duration(seconds: 20),
    this.receiveTimeout = const Duration(seconds: 20),
  }) : baseUrl = _normalizeBaseUrl(baseUrl) {
    _validate();
  }

  /// Loads configuration from compile-time values passed to Flutter.
  ///
  /// Supported defines:
  /// - APP_ENV: development | staging | production
  /// - API_ENABLED: true | false
  /// - API_BASE_URL: absolute HTTP(S) URL, normally ending in /api/v1
  /// - CONNECT_TIMEOUT_MS: connection timeout in milliseconds
  /// - SEND_TIMEOUT_MS: request-send timeout in milliseconds
  /// - RECEIVE_TIMEOUT_MS: response-receive timeout in milliseconds
  factory AppConfig.fromEnvironment() {
    return AppConfig(
      environment: AppEnvironment.parse(
        const String.fromEnvironment('APP_ENV', defaultValue: 'development'),
      ),
      baseUrl: const String.fromEnvironment('API_BASE_URL'),
      apiEnabled: const bool.fromEnvironment(
        'API_ENABLED',
        defaultValue: false,
      ),
      connectTimeout: Duration(
        milliseconds: const int.fromEnvironment(
          'CONNECT_TIMEOUT_MS',
          defaultValue: 15000,
        ),
      ),
      sendTimeout: Duration(
        milliseconds: const int.fromEnvironment(
          'SEND_TIMEOUT_MS',
          defaultValue: 20000,
        ),
      ),
      receiveTimeout: Duration(
        milliseconds: const int.fromEnvironment(
          'RECEIVE_TIMEOUT_MS',
          defaultValue: 20000,
        ),
      ),
    );
  }

  final AppEnvironment environment;
  final String baseUrl;
  final bool apiEnabled;
  final Duration connectTimeout;
  final Duration sendTimeout;
  final Duration receiveTimeout;

  bool get isDevelopment => environment == AppEnvironment.development;
  bool get isStaging => environment == AppEnvironment.staging;
  bool get isProduction => environment == AppEnvironment.production;

  /// Returns null when API mode is disabled and no base URL is configured.
  Uri? get baseUri => baseUrl.isEmpty ? null : Uri.parse(baseUrl);

  void _validate() {
    if (apiEnabled && baseUrl.isEmpty) {
      throw ArgumentError.value(
        baseUrl,
        'baseUrl',
        'API_BASE_URL is required when API_ENABLED=true.',
      );
    }

    if (connectTimeout.inMicroseconds <= 0) {
      throw ArgumentError.value(
        connectTimeout,
        'connectTimeout',
        'Timeout must be greater than zero.',
      );
    }

    if (sendTimeout.inMicroseconds <= 0) {
      throw ArgumentError.value(
        sendTimeout,
        'sendTimeout',
        'Timeout must be greater than zero.',
      );
    }

    if (receiveTimeout.inMicroseconds <= 0) {
      throw ArgumentError.value(
        receiveTimeout,
        'receiveTimeout',
        'Timeout must be greater than zero.',
      );
    }

    if (apiEnabled && isProduction && baseUri?.scheme != 'https') {
      throw ArgumentError.value(
        baseUrl,
        'baseUrl',
        'Production API_BASE_URL must use HTTPS.',
      );
    }
  }

  static String _normalizeBaseUrl(String value) {
    final trimmedValue = value.trim();
    if (trimmedValue.isEmpty) {
      return '';
    }

    final uri = Uri.tryParse(trimmedValue);
    if (uri == null ||
        !uri.hasScheme ||
        !uri.hasAuthority ||
        uri.host.isEmpty ||
        (uri.scheme != 'http' && uri.scheme != 'https') ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment) {
      throw ArgumentError.value(
        value,
        'baseUrl',
        'Expected an absolute HTTP(S) URL without credentials, query, or '
            'fragment.',
      );
    }

    final normalizedPath = uri.path.replaceFirst(RegExp(r'/+$'), '');
    return uri.replace(path: normalizedPath).toString();
  }
}
