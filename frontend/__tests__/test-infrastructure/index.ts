/**
 * 前端测试公共基建入口文件
 * 
 * 这个模块提供了前端测试的所有公共工具和基建设施：
 * - Socket测试模拟器
 * - 内存泄漏检测工具
 * - React组件测试工具
 * - 异步测试辅助函数
 */

// Socket测试相关
export { SocketMockFactory } from './socket/SocketMockFactory';
export { createSocketTestUtils } from './socket/socketTestUtils';
export type { MockSocketInstance, SocketTestScenario } from './socket/types';

// 内存管理相关
export { MemoryLeakDetector, createControllablePromise, createSafeRenderHelper } from './memory/memoryTestUtils';

// React测试相关
export { createTestWrapper, renderWithWrapper } from './react/testWrappers';
export { createMockStores } from './react/mockStores';

// 异步测试相关
export { AsyncTestUtils, TimeoutManager } from './async/asyncTestUtils';

// 通用测试工具
export { TestLogger } from './utils/testLogger';
export { MockDataFactory } from './utils/mockDataFactory';

// 类型定义
export type { TestScenario, TestContext, MockConfig } from './types/common';