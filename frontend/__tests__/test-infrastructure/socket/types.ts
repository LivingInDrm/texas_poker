/**
 * Socket测试相关的类型定义
 */

// Mock Socket实例接口
export interface MockSocketInstance {
  // 基本属性
  connected: boolean;
  disconnected: boolean;
  id: string;
  
  // 连接方法
  connect(): void;
  disconnect(): void;
  
  // 事件方法
  emit(event: string, ...args: any[]): void;
  on(event: string, callback: Function): void;
  once(event: string, callback: Function): void;
  off(event: string, callback?: Function): void;
  
  // 测试辅助方法
  triggerEvent(event: string, data?: any): void;
  getEventListeners(event: string): Function[];
  clearAllListeners(): void;
  getCallHistory(): Array<{ method: string; args: any[]; timestamp: number }>;
  
  // 状态管理
  setConnectionState(connected: boolean): void;
  simulateLatency(ms: number): void;
  simulateError(error: any): void;
}

// Socket测试场景
export interface SocketTestScenario {
  name: string;
  initialState: {
    connected?: boolean;
    latency?: number;
    errorRate?: number;
  };
  events: Array<{
    event: string;
    data?: any;
    delay?: number;
    shouldFail?: boolean;
  }>;
  expectations: Array<{
    event: string;
    data?: any;
    count?: number;
  }>;
}

// Socket Mock配置
export interface SocketMockConfig {
  autoConnect?: boolean;
  defaultLatency?: number;
  errorRate?: number;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  enableLogging?: boolean;
  strictMode?: boolean; // 严格模式下未预期的事件会抛出错误
}

// Socket事件历史记录
export interface SocketEventRecord {
  timestamp: number;
  type: 'emit' | 'on' | 'off' | 'connect' | 'disconnect';
  event?: string;
  data?: any;
  callbackId?: string;
}

// Socket状态
export interface SocketState {
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  reconnectAttempts: number;
  lastError?: any;
  latency: number;
  eventHistory: SocketEventRecord[];
}