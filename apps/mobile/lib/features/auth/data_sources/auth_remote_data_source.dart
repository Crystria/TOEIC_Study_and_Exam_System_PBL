import '../models/auth_api_dtos.dart';
import '../models/avatar_api_dtos.dart';
import '../requests/auth_request_dtos.dart';

/// Backend boundary used by the API Auth repository.
///
/// The contract exposes transport DTOs only. It does not store credentials,
/// decide session state, or translate failures into Test Data results.
abstract interface class AuthRemoteDataSource {
  Future<AuthRegistrationResponseDto> register(RegisterRequestDto request);

  Future<AuthTokenResponseDto> login(LoginRequestDto request);

  Future<AuthTokenResponseDto> refresh(RefreshRequestDto request);

  Future<void> verifyEmail(VerifyEmailRequestDto request);

  Future<void> resendVerification(ResendVerificationRequestDto request);

  Future<void> logout(RefreshRequestDto request);

  Future<AuthUserDto> getCurrentUser();

  Future<AuthUserDto> updateCurrentUser(UpdateProfileRequestDto request);

  Future<AvatarUploadTicketDto> presignAvatar(AvatarPresignRequestDto request);

  Future<void> uploadAvatar({
    required AvatarUploadTicketDto ticket,
    required String expectedContentType,
    required List<int> bytes,
  });

  Future<AvatarConfirmResponseDto> confirmAvatar(
    AvatarConfirmRequestDto request,
  );
}
