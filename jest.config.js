const inspector = require('inspector');

// If we are debugging then extend the timeout to max value, otherwise use the default.
const testTimeout = inspector.url() ? 1e8 : undefined;

module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: ['<rootDir>/src/**/*.js'],
  collectCoverage: true,
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
  coveragePathIgnorePatterns: ['<rootDir>/test/', '/node_modules/'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testMatch: ['<rootDir>/test/unit/**/*.test.js'],
  verbose: true,
  maxWorkers: 1,
  testTimeout,
};
