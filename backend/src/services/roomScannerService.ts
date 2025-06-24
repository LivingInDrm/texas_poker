import { redisClient } from '../db';
import { RoomState } from '../types/socket';
import { roomCleanupService } from './roomCleanupService';
import prisma from '../prisma';

/**
 * 房间扫描服务
 * 负责扫描和清理系统中现有的空房间
 */
export class RoomScannerService {
  private static instance: RoomScannerService;
  
  private constructor() {}
  
  public static getInstance(): RoomScannerService {
    if (!RoomScannerService.instance) {
      RoomScannerService.instance = new RoomScannerService();
    }
    return RoomScannerService.instance;
  }

  /**
   * 扫描并清理所有空房间
   * 启动时调用，清理系统中现有的空房间
   */
  async scanAndCleanupEmptyRooms(): Promise<{
    scanned: number;
    emptyRooms: number;
    cleaned: number;
    scheduled: number;
    errors: string[];
  }> {
    console.log('Starting scan for empty rooms...');
    
    const result = {
      scanned: 0,
      emptyRooms: 0,
      cleaned: 0,
      scheduled: 0,
      errors: [] as string[]
    };

    try {
      // 获取Redis中所有房间键
      const roomKeys = await redisClient.keys('room:*');
      result.scanned = roomKeys.length;
      
      console.log(`Found ${roomKeys.length} rooms in Redis`);

      for (const roomKey of roomKeys) {
        try {
          const roomId = roomKey.toString().replace('room:', '');
          const isEmpty = await this.isRoomEmpty(roomId);
          
          if (isEmpty) {
            result.emptyRooms++;
            
            // 立即清理空房间
            const cleanupResult = await roomCleanupService.performRoomCleanup(roomId);
            if (cleanupResult.success) {
              result.cleaned++;
              console.log(`Immediately cleaned empty room: ${roomId}`);
            } else {
              result.errors.push(`Failed to clean room ${roomId}: ${cleanupResult.error}`);
            }
          }
        } catch (error) {
          const roomId = roomKey.toString().replace('room:', '');
          result.errors.push(`Error processing room ${roomId}: ${error}`);
        }
      }

      // 同时检查数据库中的孤立房间
      await this.cleanupOrphanedDatabaseRooms(result);

    } catch (error) {
      result.errors.push(`Error during room scan: ${error}`);
    }

    console.log('Room scan completed:', result);
    return result;
  }

  /**
   * 检查房间是否为空（没有在线用户）
   */
  private async isRoomEmpty(roomId: string): Promise<boolean> {
    try {
      const roomData = await redisClient.get(`room:${roomId}`);
      if (!roomData) {
        return true; // 房间数据不存在，视为空房间
      }

      const roomState: RoomState = JSON.parse(roomData.toString());
      const onlineUsers = roomState.players.filter(p => p.isConnected);
      
      return onlineUsers.length === 0;
    } catch (error) {
      console.error(`Error checking if room ${roomId} is empty:`, error);
      return false; // 出错时保守处理，不认为是空房间
    }
  }

  /**
   * 清理数据库中的孤立房间
   * 处理那些在数据库中存在但Redis中不存在的房间
   */
  private async cleanupOrphanedDatabaseRooms(result: {
    scanned: number;
    emptyRooms: number;
    cleaned: number;
    scheduled: number;
    errors: string[];
  }): Promise<void> {
    try {
      // 获取数据库中所有WAITING状态的房间
      const dbRooms = await prisma.room.findMany({
        where: { 
          status: 'WAITING' 
        },
        select: { 
          id: true,
          createdAt: true 
        }
      });

      console.log(`Found ${dbRooms.length} WAITING rooms in database`);

      for (const room of dbRooms) {
        try {
          // 检查房间是否在Redis中存在
          const existsInRedis = await redisClient.exists(`room:${room.id}`);
          
          if (!existsInRedis) {
            // 房间在数据库中存在但Redis中不存在，可能是孤立房间
            // 检查房间创建时间，如果超过一定时间且没有Redis状态，则删除
            const roomAge = Date.now() - room.createdAt.getTime();
            const maxAge = 24 * 60 * 60 * 1000; // 24小时
            
            if (roomAge > maxAge) {
              await prisma.room.delete({ where: { id: room.id } });
              result.cleaned++;
              console.log(`Cleaned orphaned database room: ${room.id} (age: ${Math.round(roomAge / 1000 / 60)}min)`);
            } else {
              console.log(`Keeping recent orphaned room: ${room.id} (age: ${Math.round(roomAge / 1000 / 60)}min)`);
            }
          }
        } catch (error) {
          result.errors.push(`Error processing database room ${room.id}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Error cleaning orphaned database rooms: ${error}`);
    }
  }

  /**
   * 定期扫描服务
   * 可以定期调用以维护系统清洁
   */
  async performPeriodicScan(): Promise<void> {
    console.log('Performing periodic room scan...');
    
    try {
      const result = await this.scanAndCleanupEmptyRooms();
      
      if (result.errors.length > 0) {
        console.error('Periodic scan completed with errors:', result.errors);
      } else {
        console.log(`Periodic scan completed successfully: cleaned ${result.cleaned} rooms`);
      }
    } catch (error) {
      console.error('Error during periodic scan:', error);
    }
  }

  /**
   * 获取房间统计信息
   */
  async getRoomStatistics(): Promise<{
    totalRooms: number;
    emptyRooms: number;
    populatedRooms: number;
    roomDetails: Array<{
      roomId: string;
      playerCount: number;
      onlineCount: number;
      status: string;
    }>;
  }> {
    const stats = {
      totalRooms: 0,
      emptyRooms: 0,
      populatedRooms: 0,
      roomDetails: [] as Array<{
        roomId: string;
        playerCount: number;
        onlineCount: number;
        status: string;
      }>
    };

    try {
      const roomKeys = await redisClient.keys('room:*');
      stats.totalRooms = roomKeys.length;

      for (const roomKey of roomKeys) {
        try {
          const roomId = roomKey.toString().replace('room:', '');
          const roomData = await redisClient.get(roomKey);
          
          if (roomData) {
            const roomState: RoomState = JSON.parse(roomData.toString());
            const onlineCount = roomState.players.filter(p => p.isConnected).length;
            
            stats.roomDetails.push({
              roomId,
              playerCount: roomState.players.length,
              onlineCount,
              status: roomState.status
            });

            if (onlineCount === 0) {
              stats.emptyRooms++;
            } else {
              stats.populatedRooms++;
            }
          }
        } catch (error) {
          console.error(`Error processing room ${roomKey}:`, error);
        }
      }
    } catch (error) {
      console.error('Error getting room statistics:', error);
    }

    return stats;
  }
}

// 导出单例实例
export const roomScannerService = RoomScannerService.getInstance();