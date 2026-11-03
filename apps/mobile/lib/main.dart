import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';

import 'features/auth/providers/login_provider.dart';
import 'features/auth/providers/forgot_password_provider.dart';
import 'features/auth/providers/reset_password_provider.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => LoginProvider(),
        ),
        ChangeNotifierProvider(
          create: (_) => ForgotPasswordProvider(),
        ),
        ChangeNotifierProvider(
          create: (_) => ResetPasswordProvider(),
        ),
      ],
      child: const ToeicMobileApp(),
    ),
  );
}
