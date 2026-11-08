import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'core/storage/vocabulary_progress_storage.dart';
import 'features/ai_chat/ai_chat_dependencies.dart';
import 'features/ai_chat/providers/ai_chat_history_provider.dart';
import 'features/ai_chat/providers/ai_chat_provider.dart';
import 'features/auth/providers/auth_session_provider.dart';
import 'features/auth/providers/change_password_provider.dart';
import 'features/auth/repositories/fake_auth_repository.dart';
import 'features/auth/providers/email_verification_provider.dart';
import 'features/auth/providers/forgot_password_provider.dart';
import 'features/auth/providers/login_provider.dart';
import 'features/auth/providers/register_provider.dart';
import 'features/auth/providers/reset_password_provider.dart';
import 'features/learning/providers/grammar_lesson_provider.dart';
import 'features/learning/providers/grammar_list_provider.dart';
import 'features/learning/providers/quick_quiz_provider.dart';
import 'features/learning/providers/review_flashcard_provider.dart';
import 'features/learning/providers/review_select_words_provider.dart';
import 'features/learning/providers/vocabulary_provider.dart';
import 'features/learning/providers/vocabulary_topic_provider.dart';

void main() {
  final vocabularyProgressStorage = VocabularyProgressStorage();
  final authRepository = FakeAuthRepository();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthSessionProvider()),
        ChangeNotifierProvider(
          create: (_) => LoginProvider(repository: authRepository),
        ),
        ChangeNotifierProvider(
          create: (_) => RegisterProvider(repository: authRepository),
        ),
        ChangeNotifierProvider(
          create: (_) => ForgotPasswordProvider(repository: authRepository),
        ),
        ChangeNotifierProvider(
          create: (_) => ResetPasswordProvider(repository: authRepository),
        ),
        ChangeNotifierProvider(
          create: (_) => ChangePasswordProvider(repository: authRepository),
        ),
        ChangeNotifierProvider(
          create: (_) => EmailVerificationProvider(repository: authRepository),
        ),
        ChangeNotifierProvider(
          create: (_) =>
              AiChatHistoryProvider(repository: AiChatDependencies.repository),
        ),
        ChangeNotifierProvider(
          create: (_) =>
              AiChatProvider(repository: AiChatDependencies.repository),
        ),
        // Shared above MaterialApp so nested tab Navigators inherit these.
        ChangeNotifierProvider(
          create: (_) =>
              VocabularyTopicsProvider(storage: vocabularyProgressStorage)
                ..initialize(),
        ),
        ChangeNotifierProvider(
          create: (_) =>
              VocabularyProvider(storage: vocabularyProgressStorage)
                ..initialize(),
        ),
        ChangeNotifierProvider(create: (_) => GrammarListProvider()),
        ChangeNotifierProvider(create: (_) => GrammarLessonProvider()),
        ChangeNotifierProvider(create: (_) => QuickQuizProvider()),
        ChangeNotifierProvider(create: (_) => ReviewSelectWordsProvider()),
        ChangeNotifierProvider(create: (_) => ReviewFlashcardProvider()),
      ],
      child: const ToeicMobileApp(),
    ),
  );
}
