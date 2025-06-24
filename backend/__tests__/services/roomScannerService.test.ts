import { roomScannerService, RoomScannerService } from '../../src/services/roomScannerService';
import { roomCleanupService } from '../../src/services/roomCleanupService';
import { redisClient } from '../../src/db';
import prisma from '../../src/prisma';

// Mock dependencies
jest.mock('../../src/db');
jest.mock('../../src/prisma');
jest.mock('../../src/services/roomCleanupService');

const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRoomCleanupService = roomCleanupService as jest.Mocked<typeof roomCleanupService>;

describe('RoomScannerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RoomScannerService.getInstance();
      const instance2 = RoomScannerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('scanAndCleanupEmptyRooms', () => {
    it('should scan and clean empty rooms', async () => {
      const emptyRoomId = 'empty-room-1';
      const populatedRoomId = 'populated-room-1';
      
      // Mock Redis keys
      mockRedisClient.keys.mockResolvedValue([
        `room:${emptyRoomId}`,
        `room:${populatedRoomId}`
      ]);

      // Mock room data
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({
          id: emptyRoomId,
          players: []
        }))
        .mockResolvedValueOnce(JSON.stringify({
          id: populatedRoomId,
          players: [{ id: 'user1', isConnected: true }]
        }));

      // Mock database query for orphaned rooms
      mockPrisma.room.findMany.mockResolvedValue([]);

      // Mock cleanup service
      mockRoomCleanupService.performRoomCleanup.mockResolvedValue({
        success: true
      });

      const result = await roomScannerService.scanAndCleanupEmptyRooms();

      expect(result.scanned).toBe(2);
      expect(result.emptyRooms).toBe(1);
      expect(result.cleaned).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockRoomCleanupService.performRoomCleanup).toHaveBeenCalledWith(emptyRoomId);
    });

    it('should handle rooms with no data', async () => {
      const roomId = 'missing-data-room';
      
      mockRedisClient.keys.mockResolvedValue([`room:${roomId}`]);
      mockRedisClient.get.mockResolvedValue(null);
      mockPrisma.room.findMany.mockResolvedValue([]);
      
      mockRoomCleanupService.performRoomCleanup.mockResolvedValue({
        success: true
      });

      const result = await roomScannerService.scanAndCleanupEmptyRooms();

      expect(result.scanned).toBe(1);
      expect(result.emptyRooms).toBe(1);
      expect(result.cleaned).toBe(1);
    });

    it('should handle cleanup failures', async () => {
      const roomId = 'failing-room';
      
      mockRedisClient.keys.mockResolvedValue([`room:${roomId}`]);
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        id: roomId,
        players: []
      }));
      mockPrisma.room.findMany.mockResolvedValue([]);
      
      mockRoomCleanupService.performRoomCleanup.mockResolvedValue({
        success: false,
        error: 'Cleanup failed'
      });

      const result = await roomScannerService.scanAndCleanupEmptyRooms();

      expect(result.scanned).toBe(1);
      expect(result.emptyRooms).toBe(1);
      expect(result.cleaned).toBe(0);
      expect(result.errors).toContain('Failed to clean room failing-room: Cleanup failed');
    });

    it('should clean orphaned database rooms', async () => {
      const orphanedRoomId = 'orphaned-room';
      const now = new Date();
      const oldDate = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
      
      mockRedisClient.keys.mockResolvedValue([]);
      
      // Mock orphaned room in database
      mockPrisma.room.findMany.mockResolvedValue([
        {
          id: orphanedRoomId,
          createdAt: oldDate
        }
      ] as any);
      
      // Mock that room doesn't exist in Redis
      mockRedisClient.exists.mockResolvedValue(0);
      mockPrisma.room.delete.mockResolvedValue({} as any);

      const result = await roomScannerService.scanAndCleanupEmptyRooms();

      expect(result.scanned).toBe(0);
      expect(result.cleaned).toBe(1); // Cleaned from database
      expect(mockPrisma.room.delete).toHaveBeenCalledWith({ where: { id: orphanedRoomId } });
    });

    it('should keep recent orphaned rooms', async () => {
      const recentRoomId = 'recent-orphaned-room';
      const now = new Date();
      const recentDate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
      
      mockRedisClient.keys.mockResolvedValue([]);
      
      mockPrisma.room.findMany.mockResolvedValue([
        {
          id: recentRoomId,
          createdAt: recentDate
        }
      ] as any);
      
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await roomScannerService.scanAndCleanupEmptyRooms();

      expect(result.scanned).toBe(0);
      expect(result.cleaned).toBe(0); // Should not clean recent rooms
      expect(mockPrisma.room.delete).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis connection failed'));

      const result = await roomScannerService.scanAndCleanupEmptyRooms();

      expect(result.scanned).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Redis connection failed');
    });
  });

  describe('getRoomStatistics', () => {
    it('should return correct room statistics', async () => {
      const rooms = [
        {
          key: 'room:room1',
          data: { id: 'room1', players: [{ isConnected: true }, { isConnected: false }], status: 'WAITING' }
        },
        {
          key: 'room:room2',
          data: { id: 'room2', players: [], status: 'WAITING' }
        },
        {
          key: 'room:room3',
          data: { id: 'room3', players: [{ isConnected: true }], status: 'PLAYING' }
        }
      ];

      mockRedisClient.keys.mockResolvedValue(rooms.map(r => r.key));
      
      rooms.forEach((room, index) => {
        mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(room.data));
      });

      const stats = await roomScannerService.getRoomStatistics();

      expect(stats.totalRooms).toBe(3);
      expect(stats.emptyRooms).toBe(1); // room2
      expect(stats.populatedRooms).toBe(2); // room1, room3
      expect(stats.roomDetails).toHaveLength(3);
      
      const room1Detail = stats.roomDetails.find(r => r.roomId === 'room1');
      expect(room1Detail?.onlineCount).toBe(1);
      expect(room1Detail?.playerCount).toBe(2);
    });

    it('should handle empty room list', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const stats = await roomScannerService.getRoomStatistics();

      expect(stats.totalRooms).toBe(0);
      expect(stats.emptyRooms).toBe(0);
      expect(stats.populatedRooms).toBe(0);
      expect(stats.roomDetails).toHaveLength(0);
    });

    it('should handle malformed room data', async () => {
      mockRedisClient.keys.mockResolvedValue(['room:invalid']);
      mockRedisClient.get.mockResolvedValue('invalid json');

      const stats = await roomScannerService.getRoomStatistics();

      expect(stats.totalRooms).toBe(1);
      expect(stats.emptyRooms).toBe(0);
      expect(stats.populatedRooms).toBe(0);
      expect(stats.roomDetails).toHaveLength(0);
    });
  });

  describe('performPeriodicScan', () => {
    it('should perform scan without throwing errors', async () => {
      mockRedisClient.keys.mockResolvedValue([]);
      mockPrisma.room.findMany.mockResolvedValue([]);

      expect(async () => {
        await roomScannerService.performPeriodicScan();
      }).not.toThrow();
    });

    it('should handle scan errors gracefully', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Scan failed'));

      expect(async () => {
        await roomScannerService.performPeriodicScan();
      }).not.toThrow();
    });
  });
});