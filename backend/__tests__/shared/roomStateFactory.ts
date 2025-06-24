import { RoomState, RoomPlayer, GameState } from '../../src/types/socket';

/**
 * 房间状态数据工厂
 * 统一创建测试中使用的房间状态数据，避免在多个文件中重复定义
 */
export class RoomStateFactory {
  /**
   * 创建基本的房间状态
   * 适用于大多数测试场景
   */
  static createBasicRoomState(overrides: Partial<RoomState> = {}): RoomState {
    // 生成唯一ID，避免测试中的ID冲突
    const roomId = overrides.id || `room-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
    const ownerId = overrides.ownerId || `owner-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
    
    const defaultState: RoomState = {
      id: roomId,
      ownerId: ownerId,
      status: 'WAITING',
      maxPlayers: 6,
      currentPlayerCount: 1,
      hasPassword: false,
      bigBlind: 20,
      smallBlind: 10,
      players: [
        this.createBasicPlayer({
          id: ownerId,
          username: 'roomowner'
        })
      ],
      gameStarted: false
    };

    return {
      ...defaultState,
      ...overrides,
      // 确保currentPlayerCount与players数组长度一致
      currentPlayerCount: overrides.players?.length ?? defaultState.currentPlayerCount
    };
  }

  /**
   * 创建空房间状态
   * 用于测试房间创建场景
   */
  static createEmptyRoomState(overrides: Partial<RoomState> = {}): RoomState {
    return this.createBasicRoomState({
      currentPlayerCount: 0,
      players: [],
      ...overrides
    });
  }

  /**
   * 创建满员房间状态
   * 用于测试房间满员的情况
   */
  static createFullRoomState(overrides: Partial<RoomState> = {}): RoomState {
    const players = Array.from({ length: 6 }, (_, index) => 
      this.createBasicPlayer({
        id: `player-${index + 1}`,
        username: `player${index + 1}`,
        position: index
      })
    );

    return this.createBasicRoomState({
      currentPlayerCount: 6,
      maxPlayers: 6,
      players,
      ...overrides
    });
  }

  /**
   * 创建游戏进行中的房间状态
   * 用于测试游戏相关功能
   */
  static createGameInProgressState(overrides: Partial<RoomState> = {}): RoomState {
    // 如果传入了players，使用传入的players；否则根据currentPlayerCount生成
    const playerCount = overrides.currentPlayerCount || overrides.players?.length || 2;
    const players = overrides.players || Array.from({ length: playerCount }, (_, index) => 
      this.createBasicPlayer({
        id: `player-${index + 1}`,
        username: `player${index + 1}`,
        position: index,
        chips: 4800 + (index * 100) // 轻微的筹码差异
      })
    );

    return this.createBasicRoomState({
      status: 'PLAYING',
      gameStarted: true,
      currentPlayerCount: players.length,
      players,
      gameState: this.createBasicGameState(),
      ...overrides
    });
  }

  /**
   * 创建有密码的房间状态
   * 用于测试密码验证功能
   */
  static createPasswordProtectedRoomState(overrides: Partial<RoomState> = {}): RoomState {
    return this.createBasicRoomState({
      hasPassword: true,
      ...overrides
    });
  }

  /**
   * 创建基本的玩家数据
   */
  static createBasicPlayer(overrides: any = {}): RoomPlayer {
    const defaultPlayer: RoomPlayer = {
      id: 'player-123',
      username: 'testplayer',
      avatar: undefined,
      chips: 5000,
      isReady: false,
      position: 0,
      isConnected: true,
      lastAction: undefined
    };

    return {
      ...defaultPlayer,
      ...overrides
    };
  }

  /**
   * 创建多个玩家的数组
   */
  static createPlayersArray(count: number, baseOverrides: any = {}): RoomPlayer[] {
    return Array.from({ length: count }, (_, index) => 
      this.createBasicPlayer({
        id: `player-${index + 1}`,
        username: `player${index + 1}`,
        position: index,
        ...baseOverrides
      })
    );
  }

