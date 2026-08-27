/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo/virtual/env$': '<rootDir>/jest/expo-virtual-env-mock.js',
    '^yandex-mobile-ads$': '<rootDir>/jest/yandex-mobile-ads-mock.js',
  },
  collectCoverageFrom: [
    'src/domain/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  setupFiles: ['<rootDir>/jest/setup.js'],
}
