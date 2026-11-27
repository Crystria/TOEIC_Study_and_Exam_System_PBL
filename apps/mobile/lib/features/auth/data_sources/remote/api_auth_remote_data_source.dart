import '../../models/auth_api_dtos.dart';
import '../../models/avatar_api_dtos.dart';
import '../../requests/auth_request_dtos.dart';
import '../../services/auth_api_service.dart';
import '../auth_remote_data_source.dart';

/// HTTP implementation of the Auth remote data-source contract.
class ApiAuthRemoteDataSource implements AuthRemoteDataSource {
  ApiAuthRemoteDataSource({required AuthApiService service})
    : _service = service;

  final AuthApiService _service;

  @override
  Future<AuthRegistrationResponseDto> register(RegisterRequestDto request) =>
      _service.register(request);

  @override
  Future<AuthTokenResponseDto> login(LoginRequestDto request) =>
      _service.login(request);

  @override
  Future<AuthTokenResponseDto> refresh(RefreshRequestDto request) =>
      _service.refresh(request);

  @override
  Future<void> verifyEmail(VerifyEmailRequestDto request) =>
      _service.verifyEmail(request);

  @override
  Future<void> resendVerification(ResendVerificationRequestDto request) =>
      _service.resendVerification(request);

  @override
  Future<void> logout(RefreshRequestDto request) => _service.logout(request);

  @override
  Future<AuthUserDto> getCurrentUser() => _service.getCurrentUser();

  @override
  Future<AuthUserDto> updateCurrentUser(UpdateProfileRequestDto request) =>
      _service.updateCurrentUser(request);

  @override
  Future<AvatarUploadTicketDto> presignAvatar(
    AvatarPresignRequestDto request,
  ) => _service.presignAvatar(request);

  @override
  Future<void> uploadAvatar({
    required AvatarUploadTicketDto ticket,
    required String expectedContentType,
    required List<int> bytes,
  }) => _service.uploadAvatar(
    ticket: ticket,
    expectedContentType: expectedContentType,
    bytes: bytes,
  );

  @override
  Future<AvatarConfirmResponseDto> confirmAvatar(
    AvatarConfirmRequestDto request,
  ) => _service.confirmAvatar(request);
}
