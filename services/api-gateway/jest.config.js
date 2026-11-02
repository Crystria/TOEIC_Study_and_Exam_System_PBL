/** @type {import('jest').Config} */
module.exports = {
  cacheDirectory: '<rootDir>/../../../node_modules/.cache/jest-gateway',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  passWithNoTests: true,
  moduleNameMapper: {
    '^@toeic/common$': '<rootDir>/../../../packages/common/src',
  },
};
