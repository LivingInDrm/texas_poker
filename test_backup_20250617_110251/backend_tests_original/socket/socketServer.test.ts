import { createServer } from 'http';
import { AddressInfo } from 'net';
import { Server as SocketIOServer } from 'socket.io';
import Client from 'socket.io-client';
type ClientSocket = any;
import jwt from 'jsonwebtoken';
import { createSocketServer } from '../../src/socket/socketServer';
import { SOCKET_EVENTS } from '../../src/types/socket';
import prisma from '../../src/prisma';
import { redisClient } from '../../src/db';

describe('Socket.IO Server', () => {
  // 为Socket测试设置更长的超时时间
  jest.setTimeout(30000);
  let httpServer: any;
  let io: SocketIOServer;
  let serverPort: number;
  let testUser: any;
  let validToken: string;

  beforeAll(async () => {
    // 创建测试用户
    testUser = await prisma.user.create({
      data: {
        username: `test_socket_user_${Date.now()}`,
        passwordHash: 'test_hash',
        chips: 5000
      }
    });

    // 生成有效的JWT token
    validToken = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET || 'test_secret'
    );

    // 创建HTTP服务器
    httpServer = createServer();
    io = createSocketServer(httpServer);

    // 启动服务器
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        serverPort = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await prisma.user.delete({ where: { id: testUser.id } });
    } catch (error) {
      console.warn('Failed to delete test user:', error);
    }
    
    // 清理Redis数据
    try {
      if (redisClient.isOpen) {
        const keys = await redisClient.keys('room:*');
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      }
    } catch (error) {
      console.warn('Failed to clean Redis data:', error);
    }
    
    // 关闭服务器
    io.close();
    httpServer.close();
    
    // 关闭数据库连接
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // 清理Redis中的测试数据
    try {
      if (redisClient.isOpen) {
        const keys = await redisClient.keys('room:*');
        if (keys.length > 0) {
          await redisClient.del(keys);
        }
      }
    } catch (error) {
      console.warn('Failed to clean Redis data in afterEach:', error);
    }
  });

  describe('Authentication', () => {
    test('should accept connection with valid token', (done) => {
      const client = Client(`http://localhost:${serverPort}`, {
        auth: { token: validToken }
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });

      client.on('connect_error', (error: any) => {
        done(error);
      });
    });

    test('should reject connection without token', (done) => {
      const client = Client(`http://localhost:${serverPort}`);

      client.on('connect_error', (error: any) => {
        expect(error.message).toContain('AUTHENTICATION_FAILED');
        client.disconnect();
        done();
      });

      client.on('connect', () => {
        done(new Error('Should not connect without token'));
      });
    });

    test('should reject connection with invalid token', (done) => {
      const client = Client(`http://localhost:${serverPort}`, {
        auth: { token: 'invalid_token' }
      });

      client.on('connect_error', (error: any) => {
        expect(error.message).toContain('AUTHENTICATION_FAILED');
        client.disconnect();
        done();
      });

      client.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });
    });
  });

  describe('System Events', () => {
    let client: ClientSocket;

    beforeEach((done) => {
      client = Client(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        timeout: 10000
      });
      client.on('connect', done);
      client.on('connect_error', (error: any) => {
        done(error);
      });
    });

    afterEach((done) => {
      if (client && client.connected) {
        client.on('disconnect', () => {
          done();
        });
        client.disconnect();
      } else {
        done();
      }
    });

    test('should receive welcome message on connection', (done) => {
      client.on(SOCKET_EVENTS.CONNECTED, (data: any) => {
        expect(data.message).toContain('Welcome');
        expect(data.message).toContain(testUser.username);
        done();
      });
    });

    test('should handle ping-pong', (done) => {
      client.emit(SOCKET_EVENTS.PING, (timestamp: number) => {
        expect(typeof timestamp).toBe('number');
        expect(timestamp).toBeGreaterThan(0);
        done();
      });
    });

    test('should handle heartbeat', (done) => {
      client.on('heartbeat', (timestamp: any) => {
        expect(typeof timestamp).toBe('number');
        client.emit('heartbeat_response', timestamp);
        done();
      });
    });
  });

  describe('Room Events', () => {
    let client: ClientSocket;
    let testRoom: any;

    beforeEach(async () => {
      // 创建测试房间
      testRoom = await prisma.room.create({
        data: {
          ownerId: testUser.id,
          playerLimit: 6,
          status: 'WAITING',
          bigBlind: 20,
          smallBlind: 10
        }
      });

      client = Client(`http://localhost:${serverPort}`, {
        auth: { token: validToken }
      });

      await new Promise<void>((resolve) => {
        client.on('connect', resolve);
      });
    });

    afterEach(async () => {
      if (client.connected) {
        client.disconnect();
      }
      
      // 清理测试房间
      try {
        await prisma.room.delete({ where: { id: testRoom.id } });
      } catch (error) {
        // 房间可能已被删除
      }
    });

    test('should join room successfully', (done) => {
      client.emit(SOCKET_EVENTS.ROOM_JOIN, 
        { roomId: testRoom.id },
        (response: any) => {
          expect(response.success).toBe(true);
          expect(response.data.roomState).toBeDefined();
          expect(response.data.roomState.players).toHaveLength(1);
          expect(response.data.roomState.players[0].id).toBe(testUser.id);
          done();
        }
      );
    });

    test('should fail to join non-existent room', (done) => {
      const fakeRoomId = '00000000-0000-0000-0000-000000000000';
      
      client.emit(SOCKET_EVENTS.ROOM_JOIN,
        { roomId: fakeRoomId },
        (response: any) => {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Room not found');
          done();
        }
      );
    });

    test('should leave room successfully', (done) => {
      // 先加入房间
      client.emit(SOCKET_EVENTS.ROOM_JOIN,
        { roomId: testRoom.id },
        (joinResponse: any) => {
          expect(joinResponse.success).toBe(true);
          
          // 然后离开房间
          client.emit(SOCKET_EVENTS.ROOM_LEAVE,
            { roomId: testRoom.id },
            (leaveResponse: any) => {
              expect(leaveResponse.success).toBe(true);
              done();
            }
          );
        }
      );
    });

    test('should handle quick start', (done) => {
      client.emit(SOCKET_EVENTS.ROOM_QUICK_START, (response: any) => {
        expect(response.success).toBe(true);
        expect(response.data.roomState).toBeDefined();
        expect(response.data.roomId).toBeDefined();
        done();
      });
    });
  });

  describe('Game Events', () => {
    let client1: ClientSocket;
    let client2: ClientSocket;
    let testRoom: any;
    let testUser2: any;
    let validToken2: string;

    beforeEach(async () => {
      // 创建第二个测试用户
      testUser2 = await prisma.user.create({
        data: {
          username: `test_socket_user2_${Date.now()}`,
          passwordHash: 'test_hash',
          chips: 5000
        }
      });

      validToken2 = jwt.sign(
        { userId: testUser2.id },
        process.env.JWT_SECRET || 'test_secret'
      );

      // 创建测试房间
      testRoom = await prisma.room.create({
        data: {
          ownerId: testUser.id,
          playerLimit: 6,
          status: 'WAITING',
          bigBlind: 20,
          smallBlind: 10
        }
      });

      // 连接两个客户端
      client1 = Client(`http://localhost:${serverPort}`, {
        auth: { token: validToken }
      });

      client2 = Client(`http://localhost:${serverPort}`, {
        auth: { token: validToken2 }
      });

      await Promise.all([
        new Promise<void>((resolve) => client1.on('connect', resolve)),
        new Promise<void>((resolve) => client2.on('connect', resolve))
      ]);
    });

    afterEach(async () => {
      if (client1.connected) client1.disconnect();
      if (client2.connected) client2.disconnect();
      
      try {
        await prisma.user.delete({ where: { id: testUser2.id } });
        await prisma.room.delete({ where: { id: testRoom.id } });
      } catch (error) {
        // 可能已被删除
      }
    });

    test('should handle player ready state', (done) => {
      // 两个玩家都加入房间
      Promise.all([
        new Promise<void>((resolve) => {
          client1.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, () => resolve());
        }),
        new Promise<void>((resolve) => {
          client2.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, () => resolve());
        })
      ]).then(() => {
        // 第一个玩家准备
        client1.emit(SOCKET_EVENTS.GAME_READY,
          { roomId: testRoom.id },
          (response: any) => {
            expect(response.success).toBe(true);
            expect(response.data.isReady).toBe(true);
            done();
          }
        );
      });
    });

    test('should start game when all players ready', (done) => {
      let gameStartedReceived = false;

      // 监听游戏开始事件
      client1.on(SOCKET_EVENTS.GAME_STARTED, (data: any) => {
        expect(data.gameState).toBeDefined();
        expect(data.gameState.players).toHaveLength(2);
        gameStartedReceived = true;
      });

      client2.on(SOCKET_EVENTS.GAME_STARTED, (data: any) => {
        expect(data.gameState).toBeDefined();
        if (gameStartedReceived) {
          done();
        }
      });

      // 两个玩家都加入房间并准备
      Promise.all([
        new Promise<void>((resolve) => {
          client1.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, () => resolve());
        }),
        new Promise<void>((resolve) => {
          client2.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, () => resolve());
        })
      ]).then(() => {
        // 两个玩家都准备
        client1.emit(SOCKET_EVENTS.GAME_READY, { roomId: testRoom.id }, () => {
          client2.emit(SOCKET_EVENTS.GAME_READY, { roomId: testRoom.id }, () => {
            // 游戏应该自动开始
          });
        });
      });
    });
  });

  describe('Rate Limiting', () => {
    let client: ClientSocket;

    beforeEach((done) => {
      client = Client(`http://localhost:${serverPort}`, {
        auth: { token: validToken },
        timeout: 10000
      });
      client.on('connect', done);
      client.on('connect_error', (error: any) => {
        done(error);
      });
    });

    afterEach((done) => {
      if (client && client.connected) {
        client.on('disconnect', () => {
          done();
        });
        client.disconnect();
      } else {
        done();
      }
    });

    test('should rate limit rapid ping requests', (done) => {
      let successCount = 0;
      let attempts = 0;

      const sendPing = () => {
        attempts++;
        client.emit(SOCKET_EVENTS.PING, (timestamp: any) => {
          successCount++;
          
          if (attempts < 10) {
            // 立即发送下一个ping（无延迟）
            setImmediate(sendPing);
          } else {
            // 检查是否有一些请求被限制
            expect(successCount).toBeLessThan(attempts);
            done();
          }
        });
      };

      sendPing();
    }, 10000);
  });
});