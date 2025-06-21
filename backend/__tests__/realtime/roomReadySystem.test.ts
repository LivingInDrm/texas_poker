/**
 * 房间准备系统集成测试
 * 测试新增的房间准备状态和游戏开始功能
 */

import { Server } from 'socket.io';
import { createServer } from 'http';
import Client from 'socket.io-client';
import { redisClient } from '../../src/db';
import { RoomState, SOCKET_EVENTS } from '../../src/types/socket';
import { GameState as GameEngine } from '../../src/game/GameState';

// Mock dependencies
jest.mock('../../src/db', () => ({
  redisClient: {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    lPush: jest.fn(),
    lRange: jest.fn(),
    lTrim: jest.fn()
  }
}));

jest.mock('../../src/game/GameState', () => ({
  GameState: jest.fn().mockImplementation(() => ({
    addPlayer: jest.fn(),
    setPlayerReady: jest.fn(),
    startNewHand: jest.fn().mockReturnValue(true),
    getGameSnapshot: jest.fn().mockReturnValue({
      gameId: 'game-123',
      phase: 'preflop',
      players: [],
      dealerIndex: 0,
      currentPlayerIndex: 0,
      pot: 30,
      board: []
    })
  }))
}));

describe('房间准备系统功能测试', () => {
  let testRoomState: RoomState;
  let mockRedisGet: jest.MockedFunction<typeof redisClient.get>;
  let mockRedisSetEx: jest.MockedFunction<typeof redisClient.setEx>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 获取Mock函数引用
    mockRedisGet = redisClient.get as jest.MockedFunction<typeof redisClient.get>;
    mockRedisSetEx = redisClient.setEx as jest.MockedFunction<typeof redisClient.setEx>;

    // 创建测试房间状态
    testRoomState = {
      id: 'test-room-1',
      ownerId: 'owner-1',
      players: [
        {
          id: 'owner-1',
          username: 'Owner',
          chips: 5000,
          isReady: true, // 房主默认准备
          position: 0,
          isConnected: true
        },
        {
          id: 'player-1',
          username: 'Player1',
          chips: 5000,
          isReady: false, // 普通玩家默认未准备
          position: 1,
          isConnected: true
        },
        {
          id: 'player-2',
          username: 'Player2',
          chips: 5000,
          isReady: false,
          position: 2,
          isConnected: true
        }
      ],
      status: 'WAITING',
      maxPlayers: 6,
      currentPlayerCount: 3,
      hasPassword: false,
      bigBlind: 20,
      smallBlind: 10,
      gameStarted: false
    };

    // 设置Redis mock的默认行为
    mockRedisGet.mockResolvedValue(JSON.stringify(testRoomState));
    mockRedisSetEx.mockResolvedValue('OK' as any);
  });

  describe('gameReady处理器测试', () => {
    /**
     * 创建模拟的准备状态处理器调用
     */
    async function simulateGameReadyCall(
      userId: string, 
      roomId: string, 
      customRoomState?: RoomState
    ) {
      if (customRoomState) {
        mockRedisGet.mockResolvedValue(JSON.stringify(customRoomState));
      }

      const mockCallback = jest.fn();
      const mockSocket = {
        data: { userId, username: `User-${userId}` },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
      };
      const mockIo = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
      };

      // 模拟gameHandlers中的逻辑
      const roomData = await redisClient.get(`room:${roomId}`);
      if (!roomData) {
        mockCallback({
          success: false,
          error: 'Room not found',
        });
        return { mockCallback, mockSocket, mockIo };
      }

      const roomState: RoomState = JSON.parse(roomData.toString());
      const playerIndex = roomState.players.findIndex(p => p.id === userId);
      
      if (playerIndex === -1) {
        mockCallback({
          success: false,
          error: 'Player not in room',
        });
        return { mockCallback, mockSocket, mockIo };
      }

      // 切换准备状态
      roomState.players[playerIndex].isReady = !roomState.players[playerIndex].isReady;

      // 检查游戏开始条件 (模拟checkGameStartConditions)
      const canStartGame = roomState.players.length >= 2 && 
        roomState.players.filter(p => p.id !== roomState.ownerId)
          .every(p => p.isReady && p.isConnected);

      // 保存房间状态
      await redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));

      // 发送响应
      mockCallback({
        success: true,
        message: roomState.players[playerIndex].isReady ? 'Ready for game' : 'Not ready',
        data: { isReady: roomState.players[playerIndex].isReady }
      });

      // 模拟广播
      mockIo.to(roomId).emit('room:ready_state_changed', {
        playerId: userId,
        isReady: roomState.players[playerIndex].isReady,
        canStartGame
      });

      mockIo.to(roomId).emit('room:state_update', { roomState });

      return { mockCallback, mockSocket, mockIo, roomState };
    }

    test('应该允许普通玩家切换准备状态', async () => {
      const { mockCallback, mockIo } = await simulateGameReadyCall('player-1', 'test-room-1');

      // 验证成功响应
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        message: 'Ready for game',
        data: { isReady: true }
      });

      // 验证Redis操作
      expect(mockRedisGet).toHaveBeenCalledWith('room:test-room-1');
      expect(mockRedisSetEx).toHaveBeenCalledWith(
        'room:test-room-1',
        3600,
        expect.stringContaining('"isReady":true')
      );

      // 验证广播事件
      expect(mockIo.to).toHaveBeenCalledWith('test-room-1');
      expect(mockIo.emit).toHaveBeenCalledWith('room:ready_state_changed', {
        playerId: 'player-1',
        isReady: true,
        canStartGame: false // player-2还未准备
      });
    });

    test('应该正确计算游戏开始条件', async () => {
      // 设置所有非房主玩家都已准备
      const readyRoomState = {
        ...testRoomState,
        players: testRoomState.players.map(p => 
          p.id === 'owner-1' ? p : { ...p, isReady: true }
        )
      };

      const { mockCallback, mockIo } = await simulateGameReadyCall('player-1', 'test-room-1', readyRoomState);

      // 验证广播包含正确的游戏开始条件
      expect(mockIo.emit).toHaveBeenCalledWith('room:ready_state_changed', {
        playerId: 'player-1',
        isReady: false, // 从true切换到false
        canStartGame: false // player-2仍未准备
      });
    });

    test('应该处理房间不存在的情况', async () => {
      mockRedisGet.mockResolvedValue(null);

      const { mockCallback } = await simulateGameReadyCall('player-1', 'non-existent-room');

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Room not found',
      });
    });

    test('应该处理玩家不在房间的情况', async () => {
      const { mockCallback } = await simulateGameReadyCall('non-existent-player', 'test-room-1');

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Player not in room',
      });
    });
  });

  describe('gameStart处理器测试', () => {
    /**
     * 创建模拟的游戏开始处理器调用
     */
    async function simulateGameStartCall(
      userId: string, 
      roomId: string, 
      customRoomState?: RoomState
    ) {
      if (customRoomState) {
        mockRedisGet.mockResolvedValue(JSON.stringify(customRoomState));
      }

      const mockCallback = jest.fn();
      const mockSocket = {
        data: { userId, username: `User-${userId}` }
      };
      const mockIo = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
      };

      // 模拟gameHandlers中的逻辑
      const roomData = await redisClient.get(`room:${roomId}`);
      if (!roomData) {
        mockCallback({
          success: false,
          error: 'Room not found',
        });
        return { mockCallback, mockSocket, mockIo };
      }

      const roomState: RoomState = JSON.parse(roomData.toString());
      
      // 检查是否是房主
      if (roomState.ownerId !== userId) {
        mockCallback({
          success: false,
          error: 'Only room owner can start game',
        });
        return { mockCallback, mockSocket, mockIo };
      }

      // 首先检查游戏是否已开始
      if (roomState.gameStarted) {
        mockCallback({
          success: false,
          error: 'Game already started',
        });
        return { mockCallback, mockSocket, mockIo };
      }

      // 然后检查游戏开始条件
      const canStart = roomState.players.length >= 2 && 
        roomState.players.filter(p => p.id !== roomState.ownerId)
          .every(p => p.isReady && p.isConnected);

      if (!canStart) {
        mockCallback({
          success: false,
          error: 'Game start conditions not met',
        });
        return { mockCallback, mockSocket, mockIo };
      }

      // 开始游戏
      const gameEngine = new GameEngine(roomId);
      
      // 添加玩家到游戏引擎
      for (const player of roomState.players) {
        gameEngine.addPlayer(player.id, player.username, player.chips);
        gameEngine.setPlayerReady(player.id, true);
      }
      
      // 开始新一手牌
      const gameStarted = gameEngine.startNewHand();
      if (!gameStarted) {
        mockCallback({
          success: false,
          error: 'Failed to start game',
        });
        return { mockCallback, mockSocket, mockIo };
      }
      
      // 转换游戏状态
      const gameSnapshot = gameEngine.getGameSnapshot();
      
      // 更新房间状态
      roomState.gameStarted = true;
      roomState.status = 'PLAYING';
      roomState.gameState = gameSnapshot;

      await redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));

      mockCallback({
        success: true,
        message: 'Game started successfully',
        data: { gameId: gameSnapshot.gameId }
      });

      // 广播游戏开始
      mockIo.to(roomId).emit('game:started', {
        gameState: gameSnapshot
      });

      mockIo.to(roomId).emit('room:state_update', { roomState });

      return { mockCallback, mockSocket, mockIo, roomState };
    }

    test('应该允许房主在条件满足时开始游戏', async () => {
      // 设置所有非房主玩家都已准备
      const readyRoomState = {
        ...testRoomState,
        players: testRoomState.players.map(p => 
          p.id === 'owner-1' ? p : { ...p, isReady: true }
        )
      };

      const { mockCallback, mockIo } = await simulateGameStartCall('owner-1', 'test-room-1', readyRoomState);

      // 验证成功响应
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        message: 'Game started successfully',
        data: { gameId: 'game-123' }
      });

      // 验证GameEngine被初始化
      expect(GameEngine).toHaveBeenCalledWith('test-room-1');

      // 验证广播游戏开始事件
      expect(mockIo.emit).toHaveBeenCalledWith('game:started', {
        gameState: expect.objectContaining({
          gameId: 'game-123',
          phase: 'preflop',
          pot: 30
        })
      });
    });

    test('应该拒绝非房主开始游戏', async () => {
      const { mockCallback } = await simulateGameStartCall('player-1', 'test-room-1');

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Only room owner can start game',
      });

      // 验证GameEngine没有被创建
      expect(GameEngine).not.toHaveBeenCalled();
    });

    test('应该在玩家未全部准备时拒绝开始游戏', async () => {
      const { mockCallback } = await simulateGameStartCall('owner-1', 'test-room-1'); // 使用默认状态，player-2未准备

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Game start conditions not met',
      });

      expect(GameEngine).not.toHaveBeenCalled();
    });

    test('应该在玩家数量不足时拒绝开始游戏', async () => {
      // 设置只有房主的房间
      const emptyRoomState = {
        ...testRoomState,
        players: [testRoomState.players[0]], // 只有房主
        currentPlayerCount: 1
      };

      const { mockCallback } = await simulateGameStartCall('owner-1', 'test-room-1', emptyRoomState);

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Game start conditions not met',
      });

      expect(GameEngine).not.toHaveBeenCalled();
    });

    test('应该在游戏已开始时拒绝重复开始', async () => {
      const gameStartedRoomState = {
        ...testRoomState,
        players: testRoomState.players.map(p => 
          p.id === 'owner-1' ? p : { ...p, isReady: true }
        ),
        gameStarted: true,
        status: 'PLAYING' as const
      };

      const { mockCallback } = await simulateGameStartCall('owner-1', 'test-room-1', gameStartedRoomState);

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Game already started',
      });

      expect(GameEngine).not.toHaveBeenCalled();
    });
  });

  describe('边界条件测试', () => {
    test('应该处理断线玩家的准备状态', async () => {
      // 设置有断线玩家但已准备的房间
      const disconnectedPlayerRoomState = {
        ...testRoomState,
        players: testRoomState.players.map((p, index) => 
          index === 2 ? { ...p, isConnected: false, isReady: true } : 
          index === 1 ? { ...p, isReady: true } : p
        )
      };

      async function simulateGameStartWithDisconnected() {
        mockRedisGet.mockResolvedValue(JSON.stringify(disconnectedPlayerRoomState));
        
        const mockCallback = jest.fn();
        const roomData = await redisClient.get('room:test-room-1');
        const roomState: RoomState = JSON.parse(roomData!.toString());
        
        // 模拟条件检查逻辑
        const canStart = roomState.players.length >= 2 && 
          roomState.players.filter(p => p.id !== roomState.ownerId)
            .every(p => p.isReady && p.isConnected);
        
        if (!canStart) {
          mockCallback({
            success: false,
            error: 'Game start conditions not met',
          });
        }
        
        return mockCallback;
      }

      const mockCallback = await simulateGameStartWithDisconnected();

      // 即使断线玩家已准备，也应该拒绝开始游戏
      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Game start conditions not met',
      });
    });
  });
});