/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: process.env.P3_EXAM_DATABASE_URL ? [] : ['/exam.integration.spec.ts$'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  cacheDirectory: '../../node_modules/.cache/jest-exam',
  passWithNoTests: true,
  moduleNameMapper: {
    '^@toeic/common$': '<rootDir>/../../../packages/common/src',
  },
};
