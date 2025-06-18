import { AuthenticatedSocket, SocketData, SocketResponse } from '../../src/types/socket';

/**
 * 创建用于测试的AuthenticatedSocket Mock对象
 */
export function createMockAuthenticatedSocket(
  userData: Partial<SocketData> = {}
): jest.Mocked<AuthenticatedSocket> {
  const defaultData: SocketData = {
    userId: 'test-user-id',
    username: 'test-user',
    authenticated: true,
    roomId: undefined,
    ...userData
  };

  return {
    data: defaultData,
    id: 'mock-socket-id',
    connected: true,
    handshake: {
      auth: {},
      headers: {},
      query: {},
      address: 'localhost',
      time: new Date().toISOString(),
      secure: false,
      url: '/',
      xdomain: false,
      issued: Date.now()
    },
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn().mockReturnThis(),
    broadcast: jest.fn().mockReturnThis(),
    disconnect: jest.fn(),
    send: jest.fn(),
    write: jest.fn(),
    timeout: jest.fn().mockReturnThis(),
    compress: jest.fn().mockReturnThis(),
    volatile: jest.fn().mockReturnThis(),
    binary: jest.fn().mockReturnThis(),
    local: jest.fn().mockReturnThis(),
    rooms: new Set(),
    request: {} as any,
    conn: {} as any,
    client: {} as any,
    nsp: {} as any,
    adapter: {} as any,
    server: {} as any,
    listeners: jest.fn(),
    removeAllListeners: jest.fn(),
    eventNames: jest.fn(),
    listenerCount: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    prependListener: jest.fn(),
    prependOnceListener: jest.fn(),
    setMaxListeners: jest.fn(),
    getMaxListeners: jest.fn(),
    rawListeners: jest.fn()
  } as jest.Mocked<AuthenticatedSocket>;
}

/**
 * 创建标准的Socket响应对象
 */
export function createSocketResponse(
  success: boolean = true,
  data?: any,
  message?: string,
  error?: string
): SocketResponse {
  return {
    success,
    data,
    message,
    error
  };
}

/**
 * 创建测试用的JWT Token
 */
export function createTestJWTToken(userId: string = 'test-user', username: string = 'testuser'): string {
  // 这里返回一个模拟的token，在测试中jwt.verify会被mock
  return `test-token-${userId}`;
}

/**
 * 模拟Socket事件回调函数
 */
export function createMockCallback(): jest.Mock {
  return jest.fn();
}

/**
 * 验证Socket响应格式是否正确
 */
export function expectValidSocketResponse(
  response: any,
  expectedSuccess: boolean = true
): void {
  expect(response).toHaveProperty('success');
  expect(response.success).toBe(expectedSuccess);
  
  if (expectedSuccess) {
    expect(response).toHaveProperty('data');
  } else {
    expect(response).toHaveProperty('error');
  }
}

/**
 * Socket事件测试辅助工具类
 * 扩展原有功能，添加更多测试工具
 */
export class SocketTestHelper {
  /**
   * 验证Socket.emit被调用
   */
  static expectSocketEmit(
    socket: jest.Mocked<AuthenticatedSocket>,
    event: string,
    data?: any
  ): void {
    if (data !== undefined) {
      expect(socket.emit).toHaveBeenCalledWith(event, data);
    } else {
      expect(socket.emit).toHaveBeenCalledWith(expect.stringMatching(event), expect.anything());
    }
  }

  /**
   * 验证Socket.join被调用
   */
  static expectSocketJoin(
    socket: jest.Mocked<AuthenticatedSocket>,
    roomId: string
  ): void {
    expect(socket.join).toHaveBeenCalledWith(roomId);
  }

  /**
   * 验证Socket.leave被调用
   */
  static expectSocketLeave(
    socket: jest.Mocked<AuthenticatedSocket>,
    roomId: string
  ): void {
    expect(socket.leave).toHaveBeenCalledWith(roomId);
  }

  /**
   * 验证Socket.to().emit被调用
   */
  static expectSocketBroadcast(
    socket: jest.Mocked<AuthenticatedSocket>,
    roomId: string,
    event: string,
    data?: any
  ): void {
    expect(socket.to).toHaveBeenCalledWith(roomId);
    
    // 获取to()返回的mock对象，验证其emit方法
    const toMock = socket.to as jest.Mock;
    const broadcastMock = toMock.mock.results[toMock.mock.results.length - 1]?.value;
    
    if (broadcastMock && broadcastMock.emit) {
      if (data !== undefined) {
        expect(broadcastMock.emit).toHaveBeenCalledWith(event, data);
      } else {
        expect(broadcastMock.emit).toHaveBeenCalledWith(event, expect.anything());
      }
    }
  }

