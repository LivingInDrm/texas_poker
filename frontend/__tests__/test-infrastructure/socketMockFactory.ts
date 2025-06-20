import { vi } from 'vitest';

/**
 * 创建完整的useSocket Mock工厂函数
 * 确保所有接口函数都被正确模拟，防止函数缺失错误
 */
export function createUseSocketMock(overrides: Partial<any> = {}) {
  const defaultMock = {
    // 连接状态
    connected: true,
    connectionStatus: 'connected' as const,
    networkQuality: 'good' as const,
    
    // 方法
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    joinRoom: vi.fn().mockResolvedValue({ success: true }),
    leaveRoom: vi.fn().mockResolvedValue({ success: true }),
    quickStart: vi.fn().mockResolvedValue({ success: true }),
    makeGameAction: vi.fn().mockResolvedValue({ success: true }),
    setReady: vi.fn().mockResolvedValue({ success: true }),
    restartGame: vi.fn().mockResolvedValue({ success: true }),
    getCurrentRoomStatus: vi.fn().mockResolvedValue({ roomId: null }),
    leaveCurrentRoom: vi.fn().mockResolvedValue({ success: true }),
    
    // 状态
    currentRoomId: null,
    gameState: null,
    inGame: false
  };

  return {
    ...defaultMock,
    ...overrides
  };
}

/**
 * 验证useSocket Mock接口完整性
 * 确保所有必需的方法和属性都存在
 */
export function validateUseSocketMock(mockObject: any): boolean {
  const requiredMethods = [
    'connect', 'disconnect', 'joinRoom', 'leaveRoom', 'quickStart',
    'makeGameAction', 'setReady', 'restartGame', 'getCurrentRoomStatus', 'leaveCurrentRoom'
  ];
  
  const requiredProperties = [
    'connected', 'connectionStatus', 'networkQuality',
    'currentRoomId', 'gameState', 'inGame'
  ];

  const missingMethods = requiredMethods.filter(method => 
    typeof mockObject[method] !== 'function'
  );
  
  const missingProperties = requiredProperties.filter(prop => 
    !(prop in mockObject)
  );

  if (missingMethods.length > 0) {
    console.error('Missing useSocket mock methods:', missingMethods);
    return false;
  }

  if (missingProperties.length > 0) {
    console.error('Missing useSocket mock properties:', missingProperties);
    return false;
  }

  return true;
}

/**
 * 为组件测试创建标准的useSocket Mock
 */
export function createComponentTestSocketMock() {
  return createUseSocketMock({
    connected: true,
    connectionStatus: 'connected',
    networkQuality: 'good',
    getCurrentRoomStatus: vi.fn().mockResolvedValue({ roomId: null })
  });
}

/**
 * 为集成测试创建更复杂的useSocket Mock
 */
export function createIntegrationTestSocketMock() {
  return createUseSocketMock({
    connected: true,
    connectionStatus: 'connected',
    networkQuality: 'good',
    currentRoomId: 'test-room-123',
    getCurrentRoomStatus: vi.fn().mockResolvedValue({ 
      roomId: 'test-room-123',
      roomDetails: {
        playerCount: 2,
        isGameStarted: false
      }
    })
  });
}