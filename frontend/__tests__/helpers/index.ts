/**
 * 前端测试辅助工具统一入口
 * 
 * 整合所有测试相关的辅助函数和Mock工具
 */

// React测试工具
export * from './test-utils';

// Mock工具
export { createComponentTestSocketMock, createUseSocketMock, validateUseSocketMock } from './mocks/useSocketMockFactory';
export { MemoryLeakDetector, createControllablePromise, createSafeRenderHelper } from './mocks/memory-test-utils';

// 重新导出常用的testing library函数
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';