  /**
   * 验证回调函数被正确调用
   */
  static expectCallbackCalledWith(
    callback: jest.Mock,
    expectedResponse: Partial<SocketResponse>
  ): void {
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining(expectedResponse)
    );
  }

  /**
   * 验证成功的回调响应
   */
  static expectSuccessCallback(
    callback: jest.Mock,
    expectedData?: any,
    expectedMessage?: string
  ): void {
    const expectedResponse: Partial<SocketResponse> = {
      success: true
    };
    
    if (expectedData !== undefined) {
      expectedResponse.data = expectedData;
    }
    
    if (expectedMessage) {
      expectedResponse.message = expectedMessage;
    }
    
    this.expectCallbackCalledWith(callback, expectedResponse);
  }

  /**
   * 验证失败的回调响应
   */
  static expectErrorCallback(
    callback: jest.Mock,
    expectedError?: string,
    expectedMessage?: string
  ): void {
    const expectedResponse: Partial<SocketResponse> = {
      success: false
    };
    
    if (expectedError) {
      expectedResponse.error = expectedError;
    }
    
    if (expectedMessage) {
      expectedResponse.message = expectedMessage;
    }
    
    this.expectCallbackCalledWith(callback, expectedResponse);
  }

  /**
   * 重置Socket Mock的调用历史
   */
  static resetSocketMock(socket: jest.Mocked<AuthenticatedSocket>): void {
    socket.emit.mockClear();
    socket.join.mockClear();
    socket.leave.mockClear();
    socket.to.mockClear();
    socket.on.mockClear();
  }

  /**
   * 配置Socket Mock的房间状态
   */
  static setSocketRoomId(
    socket: jest.Mocked<AuthenticatedSocket>,
    roomId?: string
  ): void {
    socket.data.roomId = roomId;
    if (roomId) {
      socket.rooms.add(roomId);
    }
  }

  /**
   * 模拟Socket连接状态
   */
  static setSocketConnected(
    socket: jest.Mocked<AuthenticatedSocket>,
    connected: boolean = true
  ): void {
    socket.connected = connected;
  }
}

/**
 * Socket事件处理器测试工具
 * 专门用于测试Socket事件处理器函数
 */
export class HandlerTestUtils {
  /**
   * 测试处理器函数的标准模式
   */
  static async testHandler(
    handler: Function,
    socket: jest.Mocked<AuthenticatedSocket>,
    eventData: any,
    callback: jest.Mock,
    expectSuccess: boolean = true
  ): Promise<void> {
    await handler(socket, eventData, callback);
    
    expect(callback).toHaveBeenCalledTimes(1);
    const callResponse = callback.mock.calls[0][0];
    
    expect(callResponse).toHaveProperty('success', expectSuccess);
    
    if (expectSuccess) {
      expect(callResponse).toHaveProperty('data');
    } else {
      expect(callResponse).toHaveProperty('error');
    }
  }

  /**
   * 批量测试错误场景
   */
  static async testErrorScenarios(
    handler: Function,
    socket: jest.Mocked<AuthenticatedSocket>,
    errorScenarios: Array<{
      name: string;
      eventData: any;
      setup?: () => void;
      expectedError?: string;
    }>
  ): Promise<void> {
    for (const scenario of errorScenarios) {
      const callback = createMockCallback();
      
      if (scenario.setup) {
        scenario.setup();
      }
      
      await handler(socket, scenario.eventData, callback);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: scenario.expectedError ? 
            expect.stringContaining(scenario.expectedError) : 
            expect.any(String)
        })
      );
    }
  }
}

/**
 * 异步事件测试工具
 */
export class AsyncEventTestUtils {
  /**
   * 等待异步Socket事件完成
   */
  static async waitForSocketEvent(
    socket: jest.Mocked<AuthenticatedSocket>,
    eventName: string,
    timeout: number = 1000
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Socket event ${eventName} not emitted within ${timeout}ms`));
      }, timeout);

      const originalEmit = socket.emit;
      socket.emit.mockImplementation((event: string, ...args: any[]) => {
        if (event === eventName) {
          clearTimeout(timer);
          resolve(args);
        }
        return originalEmit.call(socket, event, ...args);
      });
    });
  }

  /**
   * 等待回调函数被调用
   */
  static async waitForCallback(
    callback: jest.Mock,
    timeout: number = 1000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Callback not called within ${timeout}ms`));
      }, timeout);

      const checkCallback = () => {
        if (callback.mock.calls.length > 0) {
          clearTimeout(timer);
          resolve(callback.mock.calls[0][0]);
        } else {
          setTimeout(checkCallback, 10);
        }
      };

      checkCallback();
    });
  }
}