/// Central registry of Backend API paths exposed by the API Gateway.
///
/// `AppConfig.baseUrl` is expected to contain the server origin and API prefix,
/// for example `https://api.example.com/api/v1`.
///
/// Every path in this file is relative to that base URL and deliberately has
/// no leading slash. When configuring Dio, B.5 must preserve a trailing slash
/// on `baseUrl` (for example, `'${config.baseUrl}/'`) so relative paths append
/// below `/api/v1` rather than replacing the final URL segment.
///
/// HTTP methods are documented on each route. This registry contains only
/// routes identified in the supplied Backend contract review; it does not
/// imply that every route is safe or intended for every app role.
abstract final class Endpoints {
  Endpoints._();

  static const AuthEndpoints auth = AuthEndpoints();
  static const LearningEndpoints learning = LearningEndpoints();
  static const MockTestEndpoints mockTest = MockTestEndpoints();
  static const AnalyticsEndpoints analytics = AnalyticsEndpoints();

  /// These routes must remain unused until the Backend owner confirms that
  /// conversation ownership is bound to the authenticated JWT subject.
  static const AiChatEndpoints aiChat = AiChatEndpoints();

  /// Question Bank routes may be role-restricted and are not required by the
  /// regular learner flow. Do not expose privileged operations through the UI.
  static const QuestionBankEndpoints questionBank = QuestionBankEndpoints();
}

/// Authentication and current-user endpoints.
final class AuthEndpoints {
  const AuthEndpoints();

  /// POST /api/v1/auth/register
  final String register = 'auth/register';

  /// POST /api/v1/auth/login
  final String login = 'auth/login';

  /// POST /api/v1/auth/refresh
  final String refresh = 'auth/refresh';

  /// POST /api/v1/auth/verify-email
  final String verifyEmail = 'auth/verify-email';

  /// POST /api/v1/auth/resend-verification
  final String resendVerification = 'auth/resend-verification';

  /// POST /api/v1/auth/logout
  final String logout = 'auth/logout';

  /// GET /api/v1/users/me
  final String getCurrentUser = 'users/me';

  /// PATCH /api/v1/users/me
  final String updateCurrentUser = 'users/me';

  /// PATCH /api/v1/users/me/avatar/presign
  final String presignAvatarUpload = 'users/me/avatar/presign';

  /// POST /api/v1/users/me/avatar/confirm
  final String confirmAvatarUpload = 'users/me/avatar/confirm';
}

/// Vocabulary content, progress, grammar and learning-session endpoints.
final class LearningEndpoints {
  const LearningEndpoints();

  /// GET /api/v1/learning/vocabulary-topics
  final String listVocabularyTopics = 'learning/vocabulary-topics';

  /// GET /api/v1/learning/vocabulary-topics/:id
  String vocabularyTopic(String topicId) =>
      'learning/vocabulary-topics/${_pathSegment(topicId, 'topicId')}';

  /// GET /api/v1/learning/vocabularies
  final String listVocabularies = 'learning/vocabularies';

  /// GET /api/v1/learning/vocabularies/:id
  String vocabulary(String vocabularyId) =>
      'learning/vocabularies/${_pathSegment(vocabularyId, 'vocabularyId')}';

  /// GET /api/v1/learning/lessons
  final String listLessons = 'learning/lessons';

  /// GET /api/v1/learning/lessons/:id
  String lesson(String lessonId) =>
      'learning/lessons/${_pathSegment(lessonId, 'lessonId')}';

  /// GET /api/v1/learning/review-today
  final String reviewToday = 'learning/review-today';

  /// GET /api/v1/learning/progress
  final String progress = 'learning/progress';

  /// POST /api/v1/learning/flashcards/:id/review
  String reviewFlashcard(String flashcardId) =>
      'learning/flashcards/${_pathSegment(flashcardId, 'flashcardId')}/review';

  /// POST /api/v1/learning/lessons/:id/complete
  String completeLesson(String lessonId) =>
      'learning/lessons/${_pathSegment(lessonId, 'lessonId')}/complete';

  /// POST /api/v1/learning/vocabulary-sessions
  final String createVocabularySession = 'learning/vocabulary-sessions';

  /// GET /api/v1/learning/vocabulary-sessions/:id
  String vocabularySession(String sessionId) =>
      'learning/vocabulary-sessions/${_pathSegment(sessionId, 'sessionId')}';

  /// POST /api/v1/learning/vocabulary-sessions/:id/reviews
  String reviewVocabularySession(String sessionId) =>
      '${vocabularySession(sessionId)}/reviews';

