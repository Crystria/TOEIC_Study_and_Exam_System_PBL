module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'repo',
        'web',
        'admin-cms',
        'mobile',
        'gateway',
        'auth',
        'question-bank',
        'exam',
        'learning',
        'analytics',
        'ai-chatbox',
        'contracts',
        'common',
        'infra',
        'docs',
        'ci',
      ],
    ],
  },
};
