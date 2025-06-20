/**
 * Vitest全局类型扩展
 * 用于测试环境的类型声明和上下文标识
 */

declare global {
  /**
   * 标识当前是否为服务测试上下文
   * 用于区分服务测试和组件测试的Mock行为
   */
  var __VITEST_SERVICE_TEST__: boolean | undefined;
  
  /**
   * 测试环境标识
   */
  var __VITEST_TEST_TYPE__: 'service' | 'component' | 'hook' | 'integration' | undefined;
}

export {};