  /// POST /api/v1/learning/vocabulary-sessions/:id/submit
  String submitVocabularySession(String sessionId) =>
      '${vocabularySession(sessionId)}/submit';

  /// POST /api/v1/learning/vocabulary-sessions/:id/cancel
  String cancelVocabularySession(String sessionId) =>
      '${vocabularySession(sessionId)}/cancel';
}

/// TOEIC tests and attempt lifecycle endpoints.
final class MockTestEndpoints {
  const MockTestEndpoints();

  /// GET /api/v1/tests
  final String listTests = 'tests';

  /// GET /api/v1/tests/:id
  String test(String testId) => 'tests/${_pathSegment(testId, 'testId')}';

  /// GET /api/v1/tests/:testId/parts
  String testParts(String testId) => '${test(testId)}/parts';

  /// POST /api/v1/tests/:testId/attempts
  String createAttempt(String testId) => '${test(testId)}/attempts';

  /// POST /api/v1/tests/:testId/part-attempts
  String createPartAttempt(String testId) => '${test(testId)}/part-attempts';

  /// GET /api/v1/attempts
  final String listAttempts = 'attempts';

  /// PUT /api/v1/attempts/:attemptId/draft
  String saveDraft(String attemptId) =>
      'attempts/${_pathSegment(attemptId, 'attemptId')}/draft';

  /// PUT /api/v1/attempts/:attemptId/answers/:questionId
  String saveAnswer(String attemptId, String questionId) =>
      'attempts/${_pathSegment(attemptId, 'attemptId')}/answers/'
      '${_pathSegment(questionId, 'questionId')}';

  /// POST /api/v1/attempts/:attemptId/submit
  String submitAttempt(String attemptId) =>
      'attempts/${_pathSegment(attemptId, 'attemptId')}/submit';

  /// GET /api/v1/attempts/:attemptId
  String attempt(String attemptId) =>
      'attempts/${_pathSegment(attemptId, 'attemptId')}';
}

/// Read-only dashboard and analytics endpoints.
final class AnalyticsEndpoints {
  const AnalyticsEndpoints();

  /// GET /api/v1/analytics/progress
  final String progress = 'analytics/progress';

  /// GET /api/v1/analytics/scores
  final String scores = 'analytics/scores';

  /// GET /api/v1/analytics/practices
  final String practices = 'analytics/practices';

  /// GET /api/v1/analytics/streak
  final String streak = 'analytics/streak';

  /// GET /api/v1/analytics/prediction
  final String prediction = 'analytics/prediction';

  /// GET /api/v1/analytics/weak-areas
  final String weakAreas = 'analytics/weak-areas';
}

/// AI Chat paths present in the Backend contract.
///
/// SECURITY GATE: the reviewed AI routes accepted a client-supplied `user_id`
/// instead of consistently deriving ownership from the authenticated JWT
/// principal. Do not call these routes until the Backend owner confirms that
/// ownership and authorization are enforced server-side.
final class AiChatEndpoints {
  const AiChatEndpoints();

  /// GET /api/v1/ai/conversations
  final String conversations = 'ai/conversations';

  /// POST /api/v1/ai/conversations
  final String createConversation = 'ai/conversations';

  /// GET /api/v1/ai/conversations/:id/messages
  String messages(String conversationId) =>
      'ai/conversations/'
      '${_pathSegment(conversationId, 'conversationId')}/messages';

  /// POST /api/v1/ai/conversations/:id/messages
  String sendMessage(String conversationId) => messages(conversationId);

  /// DELETE /api/v1/ai/conversations/:id
  String deleteConversation(String conversationId) =>
      'ai/conversations/${_pathSegment(conversationId, 'conversationId')}';
}

/// Question Bank read routes. Backend role guards still apply.
final class QuestionBankEndpoints {
  const QuestionBankEndpoints();

  /// GET /api/v1/questions
  final String listQuestions = 'questions';

  /// GET /api/v1/question-groups
  final String listQuestionGroups = 'question-groups';
}

/// Validates and URL-encodes a dynamic route segment.
///
/// IDs are expected to be non-empty (the Backend may additionally require a
/// UUID). Encoding keeps reserved characters from changing the route shape.
String _pathSegment(String value, String argumentName) {
  final normalizedValue = value.trim();
  if (normalizedValue.isEmpty) {
    throw ArgumentError.value(
      value,
      argumentName,
      'Path segment must not be empty.',
    );
  }
  return Uri.encodeComponent(normalizedValue);
}
