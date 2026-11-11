// ignore_for_file: prefer_initializing_formals
import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/endpoints.dart';
import '../models/auth_api_dtos.dart';
import '../models/avatar_api_dtos.dart';
import '../requests/auth_request_dtos.dart';
import 'avatar_upload_transport.dart';

/// HTTP + JSON boundary for Auth and Profile. No session orchestration here.
class AuthApiService {
  AuthApiService({
    required ApiClient client,
    AvatarUploadTransport? avatarUploadTransport,
  }) : _client = client,
       _avatarUploadTransport =
           avatarUploadTransport ?? DioAvatarUploadTransport();

  final ApiClient _client;
  final AvatarUploadTransport _avatarUploadTransport;

  Options get _publicOptions =>
      Options(extra: <String, dynamic>{ApiClient.skipAuthExtraKey: true});

  Future<AuthRegistrationResponseDto> register(
    RegisterRequestDto request,
  ) async {
    final response = await _client.post<Object?>(
      Endpoints.auth.register,
      data: request.toJson(),
      options: _publicOptions,
    );
    return AuthRegistrationResponseDto.fromObject(response.data);
  }

  Future<AuthTokenResponseDto> login(LoginRequestDto request) async {
    final response = await _client.post<Object?>(
      Endpoints.auth.login,
      data: request.toJson(),
      options: _publicOptions,
    );
    return AuthTokenResponseDto.fromObject(response.data);
  }

  Future<AuthTokenResponseDto> refresh(RefreshRequestDto request) async {
    final response = await _client.post<Object?>(
      Endpoints.auth.refresh,
      data: request.toJson(),
      options: _publicOptions,
    );
    return AuthTokenResponseDto.fromObject(response.data);
  }

  Future<void> verifyEmail(VerifyEmailRequestDto request) async {
    await _client.post<Object?>(
      Endpoints.auth.verifyEmail,
      data: request.toJson(),
      options: _publicOptions,
    );
  }

  Future<void> resendVerification(ResendVerificationRequestDto request) async {
    await _client.post<Object?>(
      Endpoints.auth.resendVerification,
      data: request.toJson(),
      options: _publicOptions,
    );
  }

  Future<void> logout(RefreshRequestDto request) async {
    await _client.post<Object?>(
      Endpoints.auth.logout,
      data: request.toJson(),
      options: Options(
        extra: <String, dynamic>{ApiClient.skipAuthRefreshExtraKey: true},
      ),
    );
  }

  Future<AuthUserDto> getCurrentUser() async {
    final response = await _client.get<Object?>(Endpoints.auth.getCurrentUser);
    return AuthUserDto.fromObject(response.data);
  }

  Future<AuthUserDto> updateCurrentUser(UpdateProfileRequestDto request) async {
    final response = await _client.patch<Object?>(
      Endpoints.auth.updateCurrentUser,
      data: request.toJson(),
    );
    return AuthUserDto.fromObject(response.data);
  }

  Future<AvatarUploadTicketDto> presignAvatar(
    AvatarPresignRequestDto request,
  ) async {
    final response = await _client.patch<Object?>(
      Endpoints.auth.presignAvatarUpload,
      data: request.toJson(),
    );
    return AvatarUploadTicketDto.fromObject(response.data);
  }

  Future<void> uploadAvatar({
    required AvatarUploadTicketDto ticket,
    required String expectedContentType,
    required List<int> bytes,
  }) async {
    if (bytes.isEmpty || bytes.length > AvatarUploadConstraints.maxBytes) {
      throw ArgumentError.value(
        bytes.length,
        'bytes.length',
        'Avatar must be between 1 byte and 2 MiB.',
      );
    }
    if (!ticket.expiresAt.isAfter(DateTime.now().toUtc())) {
      throw const FormatException('Avatar upload ticket đã hết hạn.');
    }

    String? signedContentType;
    for (final entry in ticket.requiredHeaders.entries) {
      if (entry.key.toLowerCase() == 'content-type') {
        signedContentType = entry.value;
        break;
      }
    }
    if (signedContentType == null ||
        signedContentType.toLowerCase() != expectedContentType.toLowerCase()) {
      throw const FormatException(
        'Content-Type không khớp với avatar upload ticket.',
      );
    }

    await _avatarUploadTransport.put(
      uri: ticket.putUrl,
      headers: ticket.requiredHeaders,
      contentType: signedContentType,
      bytes: bytes,
    );
  }

  Future<AvatarConfirmResponseDto> confirmAvatar(
    AvatarConfirmRequestDto request,
  ) async {
    final response = await _client.post<Object?>(
      Endpoints.auth.confirmAvatarUpload,
      data: request.toJson(),
    );
    return AvatarConfirmResponseDto.fromObject(response.data);
  }
}
