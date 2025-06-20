/**
 * Socket测试工具函数
 * 
 * 提供便捷的Socket测试辅助函数和常用测试场景
 */

import { vi } from 'vitest';
import { SocketMockFactory } from './SocketMockFactory';
import type { MockSocketInstance, SocketTestScenario, SocketMockConfig } from './types';

export interface SocketTestUtils {
  mockSocket: MockSocketInstance;
  mockIo: any;
  cleanup: () => void;
  runScenario: (scenario: SocketTestScenario) => Promise<void>;
  waitForEvent: (event: string, timeout?: number) => Promise<any>;
  expectEventSequence: (events: string[]) => void;
}

/**
 * 创建Socket测试工具实例
 */
export function createSocketTestUtils(config: SocketMockConfig = {}): SocketTestUtils {
  const factory = SocketMockFactory.getInstance();
  const mockSocket = factory.createSocket(config);
  const mockIo = factory.createIoMock();

  // 配置socket.io-client模块的mock
  vi.doMock('socket.io-client', () => ({
    io: mockIo
  }));

  const cleanup = () => {
    mockSocket.clearAllListeners();
    vi.clearAllMocks();
  };

  const runScenario = async (scenario: SocketTestScenario): Promise<void> => {
    // 设置初始状态
    if (scenario.initialState.connected !== undefined) {
      mockSocket.setConnectionState(scenario.initialState.connected);
    }
    if (scenario.initialState.latency !== undefined) {
      mockSocket.simulateLatency(scenario.initialState.latency);
    }

    // 执行事件序列
    for (const eventConfig of scenario.events) {
      if (eventConfig.delay) {
        await new Promise(resolve => setTimeout(resolve, eventConfig.delay));
      }

      if (eventConfig.shouldFail) {
        mockSocket.simulateError(new Error(`Simulated error for ${eventConfig.event}`));
      } else {
        mockSocket.triggerEvent(eventConfig.event, eventConfig.data);
      }
    }

    // 等待一小段时间确保所有异步操作完成
    await new Promise(resolve => setTimeout(resolve, 10));
  };

  const waitForEvent = (event: string, timeout = 5000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const handler = (data: any) => {
        clearTimeout(timer);
        mockSocket.off(event, handler);
        resolve(data);
      };

      mockSocket.on(event, handler);
    });
  };

  const expectEventSequence = (events: string[]) => {
    const history = mockSocket.getCallHistory()
      .filter(call => call.method === 'on' || call.method === 'emit')
      .map(call => call.args[0]);
    
    events.forEach((expectedEvent, index) => {
      if (history[index] !== expectedEvent) {
        throw new Error(
          `Event sequence mismatch at index ${index}. Expected: ${expectedEvent}, Got: ${history[index]}`
        );
      }
    });
  };

  return {
    mockSocket,
    mockIo,
    cleanup,
    runScenario,
    waitForEvent,
    expectEventSequence
  };
}

/**
 * 预定义的测试场景
 */
export const SocketTestScenarios = {
  /**
   * 基本连接场景
   */
  basicConnection: (): SocketTestScenario => ({
    name: 'Basic Connection',
    initialState: { connected: false },
    events: [
      { event: 'connect', delay: 100 }
    ],
    expectations: [
      { event: 'connect', count: 1 }
    ]
  }),

  /**
   * 连接失败场景
   */
  connectionFailure: (): SocketTestScenario => ({
    name: 'Connection Failure',
    initialState: { connected: false, errorRate: 1 },
    events: [
      { event: 'connect', shouldFail: true }
    ],
    expectations: [
      { event: 'connect_error', count: 1 }
    ]
  }),

  /**
   * 重连场景
   */
  reconnection: (): SocketTestScenario => ({
    name: 'Reconnection',
    initialState: { connected: true },
    events: [
      { event: 'disconnect', delay: 100 },
      { event: 'reconnect_attempt', delay: 1000 },
      { event: 'reconnect', delay: 100 }
    ],
    expectations: [
      { event: 'disconnect', count: 1 },
      { event: 'reconnect', count: 1 }
    ]
  }),

  /**
   * 房间操作场景
   */
  roomOperations: (): SocketTestScenario => ({
    name: 'Room Operations',
    initialState: { connected: true },
    events: [
      { event: 'ROOM_JOINED', data: { roomId: 'room-123' }, delay: 100 },
      { event: 'ROOM_STATE_UPDATE', data: { roomState: { id: 'room-123' } }, delay: 200 }
    ],
    expectations: [
      { event: 'ROOM_JOINED', count: 1 },
      { event: 'ROOM_STATE_UPDATE', count: 1 }
    ]
  }),

  /**
   * 游戏事件场景
   */
  gameEvents: (): SocketTestScenario => ({
    name: 'Game Events',
    initialState: { connected: true },
    events: [
      { event: 'GAME_STARTED', data: { gameState: { gameId: 'game-123' } }, delay: 100 },
      { event: 'GAME_ACTION_REQUIRED', data: { playerId: 'player-1' }, delay: 200 },
      { event: 'GAME_ENDED', data: { result: 'player-1-wins' }, delay: 500 }
    ],
    expectations: [
      { event: 'GAME_STARTED', count: 1 },
      { event: 'GAME_ACTION_REQUIRED', count: 1 },
      { event: 'GAME_ENDED', count: 1 }
    ]
  })
};

/**
 * 创建快速测试工具 - 用于简单的单个测试
 */
export function createQuickSocketTest(config: SocketMockConfig = {}) {
  const utils = createSocketTestUtils(config);
  
  return {
    ...utils,
    // 快速连接
    quickConnect: async () => {
      utils.mockSocket.setConnectionState(true);
      await new Promise(resolve => setTimeout(resolve, 10));
    },
    
    // 快速断连
    quickDisconnect: async () => {
      utils.mockSocket.setConnectionState(false);
      await new Promise(resolve => setTimeout(resolve, 10));
    },
    
    // 模拟服务器响应
    mockServerResponse: (event: string, response: any) => {
      const originalEmit = utils.mockSocket.emit;
      utils.mockSocket.emit = vi.fn((emitEvent: string, ...args: any[]) => {
        const callback = args[args.length - 1];
        if (emitEvent === event && typeof callback === 'function') {
          setTimeout(() => callback(response), 10);
        }
        return originalEmit(emitEvent, ...args);
      });
    }
  };
}