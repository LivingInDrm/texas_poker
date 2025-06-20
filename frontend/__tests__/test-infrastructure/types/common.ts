/**
 * 前端测试基建的通用类型定义
 */

// 测试场景基本接口
export interface TestScenario {
  name: string;
  description: string;
  setup?: () => void | Promise<void>;
  teardown?: () => void | Promise<void>;
  timeout?: number;
}

// 测试上下文
export interface TestContext {
  testId: string;
  startTime: number;
  mockInstances: Map<string, any>;
  resources: Set<any>;
}

// Mock配置
export interface MockConfig {
  strict?: boolean; // 严格模式，所有调用都必须预期
  autoCleanup?: boolean; // 自动清理
  logCalls?: boolean; // 记录所有调用
}

// 异步操作配置
export interface AsyncConfig {
  timeout: number;
  retries?: number;
  interval?: number;
}

// 内存检测配置
export interface MemoryConfig {
  checkTimers?: boolean;
  checkListeners?: boolean;
  checkPromises?: boolean;
  threshold?: number; // 内存使用阈值
}

// 测试报告
export interface TestReport {
  testName: string;
  duration: number;
  memoryUsage: {
    before: number;
    after: number;
    peak: number;
  };
  mocksUsed: string[];
  warnings: string[];
  errors: string[];
}