  /**
   * 创建基本的游戏状态
   */
  static createBasicGameState(overrides: any = {}): GameState {
    const defaultGameState: GameState = {
      phase: 'preflop',
      players: [],
      dealerIndex: 0,
      smallBlindIndex: 1,
      bigBlindIndex: 2,
      currentPlayerIndex: 0,
      currentPlayerId: null,
      board: [],
      pot: 30,
      sidePots: [],
      currentBet: 20,
      roundBets: {},
      history: [],
      timeout: 30000,
      gameId: 'game-123',
      roomId: 'room-123'
    };

    return {
      ...defaultGameState,
      ...overrides
    };
  }

  /**
   * 创建不同游戏阶段的房间状态
   */
  static createRoomWithGamePhase(phase: 'preflop' | 'flop' | 'turn' | 'river', overrides: Partial<RoomState> = {}): RoomState {
    const board = {
      preflop: [],
      flop: ['Ah', 'Ks', 'Qd'],
      turn: ['Ah', 'Ks', 'Qd', 'Jc'],
      river: ['Ah', 'Ks', 'Qd', 'Jc', 'Th']
    };

    return this.createGameInProgressState({
      gameState: this.createBasicGameState({
        phase,
        board: board[phase]
      }),
      ...overrides
    });
  }

  /**
   * 为特定测试场景创建房间状态的便捷方法
   */
  static forTestScenario(scenario: string, customOverrides: Partial<RoomState> = {}): RoomState {
    const scenarios = {
      'room-join-success': () => this.createBasicRoomState({ currentPlayerCount: 2 }),
      'room-join-full': () => this.createFullRoomState(),
      'room-join-password': () => this.createPasswordProtectedRoomState(),
      'room-leave-owner-transfer': () => this.createBasicRoomState({ 
        currentPlayerCount: 3,
        players: this.createPlayersArray(3)
      }),
      'game-in-progress': () => this.createGameInProgressState(),
      'empty-room': () => this.createEmptyRoomState(),
      'waiting-room': () => this.createBasicRoomState({ status: 'WAITING' }),
      'playing-room': () => this.createGameInProgressState({ status: 'PLAYING' })
    };

    const baseState = scenarios[scenario]?.() ?? this.createBasicRoomState();
    return { ...baseState, ...customOverrides };
  }
}

/**
 * 房间状态断言辅助工具
 * 提供常用的房间状态验证方法
 */
export class RoomStateAssertions {
  /**
   * 验证房间状态的基本完整性
   */
  static assertValidRoomState(roomState: RoomState) {
    expect(roomState).toBeDefined();
    expect(roomState.id).toBeTruthy();
    expect(roomState.ownerId).toBeTruthy();
    expect(roomState.currentPlayerCount).toBe(roomState.players.length);
    expect(roomState.maxPlayers).toBeGreaterThan(0);
    expect(roomState.bigBlind).toBeGreaterThan(roomState.smallBlind);
  }

  /**
   * 验证玩家在房间中
   */
  static assertPlayerInRoom(roomState: RoomState, playerId: string) {
    const player = roomState.players.find(p => p.id === playerId);
    expect(player).toBeDefined();
    return player!;
  }

  /**
   * 验证玩家不在房间中
   */
  static assertPlayerNotInRoom(roomState: RoomState, playerId: string) {
    const player = roomState.players.find(p => p.id === playerId);
    expect(player).toBeUndefined();
  }

  /**
   * 验证房间状态
   */
  static assertRoomStatus(roomState: RoomState, expectedStatus: RoomState['status']) {
    expect(roomState.status).toBe(expectedStatus);
  }

  /**
   * 验证房间玩家数量
   */
  static assertPlayerCount(roomState: RoomState, expectedCount: number) {
    expect(roomState.currentPlayerCount).toBe(expectedCount);
    expect(roomState.players).toHaveLength(expectedCount);
  }
}