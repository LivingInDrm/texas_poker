/**
 * SocketMockFactory - 完整模拟socket.io行为的工厂类
 * 
 * 这个类提供了一个完整的socket.io模拟器，支持：
 * - 事件注册和触发
 * - 连接状态管理
 * - 异步操作模拟
 * - 错误注入
 * - 延迟模拟
 * - 调用历史记录
 */

import { vi } from 'vitest';
import type { MockSocketInstance, SocketMockConfig, SocketEventRecord, SocketState } from './types';

export class SocketMockFactory {
  private static instance: SocketMockFactory | null = null;
  private mockInstances: Map<string, MockSocketInstance> = new Map();

  static getInstance(): SocketMockFactory {
    if (!this.instance) {
      this.instance = new SocketMockFactory();
    }
    return this.instance;
  }

  static resetInstance(): void {
    this.instance = null;
  }

  /**
   * 创建一个Mock Socket实例
   */
  createSocket(config: SocketMockConfig = {}): MockSocketInstance {
    const socketId = `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const defaultConfig: Required<SocketMockConfig> = {
      autoConnect: false,
      defaultLatency: 0,
      errorRate: 0,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      enableLogging: false,
      strictMode: false,
      ...config
    };

    const mockSocket = this.createMockSocketInstance(socketId, defaultConfig);
    this.mockInstances.set(socketId, mockSocket);
    
    return mockSocket;
  }

  /**
   * 创建Mock Socket实例的具体实现
   */
  private createMockSocketInstance(id: string, config: Required<SocketMockConfig>): MockSocketInstance {
    const eventListeners = new Map<string, Set<Function>>();
    const callHistory: Array<{ method: string; args: any[]; timestamp: number }> = [];
    
    const state: SocketState = {
      connected: config.autoConnect,
      connecting: false,
      disconnecting: false,
      reconnectAttempts: 0,
      latency: config.defaultLatency,
      eventHistory: []
    };

    const logCall = (method: string, ...args: any[]) => {
      const record = { method, args, timestamp: Date.now() };
      callHistory.push(record);
      
      if (config.enableLogging) {
        console.log(`[MockSocket ${id}] ${method}`, args);
      }
    };

    const recordEvent = (type: SocketEventRecord['type'], event?: string, data?: any) => {
      state.eventHistory.push({
        timestamp: Date.now(),
        type,
        event,
        data
      });
    };

    const triggerEventWithLatency = async (event: string, data?: any) => {
      if (state.latency > 0) {
        await new Promise(resolve => setTimeout(resolve, state.latency));
      }
      
      const listeners = eventListeners.get(event);
      if (listeners) {
        listeners.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in event listener for ${event}:`, error);
          }
        });
      }
    };

    const mockSocket: MockSocketInstance = {
      // 基本属性
      get connected() { return state.connected; },
      get disconnected() { return !state.connected; },
      id,

      // 连接方法
      connect: vi.fn(() => {
        logCall('connect');
        
        if (state.connected) return;
        
        state.connecting = true;
        recordEvent('connect');
        
        // 模拟异步连接
        setTimeout(() => {
          state.connecting = false;
          
          // 模拟连接失败
          if (Math.random() < config.errorRate) {
            state.lastError = new Error('Connection failed');
            triggerEventWithLatency('connect_error', state.lastError);
            return;
          }
          
          state.connected = true;
          triggerEventWithLatency('connect');
        }, config.defaultLatency);
      }),

      disconnect: vi.fn((reason?: string) => {
        logCall('disconnect', reason);
        
        if (!state.connected) return;
        
        state.disconnecting = true;
        recordEvent('disconnect');
        
        setTimeout(() => {
          state.disconnecting = false;
          state.connected = false;
          triggerEventWithLatency('disconnect', reason || 'client disconnect');
        }, config.defaultLatency / 2);
      }),

      // 事件方法
      emit: vi.fn((event: string, ...args: any[]) => {
        logCall('emit', event, ...args);
        recordEvent('emit', event, args);
        
        // 处理带回调的emit
        const lastArg = args[args.length - 1];
        if (typeof lastArg === 'function') {
          const callback = lastArg;
          const data = args.slice(0, -1);
          
          // 模拟服务器响应
          setTimeout(() => {
            // 模拟成功响应
            const shouldFail = Math.random() < config.errorRate;
            
            if (shouldFail) {
              // 不调用回调，模拟超时
              return;
            }
            
            // 根据事件类型返回不同的响应
            const response = mockSocket.generateResponse(event, data);
            callback(response);
          }, state.latency);
        }
      }),

      on: vi.fn((event: string, callback: Function) => {
        logCall('on', event);
        recordEvent('on', event);
        
        if (!eventListeners.has(event)) {
          eventListeners.set(event, new Set());
        }
        eventListeners.get(event)!.add(callback);
      }),

      once: vi.fn((event: string, callback: Function) => {
        logCall('once', event);
        recordEvent('on', event);
        
        const wrappedCallback = (...args: any[]) => {
          callback(...args);
          mockSocket.off(event, wrappedCallback);
        };
        
        mockSocket.on(event, wrappedCallback);
      }),

      off: vi.fn((event: string, callback?: Function) => {
        logCall('off', event);
        recordEvent('off', event);
        
        const listeners = eventListeners.get(event);
        if (listeners) {
          if (callback) {
            listeners.delete(callback);
          } else {
            listeners.clear();
          }
        }
      }),

      // 测试辅助方法
      triggerEvent: vi.fn((event: string, data?: any) => {
        triggerEventWithLatency(event, data);
      }),

      getEventListeners: vi.fn((event: string) => {
        const listeners = eventListeners.get(event);
        return listeners ? Array.from(listeners) : [];
      }),

      clearAllListeners: vi.fn(() => {
        eventListeners.clear();
      }),

      getCallHistory: vi.fn(() => {
        return [...callHistory];
      }),

      // 状态管理
      setConnectionState: vi.fn((connected: boolean) => {
        state.connected = connected;
        if (connected) {
          triggerEventWithLatency('connect');
        } else {
          triggerEventWithLatency('disconnect', 'manual');
        }
      }),

      simulateLatency: vi.fn((ms: number) => {
        state.latency = ms;
      }),

      simulateError: vi.fn((error: any) => {
        state.lastError = error;
        triggerEventWithLatency('error', error);
      }),

      // 生成响应的辅助方法
      generateResponse: vi.fn((event: string, data: any[]) => {
        // 根据不同的事件类型生成相应的响应
        switch (event) {
          case 'GET_USER_CURRENT_ROOM':
            return {
              success: true,
              data: {
                roomId: 'room-123',
                roomDetails: {
                  playerCount: 3,
                  isGameStarted: false,
                  roomState: {
                    id: 'room-123',
                    status: 'waiting',
                    maxPlayers: 6,
                    currentPlayerCount: 3
                  }
                }
              }
            };
          
          case 'ROOM_JOIN':
            return {
              success: true,
              data: {
                roomState: {
                  id: data[0]?.roomId || 'room-123',
                  players: []
                }
              }
            };
          
          case 'ROOM_LEAVE':
            return { success: true };
          
          case 'ROOM_QUICK_START':
            return {
              success: true,
              data: {
                roomId: 'quick-room-' + Math.random().toString(36).substr(2, 8),
                roomState: { id: 'quick-room', players: [] }
              }
            };
          
          case 'GAME_ACTION':
          case 'GAME_READY':
          case 'GAME_RESTART':
            return { success: true };
          
          case 'PING':
            return Date.now();
          
          default:
            return { success: true, data: null };
        }
      })
    };

    return mockSocket;
  }

  /**
   * 获取所有Mock实例
   */
  getAllInstances(): Map<string, MockSocketInstance> {
    return new Map(this.mockInstances);
  }

  /**
   * 清理所有Mock实例
   */
  cleanup(): void {
    this.mockInstances.forEach(socket => {
      socket.clearAllListeners();
    });
    this.mockInstances.clear();
  }

  /**
   * 创建用于socket.io模块mock的函数
   */
  createIoMock(): any {
    return vi.fn(() => this.createSocket());
  }
}