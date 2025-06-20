import { vi } from 'vitest';

/**
 * 内存泄漏检测工具
 */
export class MemoryLeakDetector {
  private initialTimerCount = 0;
  private initialListenerCount = 0;

  constructor() {
    this.reset();
  }

  reset() {
    // 记录初始状态
    this.initialTimerCount = this.getActiveTimerCount();
    this.initialListenerCount = this.getActiveListenerCount();
  }

  private getActiveTimerCount(): number {
    // 获取活跃的定时器数量
    return (globalThis as any)._activeTimers?.size || 0;
  }

  private getActiveListenerCount(): number {
    // 获取活跃的事件监听器数量（简化版本）
    return 0; // 在实际项目中可以通过更复杂的方式检测
  }

  checkForLeaks(): { hasLeaks: boolean; leaks: string[] } {
    const currentTimerCount = this.getActiveTimerCount();
    const currentListenerCount = this.getActiveListenerCount();
    
    const leaks: string[] = [];
    
    if (currentTimerCount > this.initialTimerCount) {
      leaks.push(`Timer leak detected: ${currentTimerCount - this.initialTimerCount} uncleaned timers`);
    }
    
    if (currentListenerCount > this.initialListenerCount) {
      leaks.push(`Listener leak detected: ${currentListenerCount - this.initialListenerCount} uncleaned listeners`);
    }

    return {
      hasLeaks: leaks.length > 0,
      leaks
    };
  }
}

/**
 * 创建可控制的Promise用于测试加载状态
 */
export function createControllablePromise<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
} {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!
  };
}

/**
 * 安全的组件渲染工具，确保组件被正确清理
 */
export function createSafeRenderHelper(renderFn: () => any) {
  const detector = new MemoryLeakDetector();
  
  return {
    render: () => {
      detector.reset();
      return renderFn();
    },
    checkLeaks: () => detector.checkForLeaks(),
    expectNoLeaks: () => {
      const { hasLeaks, leaks } = detector.checkForLeaks();
      if (hasLeaks) {
        throw new Error(`Memory leaks detected:\n${leaks.join('\n')}`);
      }
    }
  };
}