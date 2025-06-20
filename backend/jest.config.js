module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/__tests__/shared/jest.setup.js'],
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(test).ts'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/disabled/',
    '<rootDir>/node_modules/'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'jest.tsconfig.json'
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // 增加超时配置
  testTimeout: 30000, // 30秒
  setupFilesAfterEnv: ['<rootDir>/__tests__/shared/setup.ts'],
  // 防止测试进程挂起
  forceExit: true,
  detectOpenHandles: true,
  // 路径映射，简化测试文件中的导入
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/__tests__/$1'
  },
};