import { userStateService } from '@/services/userStateService';
import { redisClient } from '@/db';

// Mock Redis client for testing
jest.mock('@/db', () => ({
  redisClient: {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    exists: jest.fn(),
  }
}));

describe('UserStateService', () => {
  const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;
  const userId = 'test-user-id';
  const roomId = 'test-room-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserCurrentRoom', () => {
    it('should return room ID when user is in a room', async () => {
      mockRedisClient.get.mockResolvedValue(roomId);

      const result = await userStateService.getUserCurrentRoom(userId);

      expect(result).toBe(roomId);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`user_room:${userId}`);
    });

    it('should return null when user is not in any room', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await userStateService.getUserCurrentRoom(userId);

      expect(result).toBeNull();
    });

    it('should return null when Redis throws an error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await userStateService.getUserCurrentRoom(userId);

      expect(result).toBeNull();
    });
  });

  describe('setUserCurrentRoom', () => {
    it('should set user current room successfully', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK' as any);

      const result = await userStateService.setUserCurrentRoom(userId, roomId);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(`user_room:${userId}`, 3600, roomId);
    });

    it('should return false when Redis throws an error', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      const result = await userStateService.setUserCurrentRoom(userId, roomId);

      expect(result).toBe(false);
    });
  });

  describe('clearUserCurrentRoom', () => {
    it('should clear user current room successfully', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await userStateService.clearUserCurrentRoom(userId);

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`user_room:${userId}`);
    });

    it('should return false when Redis throws an error', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      const result = await userStateService.clearUserCurrentRoom(userId);

      expect(result).toBe(false);
    });
  });

  describe('cleanupOrphanedUserStates', () => {
    it('should clean up orphaned user states', async () => {
      const userRoomKeys = ['user_room:user1', 'user_room:user2', 'user_room:user3'];
      const rooms = ['room1', 'room2', 'room3'];
      
      mockRedisClient.keys.mockResolvedValue(userRoomKeys);
      mockRedisClient.get
        .mockResolvedValueOnce(rooms[0])
        .mockResolvedValueOnce(rooms[1])
        .mockResolvedValueOnce(rooms[2]);
      
      // Simulate that room1 and room3 don't exist, but room2 does
      mockRedisClient.exists
        .mockResolvedValueOnce(0) // room1 doesn't exist
        .mockResolvedValueOnce(1) // room2 exists
        .mockResolvedValueOnce(0); // room3 doesn't exist
      
      mockRedisClient.del
        .mockResolvedValueOnce(1) // delete user_room:user1
        .mockResolvedValueOnce(1); // delete user_room:user3

      const result = await userStateService.cleanupOrphanedUserStates();

      expect(result.cleaned).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.del).toHaveBeenCalledWith('user_room:user1');
      expect(mockRedisClient.del).toHaveBeenCalledWith('user_room:user3');
    });
  });
});

// Integration test example (would require actual Redis instance)
describe('UserStateService Integration', () => {
  // These tests would run against a real Redis instance
  // and test the full flow of the service
  
  it.skip('should handle complete user room lifecycle', async () => {
    const userId = 'integration-test-user';
    const roomId1 = 'integration-test-room-1';
    const roomId2 = 'integration-test-room-2';

    try {
      // Initially user should not be in any room
      let currentRoom = await userStateService.getUserCurrentRoom(userId);
      expect(currentRoom).toBeNull();

      // Set user in first room
      await userStateService.setUserCurrentRoom(userId, roomId1);
      currentRoom = await userStateService.getUserCurrentRoom(userId);
      expect(currentRoom).toBe(roomId1);

      // Move user to second room (should update)
      await userStateService.setUserCurrentRoom(userId, roomId2);
      currentRoom = await userStateService.getUserCurrentRoom(userId);
      expect(currentRoom).toBe(roomId2);

      // Clear user room
      await userStateService.clearUserCurrentRoom(userId);
      currentRoom = await userStateService.getUserCurrentRoom(userId);
      expect(currentRoom).toBeNull();
    } finally {
      // Cleanup
      await userStateService.clearUserCurrentRoom(userId);
    }
  });
});