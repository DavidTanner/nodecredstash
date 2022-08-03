const inspector = require('inspector');

// If we are debugging then extend the timeout to max value, otherwise use the default.
const testTimeout = inspector.url() ? 1e8 : undefined;

module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': '@swc/jest',
  },
  collectCoverageFrom: ['<rootDir>/src/**/*.ts'],
  collectCoverage: true,
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
  // setupFilesAfterEnv: ['<rootDir>/test/unit/utils/awsSetup.js'],
  coveragePathIgnorePatterns: ['<rootDir>/test/', '/node_modules/'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testMatch: [
    '<rootDir>/test/unit/**/*.test.js',
    '<rootDir>/test/unit/**/*.test.ts',
  ],
  verbose: true,
  maxWorkers: 1,
  testTimeout,
};
