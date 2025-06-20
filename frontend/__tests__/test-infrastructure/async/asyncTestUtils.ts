/**
 * 异步测试工具类
 * 
 * 提供可靠的异步操作测试支持，防止测试超时和内存泄漏
 */

import { vi } from 'vitest';

export class AsyncTestUtils {
  private static timeouts: Set<NodeJS.Timeout> = new Set();
  private static intervals: Set<NodeJS.Timeout> = new Set();
  private static promises: Set<Promise<any>> = new Set();

  /**
   * 创建可控制的Promise
   */
  static createControllablePromise<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
    isResolved: boolean;
    isRejected: boolean;
  } {
    let resolve: (value: T) => void;
    let reject: (reason?: any) => void;
    let isResolved = false;
    let isRejected = false;
    
    const promise = new Promise<T>((res, rej) => {
      resolve = (value: T) => {
        isResolved = true;
        res(value);
      };
      reject = (reason?: any) => {
        isRejected = true;
        rej(reason);
      };
    });

    this.promises.add(promise);

    return {
      promise,
      resolve: resolve!,
      reject: reject!,
      get isResolved() { return isResolved; },
      get isRejected() { return isRejected; }
    };
  }

  /**
   * 创建带超时的Promise
   */
  static createTimeoutPromise<T>(
    executor: (resolve: (value: T) => void, reject: (reason?: any) => void) => void,
    timeoutMs: number,
    timeoutMessage = 'Operation timed out'
  ): Promise<T> {
    const { promise, resolve, reject } = this.createControllablePromise<T>();
    
    const timeout = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    
    this.timeouts.add(timeout);

    executor(
      (value: T) => {
        clearTimeout(timeout);
        this.timeouts.delete(timeout);
        resolve(value);
      },
      (reason?: any) => {
        clearTimeout(timeout);
        this.timeouts.delete(timeout);
        reject(reason);
      }
    );

    return promise;
  }

  /**
   * 等待指定时间
   */
  static wait(ms: number): Promise<void> {
    return this.createTimeoutPromise<void>((resolve) => {
      const timeout = setTimeout(resolve, ms);
      this.timeouts.add(timeout);
    }, ms + 100); // 给一点额外时间防止超时
  }

  /**
   * 等待条件满足
   */
  static waitFor(
    condition: () => boolean | Promise<boolean>,
    options: {
      timeout?: number;
      interval?: number;
      timeoutMessage?: string;
    } = {}
  ): Promise<void> {
    const { timeout = 5000, interval = 100, timeoutMessage = 'Condition not met within timeout' } = options;
    
    return this.createTimeoutPromise<void>(async (resolve, reject) => {
      const startTime = Date.now();
      
      const check = async () => {
        try {
          const result = await condition();
          if (result) {
            resolve();
            return;
          }
        } catch (error) {
          // 条件检查失败，继续等待
        }
        
        if (Date.now() - startTime >= timeout) {
          reject(new Error(timeoutMessage));
          return;
        }
        
        const intervalId = setTimeout(check, interval);
        this.timeouts.add(intervalId);
      };
      
      check();
    }, timeout + 100, timeoutMessage);
  }

  /**
   * 等待多个Promise完成，但有总体超时
   */
  static waitForAll<T>(
    promises: Promise<T>[],
    timeoutMs: number,
    timeoutMessage = 'Not all promises resolved within timeout'
  ): Promise<T[]> {
    return this.createTimeoutPromise<T[]>((resolve, reject) => {
      Promise.all(promises)
        .then(resolve)
        .catch(reject);
    }, timeoutMs, timeoutMessage);
  }

  /**
   * 等待第一个Promise完成
   */
  static waitForFirst<T>(
    promises: Promise<T>[],
    timeoutMs: number,
    timeoutMessage = 'No promise resolved within timeout'
  ): Promise<T> {
    return this.createTimeoutPromise<T>((resolve, reject) => {
      Promise.race(promises)
        .then(resolve)
        .catch(reject);
    }, timeoutMs, timeoutMessage);
  }

  /**
   * 重试执行异步操作
   */
  static async retry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delay?: number;
      backoff?: number;
      condition?: (error: any) => boolean;
    } = {}
  ): Promise<T> {
    const { maxAttempts = 3, delay = 1000, backoff = 1.5, condition = () => true } = options;
    
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts || !condition(error)) {
          throw error;
        }
        
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        await this.wait(waitTime);
      }
    }
    
    throw lastError;
  }

  /**
   * 模拟网络延迟
   */
  static simulateNetworkDelay(min = 100, max = 500): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return this.wait(delay);
  }

  /**
   * 清理所有异步资源
   */
  static cleanup(): void {
    // 清理所有timeout
    this.timeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.timeouts.clear();

    // 清理所有interval
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.intervals.clear();

    // 清理promises记录
    this.promises.clear();
  }

  /**
   * 获取未完成的异步操作统计
   */
  static getStats(): {
    activeTimeouts: number;
    activeIntervals: number;
    trackedPromises: number;
  } {
    return {
      activeTimeouts: this.timeouts.size,
      activeIntervals: this.intervals.size,
      trackedPromises: this.promises.size
    };
  }
}

/**
 * 测试专用的超时管理器
 */
export class TimeoutManager {
  private timeouts: Set<NodeJS.Timeout> = new Set();
  private defaultTimeout: number;

  constructor(defaultTimeout = 5000) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * 创建管理的setTimeout
   */
  setTimeout(callback: () => void, delay?: number): NodeJS.Timeout {
    const timeout = setTimeout(() => {
      this.timeouts.delete(timeout);
      callback();
    }, delay || this.defaultTimeout);
    
    this.timeouts.add(timeout);
    return timeout;
  }

  /**
   * 清除特定timeout
   */
  clearTimeout(timeout: NodeJS.Timeout): void {
    clearTimeout(timeout);
    this.timeouts.delete(timeout);
  }

  /**
   * 清除所有timeout
   */
  clearAll(): void {
    this.timeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.timeouts.clear();
  }

  /**
   * 获取活跃的timeout数量
   */
  getActiveCount(): number {
    return this.timeouts.size;
  }
}