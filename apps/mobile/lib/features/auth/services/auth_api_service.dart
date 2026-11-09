// ignore_for_file: prefer_initializing_formals
import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/endpoints.dart';
import '../models/auth_api_dtos.dart';
import '../requests/auth_request_dtos.dart';

/// HTTP + JSON boundary for Auth and Profile. No session orchestration here.
class AuthApiService {
  AuthApiService({required ApiClient client}) : _client = client;

  final ApiClient _client;

  Options get _publicOptions => Options(
    extra: <String, dynamic>{ApiClient.skipAuthExtraKey: true},
  );

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

  Future<void> resendVerification(
    ResendVerificationRequestDto request,
  ) async {
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
    );
  }

  Future<AuthUserDto> getCurrentUser() async {
    final response = await _client.get<Object?>(Endpoints.auth.getCurrentUser);
    return AuthUserDto.fromObject(response.data);
  }

  Future<AuthUserDto> updateCurrentUser(
    UpdateProfileRequestDto request,
  ) async {
    final response = await _client.patch<Object?>(
      Endpoints.auth.updateCurrentUser,
      data: request.toJson(),
    );
    return AuthUserDto.fromObject(response.data);
  }
}
