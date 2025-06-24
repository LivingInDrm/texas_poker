import { roomCleanupService, RoomCleanupService } from '../../src/services/roomCleanupService';
import { redisClient } from '../../src/db';
import prisma from '../../src/prisma';

// Mock Redis and Prisma
jest.mock('../../src/db');
jest.mock('../../src/prisma', () => ({
  default: {
    room: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;
const mockPrisma = {
  room: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
} as any;

describe('RoomCleanupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Reset the service to clean state
    const service = RoomCleanupService.getInstance();
    service.setEnabled(true);
    
    // Clear any existing timers
    const activeTimers = service.getActiveCleanupTimers();
    activeTimers.forEach(roomId => service.cancelRoomCleanup(roomId));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RoomCleanupService.getInstance();
      const instance2 = RoomCleanupService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('scheduleRoomCleanup', () => {
    it('should schedule cleanup when room has no online users', async () => {
      const roomId = 'test-room-1';
      
      // Mock room state with no online users
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        id: roomId,
        players: [
          { id: 'user1', isConnected: false },
          { id: 'user2', isConnected: false }
        ]
      }));

      await roomCleanupService.scheduleRoomCleanup(roomId);

      const activeTimers = roomCleanupService.getActiveCleanupTimers();
      expect(activeTimers).toContain(roomId);
    });

    it('should not schedule cleanup when room has online users', async () => {
      const roomId = 'test-room-2';
      
      // Mock room state with online users
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        id: roomId,
        players: [
          { id: 'user1', isConnected: true },
          { id: 'user2', isConnected: false }
        ]
      }));

      await roomCleanupService.scheduleRoomCleanup(roomId);

      const activeTimers = roomCleanupService.getActiveCleanupTimers();
      expect(activeTimers).not.toContain(roomId);
    });

    it('should replace existing timer when called multiple times', async () => {
      const roomId = 'test-room-3';
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        id: roomId,
        players: []
      }));

      // Schedule first cleanup
      await roomCleanupService.scheduleRoomCleanup(roomId);
      const timersAfterFirst = roomCleanupService.getActiveCleanupTimers();
      expect(timersAfterFirst).toContain(roomId);

      // Schedule second cleanup (should replace first)
      await roomCleanupService.scheduleRoomCleanup(roomId);
      const timersAfterSecond = roomCleanupService.getActiveCleanupTimers();
      expect(timersAfterSecond).toContain(roomId);
      expect(timersAfterSecond.length).toBe(1);
    });
  });

  describe('cancelRoomCleanup', () => {
    it('should cancel scheduled cleanup', async () => {
      const roomId = 'test-room-4';
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        id: roomId,
        players: []
      }));

      await roomCleanupService.scheduleRoomCleanup(roomId);
      expect(roomCleanupService.getActiveCleanupTimers()).toContain(roomId);

      roomCleanupService.cancelRoomCleanup(roomId);
      expect(roomCleanupService.getActiveCleanupTimers()).not.toContain(roomId);
    });

    it('should handle canceling non-existent timer gracefully', () => {
      expect(() => {
        roomCleanupService.cancelRoomCleanup('non-existent-room');
      }).not.toThrow();
    });
  });

  describe('performRoomCleanup', () => {
    it('should clean up empty room successfully', async () => {
      const roomId = 'test-room-5';
      
      // Mock empty room
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        id: roomId,
        players: []
      }));
      
      mockRedisClient.del.mockResolvedValue(1);
      mockPrisma.room.findUnique.mockResolvedValue({
        id: roomId,
        status: 'WAITING'
      } as any);
      mockPrisma.room.delete.mockResolvedValue({} as any);

      const result = await roomCleanupService.performRoomCleanup(roomId);

      expect(result.success).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`room:${roomId}`);
      expect(mockPrisma.room.delete).toHaveBeenCalledWith({ where: { id: roomId } });
    });

    it('should abort cleanup if room has online users', async () => {
      const roomId = 'test-room-6';
      
      // Mock room with online users
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        id: roomId,
        players: [{ id: 'user1', isConnected: true }]
      }));

      const result = await roomCleanupService.performRoomCleanup(roomId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Room has online users');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const roomId = 'test-room-7';
      
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await roomCleanupService.performRoomCleanup(roomId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Redis connection failed');
    });
  });

  describe('getRoomOnlineUserCount', () => {
    it('should return correct count of online users', async () => {
      const roomId = 'test-room-8';
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        id: roomId,
        players: [
          { id: 'user1', isConnected: true },
          { id: 'user2', isConnected: false },
          { id: 'user3', isConnected: true }
        ]
      }));

      const count = await roomCleanupService.getRoomOnlineUserCount(roomId);
      expect(count).toBe(2);
    });

    it('should return 0 for non-existent room', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const count = await roomCleanupService.getRoomOnlineUserCount('non-existent');
      expect(count).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return correct service status', () => {
      const status = roomCleanupService.getStatus();
      
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('cleanupDelayMs');
      expect(status).toHaveProperty('activeTimers');
      expect(status).toHaveProperty('activeRooms');
      expect(typeof status.enabled).toBe('boolean');
      expect(typeof status.cleanupDelayMs).toBe('number');
      expect(typeof status.activeTimers).toBe('number');
      expect(Array.isArray(status.activeRooms)).toBe(true);
    });
  });

  describe('integration with timer system', () => {
    it('should execute cleanup after delay', async () => {
      const roomId = 'test-room-timer';
      
      // Mock empty room
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        id: roomId,
        players: []
      }));
      
      mockRedisClient.del.mockResolvedValue(1);
      mockPrisma.room.findUnique.mockResolvedValue({
        id: roomId,
        status: 'WAITING'
      } as any);
      mockPrisma.room.delete.mockResolvedValue({} as any);

      // Schedule cleanup
      await roomCleanupService.scheduleRoomCleanup(roomId);
      
      expect(roomCleanupService.getActiveCleanupTimers()).toContain(roomId);

      // Fast forward time to trigger cleanup
      jest.advanceTimersByTime(30000);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockRedisClient.del).toHaveBeenCalledWith(`room:${roomId}`);
      expect(roomCleanupService.getActiveCleanupTimers()).not.toContain(roomId);
    });
  });
});