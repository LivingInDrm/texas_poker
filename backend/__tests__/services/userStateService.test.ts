import { MockFactory } from '../shared/mockFactory';
import { TestDataGenerator, MockDataConfigurator, TimerCleanup, TypeScriptCompatibility } from '../shared/testDataGenerator';
import { createMockAuthenticatedSocket } from '../shared/socketTestUtils';

// Create mocks first
const mockRedis = MockFactory.createRedisMock();
const mockPrisma = MockFactory.createPrismaMock();

// Mock dependencies before importing
jest.mock('../../src/db', () => ({
  redisClient: mockRedis
}));
jest.mock('../../src/prisma', () => ({
  default: mockPrisma
}));

// Import after mocking
import { userStateService } from '../../src/services/userStateService';

describe('UserStateService Comprehensive Tests', () => {
  let mocks: any;
  let testData: any;

  beforeAll(() => {
    // Create comprehensive mock setup
    mocks = {
      redis: mockRedis,
      prisma: mockPrisma
    };
    
    testData = {
      users: TestDataGenerator.generateUsers(3, {
        chips: 5000
      }),
      roomState: TestDataGenerator.createRedisRoomStateData({
        id: 'room-123',
        ownerId: 'user-1',
        currentPlayers: 2,
        players: [
          {
            id: 'user-1',
            username: 'user1',
            chips: 5000,
            position: 0,
            isOwner: true,
            isConnected: true
          },
          {
            id: 'user-2', 
            username: 'user2',
            chips: 5000,
            position: 1,
            isOwner: false,
            isConnected: true
          }
        ]
      })
    };

    // Configure mocks
    MockDataConfigurator.configureAllMocks(mocks, testData);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    TimerCleanup.cleanup();

    // Setup default Redis behavior
    mocks.redis.get.mockImplementation((key: string) => {
      if (key === 'user_room:user-1') return Promise.resolve('room-123');
      if (key === 'user_room:user-2') return Promise.resolve('room-123');
      if (key === 'user_room:user-3') return Promise.resolve(null);
      if (key === 'room:room-123') return Promise.resolve(JSON.stringify(testData.roomState));
      if (key === 'room:nonexistent') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    mocks.redis.setEx.mockResolvedValue('OK');
    mocks.redis.del.mockResolvedValue(1);
    mocks.redis.exists.mockResolvedValue(1);
    mocks.redis.keys.mockResolvedValue(['user_room:user-1', 'user_room:user-2']);

    // Setup default Prisma behavior
    mocks.prisma.room.findUnique.mockResolvedValue({
      id: 'room-123',
      status: 'WAITING',
      ownerId: 'user-1'
    });
    mocks.prisma.room.delete.mockResolvedValue({});
    mocks.prisma.room.update.mockResolvedValue({});
  });

  afterEach(() => {
    TimerCleanup.cleanup();
  });

  describe('getUserCurrentRoom', () => {
    it('should return current room for user with room', async () => {
      const result = await userStateService.getUserCurrentRoom('user-1');
      
      expect(result).toBe('room-123');
      expect(mocks.redis.get).toHaveBeenCalledWith('user_room:user-1');
    });

    it('should return null for user without room', async () => {
      const result = await userStateService.getUserCurrentRoom('user-3');
      
      expect(result).toBeNull();
      expect(mocks.redis.get).toHaveBeenCalledWith('user_room:user-3');
    });

    it('should handle Redis errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mocks.redis.get.mockRejectedValue(new Error('Redis connection failed'));
      
      const result = await userStateService.getUserCurrentRoom('user-1');
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error getting user current room:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle empty Redis response', async () => {
      mocks.redis.get.mockResolvedValue('');
      
      const result = await userStateService.getUserCurrentRoom('user-1');
      
      expect(result).toBeNull();
    });
  });

  describe('setUserCurrentRoom', () => {
    it('should set user current room successfully', async () => {
      const result = await userStateService.setUserCurrentRoom('user-3', 'room-456');
      
      expect(result).toBe(true);
      expect(mocks.redis.setEx).toHaveBeenCalledWith('user_room:user-3', 3600, 'room-456');
    });

    it('should handle Redis errors during set', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mocks.redis.setEx.mockRejectedValue(new Error('Redis write failed'));
      
      const result = await userStateService.setUserCurrentRoom('user-1', 'room-1');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error setting user current room:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle concurrent set operations', async () => {
      const userId = 'user-concurrent';
      const setOperations = Array.from({ length: 5 }, (_, i) =>
        userStateService.setUserCurrentRoom(userId, `room-${i}`)
      );
      
      const results = await Promise.all(setOperations);
      
      results.forEach(result => expect(result).toBe(true));
      expect(mocks.redis.setEx).toHaveBeenCalledTimes(5);
    });
  });

  describe('clearUserCurrentRoom', () => {
    it('should clear user current room successfully', async () => {
      const result = await userStateService.clearUserCurrentRoom('user-1');
      
      expect(result).toBe(true);
      expect(mocks.redis.del).toHaveBeenCalledWith('user_room:user-1');
    });

    it('should handle Redis errors during clear', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mocks.redis.del.mockRejectedValue(new Error('Redis delete failed'));
      
      const result = await userStateService.clearUserCurrentRoom('user-1');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error clearing user current room:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle clearing non-existent room gracefully', async () => {
      mocks.redis.del.mockResolvedValue(0); // No key deleted
      
      const result = await userStateService.clearUserCurrentRoom('nonexistent-user');
      
      expect(result).toBe(true); // Should still return true
      expect(mocks.redis.del).toHaveBeenCalledWith('user_room:nonexistent-user');
    });
  });

  describe('forceLeaveCurrentRoom', () => {
    let mockSocket: any;
    let mockIo: any;

    beforeEach(() => {
      mockSocket = createMockAuthenticatedSocket({
        userId: 'user-1',
        username: 'user1',
        roomId: 'room-123'
      });
      mockIo = MockFactory.createIOMock();
    });

    it('should handle user with no current room', async () => {
      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-free') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await userStateService.forceLeaveCurrentRoom(
        'user-free',
        mockSocket,
        mockIo,
        'Test reason'
      );

      expect(result.success).toBe(true);
      expect(result.previousRoomId).toBeUndefined();
    });

    it('should handle room not found in Redis', async () => {
      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-1') return Promise.resolve('nonexistent-room');
        if (key === 'room:nonexistent-room') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await userStateService.forceLeaveCurrentRoom(
        'user-1',
        mockSocket,
        mockIo,
        'Room deleted'
      );

      expect(result.success).toBe(true);
      expect(result.previousRoomId).toBe('nonexistent-room');
      expect(mocks.redis.del).toHaveBeenCalledWith('user_room:user-1');
    });

    it('should handle user not in room player list', async () => {
      const roomStateWithoutUser = {
        ...testData.roomState,
        players: testData.roomState.players.filter((p: any) => p.id !== 'user-1')
      };
      
      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-1') return Promise.resolve('room-123');
        if (key === 'room:room-123') return Promise.resolve(JSON.stringify(roomStateWithoutUser));
        return Promise.resolve(null);
      });

      const result = await userStateService.forceLeaveCurrentRoom(
        'user-1',
        mockSocket,
        mockIo,
        'Player not found'
      );

      expect(result.success).toBe(true);
      expect(result.previousRoomId).toBe('room-123');
      expect(mocks.redis.del).toHaveBeenCalledWith('user_room:user-1');
    });

    it('should remove user from room and update positions', async () => {
      const result = await userStateService.forceLeaveCurrentRoom(
        'user-1',
        mockSocket,
        mockIo,
        'Kicked by admin'
      );

      expect(result.success).toBe(true);
      expect(result.previousRoomId).toBe('room-123');
      
      // Should clear user room state
      expect(mocks.redis.del).toHaveBeenCalledWith('user_room:user-1');
      
      // Should update room state without the user
      expect(mocks.redis.setEx).toHaveBeenCalledWith(
        'room:room-123',
        3600,
        expect.stringContaining('"currentPlayerCount":1')
      );
      
      // Should notify user
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: expect.stringContaining('Kicked by admin'),
        code: 'FORCED_ROOM_LEAVE'
      });
    });

    it('should delete empty room from Redis and database', async () => {
      const roomWithOnlyOnePlayer = {
        ...testData.roomState,
        currentPlayers: 1,
        players: [{
          id: 'user-1',
          username: 'user1',
          chips: 5000,
          position: 0,
          isOwner: true,
          isConnected: true
        }]
      };

      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-1') return Promise.resolve('room-123');
        if (key === 'room:room-123') return Promise.resolve(JSON.stringify(roomWithOnlyOnePlayer));
        return Promise.resolve(null);
      });

      mocks.prisma.room.findUnique.mockResolvedValue({
        id: 'room-123',
        status: 'WAITING'
      });
      mocks.prisma.room.delete.mockResolvedValue({});

      const result = await userStateService.forceLeaveCurrentRoom(
        'user-1',
        mockSocket,
        mockIo,
        'Last player leaving'
      );

      expect(result.success).toBe(true);
      expect(mocks.redis.del).toHaveBeenCalledWith('room:room-123');
      expect(mocks.prisma.room.delete).toHaveBeenCalledWith({ where: { id: 'room-123' } });
    });

    it('should transfer ownership when owner leaves', async () => {
      mocks.prisma.room.update.mockResolvedValue({});

      const result = await userStateService.forceLeaveCurrentRoom(
        'user-1', // Owner
        mockSocket,
        mockIo,
        'Owner leaving'
      );

      expect(result.success).toBe(true);
      
      // Should transfer ownership to first remaining player
      expect(mocks.prisma.room.update).toHaveBeenCalledWith({
        where: { id: 'room-123' },
        data: { ownerId: 'user-2' }
      });
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-1') return Promise.reject(new Error('Redis error'));
        return Promise.resolve(null);
      });

      const result = await userStateService.forceLeaveCurrentRoom(
        'user-1',
        mockSocket,
        mockIo,
        'Error test'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to force leave current room');
      expect(consoleSpy).toHaveBeenCalledWith('Error forcing user to leave current room:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('checkAndHandleRoomConflict', () => {
    let mockSocket: any;
    let mockIo: any;

    beforeEach(() => {
      mockSocket = createMockAuthenticatedSocket({
        userId: 'user-1',
        username: 'user1'
      });
      mockIo = MockFactory.createIOMock();
    });

    it('should allow user to join when not in any room', async () => {
      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-free') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await userStateService.checkAndHandleRoomConflict(
        'user-free',
        'room-456',
        mockSocket,
        mockIo
      );

      expect(result.canJoin).toBe(true);
      expect(result.previousRoomId).toBeUndefined();
    });

    it('should allow user to join same room they are already in', async () => {
      const result = await userStateService.checkAndHandleRoomConflict(
        'user-1',
        'room-123', // Same room user is already in
        mockSocket,
        mockIo
      );

      expect(result.canJoin).toBe(true);
      expect(result.previousRoomId).toBeUndefined();
    });

    it('should force leave from current room when joining different room', async () => {
      // Mock a successful force leave
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await userStateService.checkAndHandleRoomConflict(
        'user-1',
        'room-456', // Different room
        mockSocket,
        mockIo
      );

      expect(result.canJoin).toBe(true);
      expect(result.previousRoomId).toBe('room-123');
      
      consoleSpy.mockRestore();
    });

    it('should handle force leave errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-1') return Promise.reject(new Error('Redis error'));
        return Promise.resolve(null);
      });

      const result = await userStateService.checkAndHandleRoomConflict(
        'user-1',
        'room-456',
        mockSocket,
        mockIo
      );

      expect(result.canJoin).toBe(false);
      expect(result.error).toBe('Failed to check room conflict');
      
      consoleSpy.mockRestore();
    });
  });

  describe('validateRoomStateConsistency', () => {
    it('should return consistent for user with no room', async () => {
      const result = await userStateService.validateRoomStateConsistency('user-3');

      expect(result.consistent).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.fixedIssues).toHaveLength(0);
    });

    it('should detect and fix user referencing non-existent room', async () => {
      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-orphan') return Promise.resolve('nonexistent-room');
        if (key === 'room:nonexistent-room') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await userStateService.validateRoomStateConsistency('user-orphan');

      expect(result.consistent).toBe(false);
      expect(result.issues).toContainEqual(expect.stringContaining('references non-existent room'));
      expect(result.fixedIssues).toContainEqual(expect.stringContaining('Cleared invalid room reference'));
      expect(mocks.redis.del).toHaveBeenCalledWith('user_room:user-orphan');
    });

    it('should detect and fix user not in room player list', async () => {
      const roomWithoutUser = {
        ...testData.roomState,
        players: testData.roomState.players.filter((p: any) => p.id !== 'user-1')
      };

      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-1') return Promise.resolve('room-123');
        if (key === 'room:room-123') return Promise.resolve(JSON.stringify(roomWithoutUser));
        return Promise.resolve(null);
      });

      const result = await userStateService.validateRoomStateConsistency('user-1');

      expect(result.consistent).toBe(false);
      expect(result.issues).toContainEqual(expect.stringContaining('not found in room'));
      expect(result.fixedIssues).toContainEqual(expect.stringContaining('Cleared room reference'));
      expect(mocks.redis.del).toHaveBeenCalledWith('user_room:user-1');
    });

    it('should return consistent for valid user-room relationship', async () => {
      const result = await userStateService.validateRoomStateConsistency('user-1');

      expect(result.consistent).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.fixedIssues).toHaveLength(0);
    });

    it('should handle validation errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-1') return Promise.reject(new Error('Redis error'));
        return Promise.resolve(null);
      });

      const result = await userStateService.validateRoomStateConsistency('user-1');

      expect(result.consistent).toBe(false);
      expect(result.issues).toContainEqual(expect.stringContaining('Error validating consistency'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getRoomOnlineUsers', () => {
    it('should return online users for existing room', async () => {
      const result = await userStateService.getRoomOnlineUsers('room-123');

      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('should return empty array for non-existent room', async () => {
      const result = await userStateService.getRoomOnlineUsers('nonexistent');

      expect(result).toEqual([]);
    });

    it('should filter out disconnected users', async () => {
      const roomWithDisconnectedUsers = {
        ...testData.roomState,
        players: [
          ...testData.roomState.players,
          {
            id: 'user-3',
            username: 'user3',
            chips: 5000,
            position: 2,
            isOwner: false,
            isConnected: false // Disconnected
          }
        ]
      };

      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'room:room-123') return Promise.resolve(JSON.stringify(roomWithDisconnectedUsers));
        return Promise.resolve(null);
      });

      const result = await userStateService.getRoomOnlineUsers('room-123');

      expect(result).toEqual(['user-1', 'user-2']); // user-3 should be filtered out
    });

    it('should handle Redis errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mocks.redis.get.mockRejectedValue(new Error('Redis error'));

      const result = await userStateService.getRoomOnlineUsers('room-123');

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error getting room online users:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('cleanupOrphanedUserStates', () => {
    it('should identify and clean orphaned user states', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mocks.redis.keys.mockResolvedValue(['user_room:user-1', 'user_room:orphan']);
      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-1') return Promise.resolve('room-123');
        if (key === 'user_room:orphan') return Promise.resolve('nonexistent-room');
        return Promise.resolve(null);
      });
      mocks.redis.exists.mockImplementation((key: string) => {
        if (key === 'room:room-123') return Promise.resolve(1);
        if (key === 'room:nonexistent-room') return Promise.resolve(0);
        return Promise.resolve(0);
      });

      const result = await userStateService.cleanupOrphanedUserStates();

      expect(result.cleaned).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mocks.redis.del).toHaveBeenCalledWith('user_room:orphan');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaned orphaned user state'));
      
      consoleSpy.mockRestore();
    });

    it('should handle Redis errors during cleanup', async () => {
      mocks.redis.keys.mockRejectedValue(new Error('Redis keys failed'));

      const result = await userStateService.cleanupOrphanedUserStates();

      expect(result.cleaned).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle partial failures gracefully', async () => {
      mocks.redis.keys.mockResolvedValue(['user_room:user-1', 'user_room:error-user']);
      mocks.redis.get.mockImplementation((key: string) => {
        if (key === 'user_room:user-1') return Promise.resolve('room-123');
        if (key === 'user_room:error-user') return Promise.reject(new Error('Get failed'));
        return Promise.resolve(null);
      });

      const result = await userStateService.cleanupOrphanedUserStates();

      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Error processing');
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle high concurrency operations', async () => {
      const operations = Array.from({ length: 50 }, (_, i) => [
        userStateService.setUserCurrentRoom(`user-${i}`, `room-${i % 5}`),
        userStateService.getUserCurrentRoom(`user-${i}`),
        userStateService.clearUserCurrentRoom(`user-${i}`)
      ]).flat();

      const start = Date.now();
      await Promise.all(operations);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle bulk operations efficiently', async () => {
      const userIds = Array.from({ length: 20 }, (_, i) => `bulk-user-${i}`);

      const start = Date.now();

      // Bulk set operations
      await Promise.all(
        userIds.map(userId => 
          userStateService.setUserCurrentRoom(userId, 'bulk-room')
        )
      );

      // Bulk get operations
      await Promise.all(
        userIds.map(userId => 
          userStateService.getUserCurrentRoom(userId)
        )
      );

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Error Recovery', () => {
    it('should recover from Redis connection failures', async () => {
      // Simulate Redis failure then recovery
      mocks.redis.get
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce('room-123');

      const result1 = await userStateService.getUserCurrentRoom('user-1');
      const result2 = await userStateService.getUserCurrentRoom('user-1');

      expect(result1).toBeNull(); // Failed call
      expect(result2).toBe('room-123'); // Recovered call
    });

    it('should handle partial Redis failures in batch operations', async () => {
      mocks.redis.get.mockImplementation((key: string) => {
        if (key.includes('fail')) {
          return Promise.reject(new Error('Simulated failure'));
        }
        return Promise.resolve('room-123');
      });

      const results = await Promise.allSettled([
        userStateService.getUserCurrentRoom('user-1'),
        userStateService.getUserCurrentRoom('user-fail'),
        userStateService.getUserCurrentRoom('user-2')
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled'); // Should not reject, returns null
      expect(results[2].status).toBe('fulfilled');
    });
  });
});