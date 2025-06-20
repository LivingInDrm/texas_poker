/**
 * Mock Store工厂
 * 
 * 为测试提供各种预配置的store状态
 */

import { vi } from 'vitest';

// 用户Store Mock
export interface MockUserStore {
  user: any;
  token: string | null;
  isAuthenticated: boolean;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
}

export function createMockUserStore(overrides: Partial<MockUserStore> = {}): MockUserStore {
  return {
    user: {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      chips: 5000,
      avatar: null,
      createdAt: new Date('2024-01-01'),
      ...overrides.user
    },
    token: 'mock-jwt-token',
    isAuthenticated: true,
    login: vi.fn().mockResolvedValue({ success: true }),
    logout: vi.fn(),
    updateUser: vi.fn(),
    ...overrides
  };
}

// 游戏Store Mock
export interface MockGameStore {
  currentRoom: any;
  gameState: any;
  players: any[];
  setRoomState: ReturnType<typeof vi.fn>;
  setGameState: ReturnType<typeof vi.fn>;
  updatePlayerAction: ReturnType<typeof vi.fn>;
  endGame: ReturnType<typeof vi.fn>;
}

export function createMockGameStore(overrides: Partial<MockGameStore> = {}): MockGameStore {
  return {
    currentRoom: {
      id: 'room-123',
      ownerId: 'user-456',
      players: [],
      status: 'WAITING',
      maxPlayers: 6,
      currentPlayerCount: 1,
      hasPassword: false,
      bigBlind: 20,
      smallBlind: 10,
      gameStarted: false,
      ...overrides.currentRoom
    },
    gameState: null,
    players: [],
    setRoomState: vi.fn(),
    setGameState: vi.fn(),
    updatePlayerAction: vi.fn(),
    endGame: vi.fn(),
    ...overrides
  };
}

// 房间Store Mock
export interface MockRoomStore {
  rooms: any[];
  isLoading: boolean;
  error: string | null;
  pagination: any;
  fetchRooms: ReturnType<typeof vi.fn>;
  clearError: ReturnType<typeof vi.fn>;
  refreshRooms: ReturnType<typeof vi.fn>;
}

export function createMockRoomStore(overrides: Partial<MockRoomStore> = {}): MockRoomStore {
  return {
    rooms: [
      {
        id: 'room-1',
        ownerId: 'user-456',
        owner: { id: 'user-456', username: 'owner1' },
        playerLimit: 6,
        currentPlayers: 2,
        hasPassword: false,
        status: 'WAITING',
        bigBlind: 20,
        smallBlind: 10,
        createdAt: '2025-06-15T10:00:00.000Z'
      },
      {
        id: 'room-2',
        ownerId: 'user-789',
        owner: { id: 'user-789', username: 'owner2' },
        playerLimit: 4,
        currentPlayers: 4,
        hasPassword: true,
        status: 'PLAYING',
        bigBlind: 40,
        smallBlind: 20,
        createdAt: '2025-06-15T11:00:00.000Z'
      }
    ],
    isLoading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1
    },
    fetchRooms: vi.fn(),
    clearError: vi.fn(),
    refreshRooms: vi.fn(),
    ...overrides
  };
}

// Store工厂主函数
export interface MockStores {
  userStore: MockUserStore;
  gameStore: MockGameStore;
  roomStore: MockRoomStore;
}

export function createMockStores(overrides: {
  userStore?: Partial<MockUserStore>;
  gameStore?: Partial<MockGameStore>;
  roomStore?: Partial<MockRoomStore>;
} = {}): MockStores {
  return {
    userStore: createMockUserStore(overrides.userStore),
    gameStore: createMockGameStore(overrides.gameStore),
    roomStore: createMockRoomStore(overrides.roomStore)
  };
}

// Store Mock设置工具
export class StoreMockManager {
  private originalMocks: Map<string, any> = new Map();
  private activeMocks: Map<string, any> = new Map();

  /**
   * 设置Store Mock
   */
  setStoreMock(storeName: string, mockImplementation: any): void {
    // 保存原始mock（如果存在）
    if (!this.originalMocks.has(storeName)) {
      this.originalMocks.set(storeName, mockImplementation);
    }
    
    this.activeMocks.set(storeName, mockImplementation);
    
    // 应用mock
    vi.doMock(`../../src/stores/${storeName}`, () => ({
      [`use${storeName.charAt(0).toUpperCase() + storeName.slice(1)}`]: vi.fn(() => mockImplementation)
    }));
  }

  /**
   * 更新现有Mock
   */
  updateStoreMock(storeName: string, updates: Partial<any>): void {
    const currentMock = this.activeMocks.get(storeName);
    if (!currentMock) {
      throw new Error(`No active mock found for store: ${storeName}`);
    }
    
    const updatedMock = { ...currentMock, ...updates };
    this.setStoreMock(storeName, updatedMock);
  }

  /**
   * 重置Store Mock
   */
  resetStoreMock(storeName: string): void {
    const originalMock = this.originalMocks.get(storeName);
    if (originalMock) {
      this.setStoreMock(storeName, originalMock);
    }
  }

  /**
   * 清理所有Mock
   */
  cleanup(): void {
    this.activeMocks.clear();
    this.originalMocks.clear();
    vi.clearAllMocks();
  }

  /**
   * 获取当前Mock状态
   */
  getMockState(storeName: string): any {
    return this.activeMocks.get(storeName);
  }
}

// 预定义的Store场景
export const StoreScenarios = {
  // 已登录用户场景
  authenticatedUser: () => createMockStores({
    userStore: {
      isAuthenticated: true,
      user: {
        id: 'user-123',
        username: 'testuser',
        chips: 10000
      }
    }
  }),

  // 未登录用户场景
  unauthenticatedUser: () => createMockStores({
    userStore: {
      isAuthenticated: false,
      user: null,
      token: null
    }
  }),

  // 游戏中场景
  inGame: () => createMockStores({
    gameStore: {
      currentRoom: {
        id: 'room-123',
        status: 'PLAYING',
        gameStarted: true
      },
      gameState: {
        gameId: 'game-456',
        phase: 'preflop',
        currentPlayer: 'user-123'
      }
    }
  }),

  // 房间等待场景
  waitingInRoom: () => createMockStores({
    gameStore: {
      currentRoom: {
        id: 'room-123',
        status: 'WAITING',
        gameStarted: false,
        currentPlayerCount: 3
      }
    }
  }),

  // 加载中场景
  loading: () => createMockStores({
    roomStore: {
      isLoading: true,
      rooms: []
    }
  }),

  // 错误场景
  withError: () => createMockStores({
    roomStore: {
      error: 'Failed to load rooms',
      isLoading: false
    }
  })
};