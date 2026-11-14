import '../../../../core/storage/token_storage.dart';
import 'auth_local_data_source.dart';

/// Production local data source backed by the app's secure TokenStorage.
class SecureAuthLocalDataSource implements AuthLocalDataSource {
  SecureAuthLocalDataSource({required TokenStorage tokenStorage})
    : _tokenStorage = tokenStorage;

  final TokenStorage _tokenStorage;

  @override
  Future<AuthStoredTokens?> readTokens() async {
    try {
      final tokens = await _tokenStorage.readTokens();
      if (tokens == null) return null;
      return AuthStoredTokens(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      );
    } on TokenStorageException catch (error) {
      throw AuthLocalDataSourceException(error.message, cause: error);
    }
  }

  @override
  Future<String?> readAccessToken() async {
    try {
      return await _tokenStorage.readAccessToken();
    } on TokenStorageException catch (error) {
      throw AuthLocalDataSourceException(error.message, cause: error);
    }
  }

  @override
  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiresAt,
    DateTime? refreshTokenExpiresAt,
  }) async {
    try {
      await _tokenStorage.saveTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
        accessTokenExpiresAt: accessTokenExpiresAt,
        refreshTokenExpiresAt: refreshTokenExpiresAt,
      );
    } on TokenStorageException catch (error) {
      throw AuthLocalDataSourceException(error.message, cause: error);
    }
  }

  @override
  Future<bool> replaceTokensIfRefreshTokenMatches({
    required String expectedRefreshToken,
    required String accessToken,
    required String refreshToken,
    DateTime? accessTokenExpiresAt,
    DateTime? refreshTokenExpiresAt,
  }) async {
    try {
      return await _tokenStorage.replaceTokensIfRefreshTokenMatches(
        expectedRefreshToken: expectedRefreshToken,
        accessToken: accessToken,
        refreshToken: refreshToken,
        accessTokenExpiresAt: accessTokenExpiresAt,
        refreshTokenExpiresAt: refreshTokenExpiresAt,
      );
    } on TokenStorageException catch (error) {
      throw AuthLocalDataSourceException(error.message, cause: error);
    }
  }

  @override
  Future<bool> clearTokensIfAccessTokenMatches(
    String expectedAccessToken,
  ) async {
    try {
      return await _tokenStorage.clearTokensIfAccessTokenMatches(
        expectedAccessToken,
      );
    } on TokenStorageException catch (error) {
      throw AuthLocalDataSourceException(error.message, cause: error);
    }
  }

  @override
  Future<bool> clearTokensIfRefreshTokenMatches(
    String expectedRefreshToken,
  ) async {
    try {
      return await _tokenStorage.clearTokensIfRefreshTokenMatches(
        expectedRefreshToken,
      );
    } on TokenStorageException catch (error) {
      throw AuthLocalDataSourceException(error.message, cause: error);
    }
  }
}
