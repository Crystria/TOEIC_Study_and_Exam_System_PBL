class LoginRequestDto {
  const LoginRequestDto({
    required this.email,
    required this.password,
    required this.deviceId,
  });

  final String email;
  final String password;
  final String deviceId;

  Map<String, dynamic> toJson() => {
    'email': email,
    'password': password,
    'deviceId': deviceId,
  };
}

class RegisterRequestDto {
  const RegisterRequestDto({
    required this.email,
    required this.password,
    required this.confirmPassword,
    required this.fullName,
  });

  final String email;
  final String password;
  final String confirmPassword;
  final String fullName;

  Map<String, dynamic> toJson() => {
    'email': email,
    'password': password,
    'confirmPassword': confirmPassword,
    'fullName': fullName,
  };
}

class RefreshRequestDto {
  const RefreshRequestDto({required this.refreshToken});

  final String refreshToken;

  Map<String, dynamic> toJson() => {'refreshToken': refreshToken};
}

class VerifyEmailRequestDto {
  const VerifyEmailRequestDto({required this.token});

  final String token;

  Map<String, dynamic> toJson() => {'token': token};
}

class ResendVerificationRequestDto {
  const ResendVerificationRequestDto({required this.email});

  final String email;

  Map<String, dynamic> toJson() => {'email': email};
}

class UpdateProfileRequestDto {
  const UpdateProfileRequestDto({this.fullName, this.phoneNumber});

  final String? fullName;
  final String? phoneNumber;

  Map<String, dynamic> toJson() => {
    if (fullName != null) 'fullName': fullName,
    // An explicit null tells Backend to clear the optional phone number.
    'phoneNumber': phoneNumber,
  };
}
