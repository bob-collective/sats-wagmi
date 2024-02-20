/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  collectCoverageFrom: ['packages/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  modulePathIgnorePatterns: ['apps/e2e'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          transform: {
            react: {
              runtime: 'automatic'
            }
          }
        }
      }
    ]
  },
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|jsx)$'],
  setupFilesAfterEnv: ['./scripts/setup-test.ts'],
  testTimeout: 10000,
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname']
};
