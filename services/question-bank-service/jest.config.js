/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  cacheDirectory: '../../node_modules/.cache/jest-question-bank',
  testEnvironment: 'node',
  passWithNoTests: true,
  moduleNameMapper: { '^@toeic/common$': '<rootDir>/../../../packages/common/src' },
};
