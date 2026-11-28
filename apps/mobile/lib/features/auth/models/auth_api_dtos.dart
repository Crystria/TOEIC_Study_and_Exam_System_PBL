import '../../../shared/models/app_user.dart';

Map<String, dynamic> authJsonMap(Object? value, {required String context}) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  throw FormatException('$context phải là một JSON object.');
}

String _requiredString(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('Thiếu hoặc sai kiểu trường $field.');
  }
  return value.trim();
}

DateTime _requiredDateTime(Map<String, dynamic> json, String field) {
  final raw = _requiredString(json, field);
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) throw FormatException('$field không phải ISO-8601.');
  return parsed.toUtc();
}

/// Matches Auth Service UserPresenter exactly.
class AuthUserDto {
  const AuthUserDto({
    required this.userId,
    required this.email,
    required this.fullName,
    required this.status,
    required this.roles,
    required this.createdAt,
    required this.updatedAt,
    this.phoneNumber,
    this.avatarKey,
    this.avatarUrl,
  });

  final String userId;
  final String email;
  final String fullName;
  final String status;
  final List<String> roles;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? phoneNumber;
  final String? avatarKey;
  final String? avatarUrl;

  factory AuthUserDto.fromObject(Object? value) {
    final json = authJsonMap(value, context: 'UserPresenter');
    final rawRoles = json['roles'];
    if (rawRoles is! List || rawRoles.any((role) => role is! String)) {
      throw const FormatException('roles phải là danh sách chuỗi.');
    }

    String? optionalString(String key) {
      final raw = json[key];
      if (raw == null) return null;
      if (raw is! String) {
        throw FormatException('$key có kiểu dữ liệu không hợp lệ.');
      }
      return raw;
    }

    final status = _requiredString(json, 'status');
    return AuthUserDto(
      userId: _requiredString(json, 'userId'),
      email: _requiredString(json, 'email'),
      fullName: _requiredString(json, 'fullName'),
      status: status,
      roles: List<String>.unmodifiable(rawRoles.cast<String>()),
      createdAt: _requiredDateTime(json, 'createdAt'),
      updatedAt: _requiredDateTime(json, 'updatedAt'),
      phoneNumber: optionalString('phoneNumber'),
      avatarKey: optionalString('avatarKey'),
      avatarUrl: optionalString('avatarUrl'),
    );
  }

  AppUser toDomain() => AppUser(
    id: userId,
    email: email,
    fullName: fullName,
    emailVerified: status.toUpperCase() == 'ACTIVE',
    phoneNumber: phoneNumber,
    avatarKey: avatarKey,
    avatarUrl: avatarUrl,
    status: status,
    roles: roles,
    createdAt: createdAt,
    updatedAt: updatedAt,
  );
}

/// Matches AuthService.issueTokens() response.
class AuthTokenResponseDto {
  const AuthTokenResponseDto({
    required this.user,
    required this.accessToken,
    required this.tokenType,
    required this.expiresIn,
    required this.refreshToken,
    required this.refreshExpiresIn,
  });

  final AuthUserDto user;
  final String accessToken;
  final String tokenType;
  final int expiresIn;
  final String refreshToken;
  final int refreshExpiresIn;

  factory AuthTokenResponseDto.fromObject(Object? value) {
    final json = authJsonMap(value, context: 'Auth token response');
    final tokenType = _requiredString(json, 'tokenType');
    if (tokenType.toLowerCase() != 'bearer') {
      throw const FormatException('Backend trả về token type không hỗ trợ.');
    }

    int positiveSeconds(String field) {
      final value = json[field];
      if (value is num && value > 0) return value.toInt();
      throw FormatException('$field phải là số giây dương.');
    }

    return AuthTokenResponseDto(
      user: AuthUserDto.fromObject(json['user']),
      accessToken: _requiredString(json, 'accessToken'),
      tokenType: tokenType,
      expiresIn: positiveSeconds('expiresIn'),
      refreshToken: _requiredString(json, 'refreshToken'),
      refreshExpiresIn: positiveSeconds('refreshExpiresIn'),
    );
  }
}

class AuthRegistrationResponseDto {
  const AuthRegistrationResponseDto({
    required this.user,
    required this.activationRequired,
  });

  final AuthUserDto user;
  final bool activationRequired;

  factory AuthRegistrationResponseDto.fromObject(Object? value) {
    final json = authJsonMap(value, context: 'Auth registration response');
    final activationRequired = json['activationRequired'];
    if (activationRequired is! bool) {
      throw const FormatException('activationRequired phải là boolean.');
    }
    return AuthRegistrationResponseDto(
      user: AuthUserDto.fromObject(json['user']),
      activationRequired: activationRequired,
    );
  }
}
