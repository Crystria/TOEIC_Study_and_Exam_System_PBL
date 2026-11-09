import 'package:flutter_test/flutter_test.dart';
import 'package:toeic_mobile/core/network/endpoints.dart';

void main() {
  group('Endpoints', () {
    test('exposes Auth and current-user routes', () {
      expect(Endpoints.auth.register, 'auth/register');
      expect(Endpoints.auth.login, 'auth/login');
      expect(Endpoints.auth.refresh, 'auth/refresh');
      expect(Endpoints.auth.verifyEmail, 'auth/verify-email');
      expect(Endpoints.auth.resendVerification, 'auth/resend-verification');
      expect(Endpoints.auth.logout, 'auth/logout');
      expect(Endpoints.auth.getCurrentUser, 'users/me');
      expect(Endpoints.auth.updateCurrentUser, 'users/me');
      expect(Endpoints.auth.presignAvatarUpload, 'users/me/avatar/presign');
      expect(Endpoints.auth.confirmAvatarUpload, 'users/me/avatar/confirm');
    });

    test('exposes Learning content and progress routes', () {
      expect(
        Endpoints.learning.listVocabularyTopics,
        'learning/vocabulary-topics',
      );
      expect(
        Endpoints.learning.vocabularyTopic('topic-id'),
        'learning/vocabulary-topics/topic-id',
      );
      expect(Endpoints.learning.listVocabularies, 'learning/vocabularies');
      expect(
        Endpoints.learning.vocabulary('word-id'),
        'learning/vocabularies/word-id',
      );
      expect(Endpoints.learning.listLessons, 'learning/lessons');
      expect(
        Endpoints.learning.lesson('lesson-id'),
        'learning/lessons/lesson-id',
      );
      expect(Endpoints.learning.reviewToday, 'learning/review-today');
      expect(Endpoints.learning.progress, 'learning/progress');
      expect(
        Endpoints.learning.reviewFlashcard('card-id'),
        'learning/flashcards/card-id/review',
      );
      expect(
        Endpoints.learning.completeLesson('lesson-id'),
        'learning/lessons/lesson-id/complete',
      );
    });

    test('exposes Learning vocabulary-session lifecycle routes', () {
      expect(
        Endpoints.learning.createVocabularySession,
        'learning/vocabulary-sessions',
      );
      expect(
        Endpoints.learning.vocabularySession('session-id'),
        'learning/vocabulary-sessions/session-id',
      );
      expect(
        Endpoints.learning.reviewVocabularySession('session-id'),
        'learning/vocabulary-sessions/session-id/reviews',
      );
      expect(
        Endpoints.learning.submitVocabularySession('session-id'),
        'learning/vocabulary-sessions/session-id/submit',
      );
      expect(
        Endpoints.learning.cancelVocabularySession('session-id'),
        'learning/vocabulary-sessions/session-id/cancel',
      );
    });

    test('exposes Mock Test and attempt routes', () {
      expect(Endpoints.mockTest.listTests, 'tests');
      expect(Endpoints.mockTest.test('test-id'), 'tests/test-id');
      expect(Endpoints.mockTest.testParts('test-id'), 'tests/test-id/parts');
      expect(
        Endpoints.mockTest.createAttempt('test-id'),
        'tests/test-id/attempts',
      );
      expect(
        Endpoints.mockTest.createPartAttempt('test-id'),
        'tests/test-id/part-attempts',
      );
      expect(Endpoints.mockTest.listAttempts, 'attempts');
      expect(
        Endpoints.mockTest.saveDraft('attempt-id'),
        'attempts/attempt-id/draft',
      );
      expect(
        Endpoints.mockTest.saveAnswer('attempt-id', 'question-id'),
        'attempts/attempt-id/answers/question-id',
      );
      expect(
        Endpoints.mockTest.submitAttempt('attempt-id'),
        'attempts/attempt-id/submit',
      );
      expect(Endpoints.mockTest.attempt('attempt-id'), 'attempts/attempt-id');
    });

    test('exposes Analytics, AI Chat and Question Bank routes', () {
      expect(Endpoints.analytics.progress, 'analytics/progress');
      expect(Endpoints.analytics.scores, 'analytics/scores');
      expect(Endpoints.analytics.practices, 'analytics/practices');
      expect(Endpoints.analytics.streak, 'analytics/streak');
      expect(Endpoints.analytics.prediction, 'analytics/prediction');
      expect(Endpoints.analytics.weakAreas, 'analytics/weak-areas');

      expect(Endpoints.aiChat.conversations, 'ai/conversations');
      expect(Endpoints.aiChat.createConversation, 'ai/conversations');
      expect(
        Endpoints.aiChat.messages('conversation-id'),
        'ai/conversations/conversation-id/messages',
      );
      expect(
        Endpoints.aiChat.sendMessage('conversation-id'),
        'ai/conversations/conversation-id/messages',
      );
      expect(
        Endpoints.aiChat.deleteConversation('conversation-id'),
        'ai/conversations/conversation-id',
      );

      expect(Endpoints.questionBank.listQuestions, 'questions');
      expect(Endpoints.questionBank.listQuestionGroups, 'question-groups');
    });

    test('encodes dynamic route segments', () {
      expect(
        Endpoints.learning.vocabularyTopic('topic/with space'),
        'learning/vocabulary-topics/topic%2Fwith%20space',
      );
      expect(
        Endpoints.mockTest.saveAnswer('attempt?id', 'question#id'),
        'attempts/attempt%3Fid/answers/question%23id',
      );
    });

    test('rejects empty dynamic route segments', () {
      expect(
        () => Endpoints.learning.vocabularyTopic('  '),
        throwsArgumentError,
      );
      expect(
        () => Endpoints.mockTest.saveAnswer('attempt-id', ''),
        throwsArgumentError,
      );
    });

    test('all route paths are relative to the configured API base URL', () {
      final staticPaths = <String>[
        Endpoints.auth.register,
        Endpoints.auth.login,
        Endpoints.auth.refresh,
        Endpoints.auth.verifyEmail,
        Endpoints.auth.resendVerification,
        Endpoints.auth.logout,
        Endpoints.auth.getCurrentUser,
        Endpoints.auth.updateCurrentUser,
        Endpoints.auth.presignAvatarUpload,
        Endpoints.auth.confirmAvatarUpload,
        Endpoints.learning.listVocabularyTopics,
        Endpoints.learning.listVocabularies,
        Endpoints.learning.listLessons,
        Endpoints.learning.reviewToday,
        Endpoints.learning.progress,
        Endpoints.learning.createVocabularySession,
        Endpoints.mockTest.listTests,
        Endpoints.mockTest.listAttempts,
        Endpoints.analytics.progress,
        Endpoints.analytics.scores,
        Endpoints.analytics.practices,
        Endpoints.analytics.streak,
        Endpoints.analytics.prediction,
        Endpoints.analytics.weakAreas,
        Endpoints.aiChat.conversations,
        Endpoints.aiChat.createConversation,
        Endpoints.questionBank.listQuestions,
        Endpoints.questionBank.listQuestionGroups,
      ];

      for (final path in staticPaths) {
        expect(path, isNot(startsWith('/')));
        expect(path, isNot(startsWith('api/v1/')));
      }
    });
  });
}
