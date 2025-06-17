import { Server as SocketIOServer } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  AuthenticatedSocket,
  SOCKET_EVENTS,
  RoomState
} from '../../types/socket';
import { validationMiddleware } from '../middleware/validation';
import { userStateService } from '../../services/userStateService';
import { redisClient } from '../../db';

export function setupSystemHandlers(
  socket: AuthenticatedSocket,
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) {
  // 添加通用消息速率验证
  const originalEmit = socket.emit;
  socket.emit = function(...args: any[]) {
    if (!validationMiddleware.validateMessageRate(socket.data.userId)) {
      console.warn(`Rate limit exceeded for user ${socket.data.username}`);
      return false;
    }
    return originalEmit.apply(this, args as any);
  };

  // Ping处理
  socket.on(SOCKET_EVENTS.PING, (callback) => {
    const startTime = Date.now();
    callback(startTime);
  });

  // 重连尝试处理 - 增强版
  socket.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, async (data) => {
    const { roomId } = data;
    const { userId, username } = socket.data;

    console.log(`Reconnect attempt from ${username} for room ${roomId || 'none'}`);

    try {
      // 首先验证用户的全局状态
      const userCurrentRoom = await userStateService.getUserCurrentRoom(userId);
      console.log(`User ${username} global state: ${userCurrentRoom}`);

      if (roomId) {
        // 检查房间是否存在
        const roomData = await redisClient.get(`room:${roomId}`);
        
        if (!roomData) {
          // 房间不存在，清理用户状态
          await userStateService.clearUserCurrentRoom(userId);
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'Room not found',
            code: 'ROOM_NOT_FOUND'
          });
          return;
        }

        const roomState: RoomState = JSON.parse(roomData.toString());
        const player = roomState.players.find((p: any) => p.id === userId);
        
        // 验证用户全局状态与房间状态的一致性
        if (userCurrentRoom !== roomId) {
          console.log(`State inconsistency detected for user ${username}: global=${userCurrentRoom}, requested=${roomId}`);
          
          if (userCurrentRoom) {
            // 用户在其他房间中，强制离开
            await userStateService.forceLeaveCurrentRoom(userId, socket, io, 'Reconnecting to different room');
          }
          
          // 如果用户不在请求的房间中，拒绝重连
          if (!player) {
            socket.emit(SOCKET_EVENTS.ERROR, {
              message: 'You are not a member of this room',
              code: 'ROOM_ACCESS_DENIED'
            });
            return;
          }
        }
        
        if (player) {
          // 重新加入房间
          await socket.join(roomId);
          socket.data.roomId = roomId;
          
          // 更新全局用户状态
          await userStateService.setUserCurrentRoom(userId, roomId);
          
          // 标记为已连接
          player.isConnected = true;
          await redisClient.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
          
          // 发送重连成功消息，包含游戏状态
          socket.emit(SOCKET_EVENTS.RECONNECTED, {
            roomId,
            gameState: roomState.gameState
          });

          // 发送当前房间状态
          socket.emit(SOCKET_EVENTS.ROOM_STATE_UPDATE, {
            roomState
          });

          // 通知房间内其他玩家
          socket.to(roomId).emit(SOCKET_EVENTS.ROOM_PLAYER_JOINED, {
            player: {
              id: player.id,
              username: player.username,
              avatar: player.avatar,
              chips: player.chips,
              isReady: player.isReady,
              position: player.position,
              isConnected: true,
              lastAction: player.lastAction
            }
          });

          console.log(`User ${username} successfully reconnected to room ${roomId}`);
        } else {
          // 用户不在房间中
          await userStateService.clearUserCurrentRoom(userId);
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: 'You are not a member of this room',
            code: 'ROOM_ACCESS_DENIED'
          });
        }
      } else {
        // 没有指定房间，检查用户是否有全局状态
        if (userCurrentRoom) {
          // 用户有全局状态，尝试重连到该房间
          const roomData = await redisClient.get(`room:${userCurrentRoom}`);
          if (roomData) {
            const roomState: RoomState = JSON.parse(roomData.toString());
            const player = roomState.players.find((p: any) => p.id === userId);
            
            if (player) {
              // 重新加入房间
              await socket.join(userCurrentRoom);
              socket.data.roomId = userCurrentRoom;
              
              // 标记为已连接
              player.isConnected = true;
              await redisClient.setEx(`room:${userCurrentRoom}`, 3600, JSON.stringify(roomState));
              
              // 发送重连成功消息
              socket.emit(SOCKET_EVENTS.RECONNECTED, {
                roomId: userCurrentRoom,
                gameState: roomState.gameState
              });

              console.log(`User ${username} reconnected to their current room ${userCurrentRoom}`);
            } else {
              // 状态不一致，清理
              await userStateService.clearUserCurrentRoom(userId);
            }
          } else {
            // 房间不存在，清理状态
            await userStateService.clearUserCurrentRoom(userId);
          }
        }
        
        // 发送通用重连确认
        socket.emit(SOCKET_EVENTS.RECONNECTED, {
          roomId: userCurrentRoom || undefined
        });
      }
    } catch (error) {
      console.error('Error handling reconnect attempt:', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Reconnection failed',
        code: 'RECONNECT_FAILED'
      });
    }
  });

  // 心跳检测
  const heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      // socket.emit('heartbeat', Date.now()); // 暂时注释掉非标准事件
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 30000); // 每30秒发送一次心跳

  // 监听心跳响应
  // socket.on('heartbeat_response', (timestamp: number) => {
  //   const latency = Date.now() - timestamp;
  //   console.log(`Heartbeat from ${socket.data.username}: ${latency}ms`);
  // });

  // 获取用户当前房间状态 - 临时注释解决类型问题
  // socket.on('GET_USER_CURRENT_ROOM', async (data, callback) => {
  //   const { userId } = socket.data;
  //
  //   try {
  //     const currentRoomId = await userStateService.getUserCurrentRoom(userId);
  //     
  //     if (!currentRoomId) {
  //       return callback({
  //         success: true,
  //         data: { roomId: null }
  //       });
  //     }
  //
  //     // 获取房间详细信息
  //     const roomData = await redisClient.get(`room:${currentRoomId}`);
  //     if (!roomData) {
  //       // 房间不存在，清理用户状态
  //       await userStateService.clearUserCurrentRoom(userId);
  //       return callback({
  //         success: true,
  //         data: { roomId: null }
  //       });
  //     }
  //
  //     const roomState: RoomState = JSON.parse(roomData);
  //     const roomDetails = {
  //       playerCount: roomState.players.length,
  //       isGameStarted: roomState.gameStarted || false,
  //       roomState: {
  //         id: roomState.id,
  //         status: roomState.status,
  //         maxPlayers: roomState.maxPlayers,
  //         currentPlayerCount: roomState.currentPlayerCount
  //       }
  //     };
  //
  //     callback({
  //       success: true,
  //       data: {
  //         roomId: currentRoomId,
  //         roomDetails
  //       }
  //     });
  //
  //   } catch (error) {
  //     console.error('Error getting user current room:', error);
  //     callback({
  //       success: false,
  //       error: 'Failed to get current room status',
  //       message: 'Internal server error'
  //     });
  //   }
  // });

  // 断开连接时清理心跳
  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    clearInterval(heartbeatInterval);
  });
}