/// Opaque credential snapshot exposed to the Auth repository.
class AuthStoredTokens {
  const AuthStoredTokens({
    required this.accessToken,
    this.refreshToken,
    this.accessTokenExpiresAt,
    this.refreshTokenExpiresAt,
  });

  final String accessToken;
  final String? refreshToken;
  final DateTime? accessTokenExpiresAt;
  final DateTime? refreshTokenExpiresAt;

  bool get hasRefreshToken => refreshToken != null;
}

/// Safe failure returned by local Auth persistence.
class AuthLocalDataSourceException implements Exception {
  const AuthLocalDataSourceException(this.message, {this.cause});

  final String message;
  final Object? cause;

  @override
  String toString() => 'AuthLocalDataSourceException: $message';
}

/// Local persistence boundary for real authentication credentials.
///
/// Implementations must keep tokens in platform secure storage. Credentials
/// must never be copied to SharedPreferences or ordinary app settings.
abstract interface class AuthLocalDataSource {
  Future<AuthStoredTokens?> readTokens();

  Future<String?> readAccessToken();

  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiresAt,
    DateTime? refreshTokenExpiresAt,
  });

  Future<bool> replaceTokensIfRefreshTokenMatches({
    required String expectedRefreshToken,
    required String accessToken,
    required String refreshToken,
    DateTime? accessTokenExpiresAt,
    DateTime? refreshTokenExpiresAt,
  });

  Future<bool> clearTokensIfAccessTokenMatches(String expectedAccessToken);

  Future<bool> clearTokensIfRefreshTokenMatches(String expectedRefreshToken);
}
