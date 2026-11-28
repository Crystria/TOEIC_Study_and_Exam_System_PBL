/// Safe, user-displayable failure returned by an Auth repository operation.
class AuthRepositoryException implements Exception {
  const AuthRepositoryException(this.message);

  final String message;

  @override
  String toString() => message;
}
