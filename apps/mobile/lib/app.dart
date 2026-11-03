import 'package:flutter/material.dart';

import 'theme/app_colors.dart';
import 'features/auth/screens/login_screen.dart';

class ToeicMobileApp extends StatelessWidget {
  const ToeicMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder border(Color color) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: color),
    );

    return MaterialApp(
      title: 'TOEIC Master',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: AppColors.brand)
            .copyWith(primary: AppColors.brand),
        scaffoldBackgroundColor: Colors.white,
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.slate50,
          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 16,
          ),
          border: border(AppColors.slate200),
          enabledBorder: border(AppColors.slate200),
          focusedBorder: border(AppColors.brand),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.brand,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(48),
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF0F172A),
            minimumSize: const Size.fromHeight(48),
            side: const BorderSide(color: AppColors.slate200),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
      home: const LoginScreen(),
    );
  }
}
