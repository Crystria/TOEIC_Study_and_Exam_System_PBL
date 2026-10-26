import 'package:flutter/material.dart';
import 'package:flutter/widget_previews.dart';

import 'theme/app_colors.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/home_screen.dart';
import 'screens/vocabulary_screen.dart';
import 'screens/mock_test_taking_screen.dart';
import 'screens/mock_test_result_screen.dart';
import 'screens/ai_chat_screen.dart';
import 'screens/mock_test_select_screen.dart';
import 'screens/explanation_screen.dart';

@Preview(name: 'TOEIC Master - Home')
Widget homeScreenPreview() {
  return const MaterialApp(home: HomeScreen());
}

@Preview(name: 'TOEIC Master - Login')
Widget loginScreenPreview() {
  return const MaterialApp(home: LoginScreen());
}

@Preview(name: 'TOEIC Master - Register')
Widget registerScreenPreview() {
  return const MaterialApp(home: RegisterScreen());
}

@Preview(name: 'TOEIC Master - Vocalubary')
Widget vocabularyScreenPreview() {
  return const MaterialApp(home: VocabularyScreen());
}

@Preview(name: 'TOEIC Master - Mock Test Select')
Widget mockTestSelectScreenPreview() {
  return const MaterialApp(home: MockTestSelectScreen());
}

@Preview(name: 'TOEIC Master - Mock Test Taking')
Widget mockTestTakingScreenPreview() {
  return const MaterialApp(home: MockTestTakingScreen());
}

@Preview(name: 'TOEIC Master - Mock Test Result')
Widget mockTestResultScreenPreview() {
  return const MaterialApp(home: MockTestResultScreen());
}

@Preview(name: 'TOEIC Master - Explanation')
Widget explanationScreenPreview() {
  return const MaterialApp(home: AnswerExplanationScreen());
}

@Preview(name: 'TOEIC Master - AI Chat')
Widget aiChatScreenPreview() {
  return const MaterialApp(home: AiChatScreen());
}

@Preview(name: 'TOEIC Master - Brand Color')
Widget brandColorPreview() {
  return const MaterialApp(
    home: Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.school, size: 64, color: AppColors.brand),
            SizedBox(height: 12),
            Text(
              'TOEIC Master',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.brand,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
