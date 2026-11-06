const path = require('node:path');

const ignoredPaths = [
  '/node_modules/',
  '/(?:tmp|temp|dist|build|coverage|generated|\\.test-build|\\.next[^/]*)/',
];
const shared = {
  rootDir: __dirname,
  testMatch: ['**/*.test.ts'],
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'cjs', 'json', 'node'],
  modulePathIgnorePatterns: ignoredPaths,
  testPathIgnorePatterns: ignoredPaths,
  coveragePathIgnorePatterns: [...ignoredPaths, '/tests/', '/test/', '/scripts/qa/'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.cjs'],
  moduleNameMapper: {
    '^node:test$': '<rootDir>/tests/node-test.cjs',
    '^@toeic/common$': '<rootDir>/packages/common/src',
  },
  clearMocks: true,
  restoreMocks: true,
  // Async cancellation/retry tests use real timers. Tests opt into a fake clock as needed.
  fakeTimers: { enableGlobally: false },
};

async function nextProject(app, displayName) {
  const dir = path.join(__dirname, 'apps', app);
  const nextJest = require(require.resolve('next/jest', { paths: [dir] }));
  // Next provides its own SWC transform and CSS, image, font and server-only mocks.
  return nextJest({ dir })({
    ...shared,
    displayName,
    roots: [`<rootDir>/apps/${app}`],
    moduleNameMapper: {
      ...shared.moduleNameMapper,
      '^@/(.*)$': `<rootDir>/apps/${app}/src/$1`,
    },
  })();
}

/** One entry point for every *.test.ts; framework-specific settings stay in this file. */
module.exports = async () => ({
  rootDir: __dirname,
  maxWorkers: 2,
  coverageDirectory: '<rootDir>/coverage/unit',
  coverageReporters: ['text-summary', 'json', 'json-summary', 'html', 'lcov'],
  projects: [
    await nextProject('web', 'web'),
    await nextProject('admin-cms', 'cms'),
    {
      ...shared,
      displayName: 'node',
      roots: ['<rootDir>'],
      testPathIgnorePatterns: [...ignoredPaths, '<rootDir>/apps/web/', '<rootDir>/apps/admin-cms/'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: {
              target: 'ES2022',
              module: 'CommonJS',
              moduleResolution: 'node',
              lib: ['ES2022', 'DOM'],
              types: ['node', 'jest'],
              jsx: 'react-jsx',
              esModuleInterop: true,
              experimentalDecorators: true,
              emitDecoratorMetadata: true,
              strictPropertyInitialization: false,
              isolatedModules: true,
            },
          },
        ],
      },
    },
  ],
});
