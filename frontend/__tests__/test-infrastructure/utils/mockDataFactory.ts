/**
 * Mock数据工厂
 * 
 * 生成测试用的各种Mock数据
 */

// 用户相关Mock数据
export const MockDataFactory = {
  user: {
    basic: () => ({
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      chips: 5000,
      avatar: null,
      createdAt: new Date('2024-01-01')
    }),

    withChips: (chips: number) => ({
      ...MockDataFactory.user.basic(),
      chips
    }),

    withUsername: (username: string) => ({
      ...MockDataFactory.user.basic(),
      username
    }),

    multiple: (count: number) => 
      Array.from({ length: count }, (_, i) => ({
        id: `user-${i + 1}`,
        username: `user${i + 1}`,
        email: `user${i + 1}@example.com`,
        chips: 1000 + i * 500,
        avatar: null,
        createdAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`)
      }))
  },

  room: {
    basic: () => ({
      id: 'room-123',
      ownerId: 'user-456',
      owner: { id: 'user-456', username: 'roomowner' },
      playerLimit: 6,
      currentPlayers: 2,
      hasPassword: false,
      status: 'WAITING' as const,
      bigBlind: 20,
      smallBlind: 10,
      gameStarted: false,
      createdAt: '2025-06-15T10:00:00.000Z'
    }),

    withPlayers: (playerCount: number) => ({
      ...MockDataFactory.room.basic(),
      currentPlayers: playerCount
    }),

    withStatus: (status: 'WAITING' | 'PLAYING' | 'FINISHED') => ({
      ...MockDataFactory.room.basic(),
      status,
      gameStarted: status === 'PLAYING'
    }),

    withPassword: () => ({
      ...MockDataFactory.room.basic(),
      hasPassword: true
    }),

    multiple: (count: number) => 
      Array.from({ length: count }, (_, i) => ({
        id: `room-${i + 1}`,
        ownerId: `user-${i + 100}`,
        owner: { id: `user-${i + 100}`, username: `owner${i + 1}` },
        playerLimit: 6,
        currentPlayers: (i % 6) + 1,
        hasPassword: i % 3 === 0,
        status: (i % 2 === 0 ? 'WAITING' : 'PLAYING') as const,
        bigBlind: 20 + i * 10,
        smallBlind: 10 + i * 5,
        gameStarted: i % 2 === 1,
        createdAt: new Date(Date.now() - i * 60000).toISOString()
      }))
  },

  gameState: {
    basic: () => ({
      gameId: 'game-123',
      phase: 'preflop' as const,
      pot: 150,
      currentPlayer: 'user-123',
      players: MockDataFactory.player.multiple(4),
      communityCards: [],
      round: 1
    }),

    withPhase: (phase: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown') => ({
      ...MockDataFactory.gameState.basic(),
      phase,
      communityCards: phase === 'preflop' ? [] : 
                     phase === 'flop' ? ['AH', 'KS', 'QD'] :
                     phase === 'turn' ? ['AH', 'KS', 'QD', 'JC'] :
                     ['AH', 'KS', 'QD', 'JC', '10H']
    }),

    withPot: (pot: number) => ({
      ...MockDataFactory.gameState.basic(),
      pot
    })
  },

  player: {
    basic: () => ({
      id: 'player-123',
      username: 'player1',
      chips: 1000,
      bet: 0,
      cards: ['AH', 'KS'],
      position: 0,
      isDealer: false,
      isSmallBlind: false,
      isBigBlind: false,
      hasActed: false,
      isFolded: false,
      isAllIn: false
    }),

    withChips: (chips: number) => ({
      ...MockDataFactory.player.basic(),
      chips
    }),

    withPosition: (position: number, isDealer = false, isSmallBlind = false, isBigBlind = false) => ({
      ...MockDataFactory.player.basic(),
      position,
      isDealer,
      isSmallBlind,
      isBigBlind
    }),

    multiple: (count: number) => 
      Array.from({ length: count }, (_, i) => ({
        id: `player-${i + 1}`,
        username: `player${i + 1}`,
        chips: 1000 + i * 100,
        bet: 0,
        cards: i === 0 ? ['AH', 'KS'] : [], // 只给第一个玩家显示牌
        position: i,
        isDealer: i === 0,
        isSmallBlind: i === 1 && count > 1,
        isBigBlind: i === 2 && count > 2,
        hasActed: false,
        isFolded: false,
        isAllIn: false
      }))
  },

  socketResponse: {
    success: (data?: any) => ({
      success: true,
      data: data || null
    }),

    error: (message = 'Operation failed', code?: string) => ({
      success: false,
      error: message,
      code
    }),

    roomJoin: (roomId = 'room-123') => ({
      success: true,
      data: {
        roomState: MockDataFactory.room.basic()
      }
    }),

    gameAction: () => ({
      success: true,
      data: {
        gameState: MockDataFactory.gameState.basic()
      }
    })
  },

  // 网络质量数据
  networkQuality: {
    excellent: () => ({ ping: 50, status: 'excellent' as const }),
    good: () => ({ ping: 150, status: 'good' as const }),
    poor: () => ({ ping: 500, status: 'poor' as const }),
    offline: () => ({ ping: 0, status: 'offline' as const })
  },

  // 分页数据
  pagination: {
    basic: (page = 1, limit = 10, total = 50) => ({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }),

    firstPage: (limit = 10, total = 50) => 
      MockDataFactory.pagination.basic(1, limit, total),

    lastPage: (limit = 10, total = 50) => {
      const totalPages = Math.ceil(total / limit);
      return MockDataFactory.pagination.basic(totalPages, limit, total);
    }
  }
};