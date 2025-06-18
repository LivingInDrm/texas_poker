import { Server } from 'socket.io';
import Client from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import * as Redis from 'redis';
import { AuthenticatedSocket, SocketData } from '../../src/types/socket';
import { createMockAuthenticatedSocket, createSocketResponse, createMockCallback } from '../shared/socketTestUtils';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('redis');
jest.mock('jsonwebtoken');

const mockPrisma = {
  user: {
    findUnique: jest.fn()
  },
  room: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
} as unknown as PrismaClient;

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
};

(PrismaClient as jest.MockedClass<typeof PrismaClient>).mockImplementation(() => mockPrisma);
(Redis.createClient as jest.Mock).mockReturnValue(mockRedis);

describe('WebSocket Room Handlers Tests', () => {
  let io: Server;
  let serverSocket: any;
  let clientSocket: any;

  beforeAll(async () => {
    // Mock JWT
    (jwt.verify as jest.Mock).mockImplementation((token: string, secret: string, callback: Function) => {
      if (token === 'valid-token') {
        callback(null, { userId: 'user-123', username: 'testuser' });
      } else {
        callback(new Error('Invalid token'));
      }
    });

    // Create Socket.IO server
    io = new Server(3001, {
      cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    // Set up authentication middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      jwt.verify(token, 'test-secret', (err: any, decoded: any) => {
        if (err) {
          return next(new Error('Authentication error'));
        }
        (socket as AuthenticatedSocket).data.userId = decoded.userId;
        (socket as AuthenticatedSocket).data.username = decoded.username;
        (socket as AuthenticatedSocket).data.authenticated = true;
        next();
      });
    });

    // Room handlers - simulate the actual handlers
    io.on('connection', (socket) => {
      console.log(`User ${(socket as AuthenticatedSocket).data.username} connected`);

      // room:join handler
      socket.on('room:join', async (data: any, callback: Function) => {
        try {
          const { roomId, password } = data;

          // Validate room exists
          const room = await mockPrisma.room.findUnique({
            where: { id: roomId }
          });

          if (!room) {
            return callback({ success: false, message: 'Room not found' });
          }

          // Get room state from Redis
          const roomStateData = await mockRedis.get(`room:${roomId}`);
          if (!roomStateData) {
            return callback({ success: false, message: 'Room state not found' });
          }

          const roomState = JSON.parse(roomStateData);

          // Check if player already in room
          const existingPlayer = roomState.players.find((p: any) => p.id === (socket as AuthenticatedSocket).data.userId);
          if (existingPlayer) {
            return callback({ success: false, message: 'Already in room' });
          }

          // Check room capacity
          if (roomState.currentPlayerCount >= roomState.maxPlayers) {
            return callback({ success: false, message: 'Room is full' });
          }

          // Check password if required
          if (roomState.hasPassword && room.password) {
            const bcrypt = require('bcrypt');
            const passwordMatch = await bcrypt.compare(password || '', room.password);
            if (!passwordMatch) {
              return callback({ success: false, message: 'Invalid password' });
            }
          }

          // Add player to room state
          roomState.players.push({
            id: (socket as AuthenticatedSocket).data.userId,
            username: (socket as AuthenticatedSocket).data.username,
            chips: 5000,
            position: roomState.players.length,
            isOwner: false,
            status: 'ACTIVE'
          });
          roomState.currentPlayerCount = roomState.players.length;
          roomState.lastActivity = new Date().toISOString();

          // Save updated state
          await mockRedis.set(`room:${roomId}`, JSON.stringify(roomState));

          // Join socket room
          socket.join(roomId);
          (socket as AuthenticatedSocket).data.roomId = roomId;

          // Notify all players in room
          socket.to(roomId).emit('room:player_joined', {
            player: {
              id: (socket as AuthenticatedSocket).data.userId,
              username: (socket as AuthenticatedSocket).data.username,
              chips: 5000,
              position: roomState.players.length - 1
            },
            currentPlayerCount: roomState.currentPlayerCount
          });

          callback({ 
            success: true, 
            message: 'Joined room successfully',
            roomState: roomState
          });

        } catch (error) {
          console.error('Error in room:join:', error);
          callback({ success: false, message: 'Internal server error' });
        }
      });

      // room:leave handler
      socket.on('room:leave', async (callback: Function) => {
        try {
          if (!(socket as AuthenticatedSocket).data.roomId) {
            return callback({ success: false, message: 'Not in any room' });
          }

          const roomId = (socket as AuthenticatedSocket).data.roomId;
          const roomStateData = await mockRedis.get(`room:${roomId}`);
          if (!roomStateData) {
            return callback({ success: false, message: 'Room state not found' });
          }

          const roomState = JSON.parse(roomStateData);
          const playerIndex = roomState.players.findIndex((p: any) => p.id === (socket as AuthenticatedSocket).data.userId);
          
          if (playerIndex === -1) {
            return callback({ success: false, message: 'Player not in room' });
          }

          const removedPlayer = roomState.players[playerIndex];
          roomState.players.splice(playerIndex, 1);
          roomState.currentPlayerCount = roomState.players.length;

          // Transfer ownership if owner left
          if (removedPlayer.isOwner && roomState.players.length > 0) {
            roomState.players[0].isOwner = true;
            roomState.ownerId = roomState.players[0].id;
          }

          // Update positions
          roomState.players.forEach((player: any, index: number) => {
            player.position = index;
          });

          if (roomState.players.length === 0) {
            // Delete empty room
            await mockRedis.del(`room:${roomId}`);
          } else {
            // Save updated state
            await mockRedis.set(`room:${roomId}`, JSON.stringify(roomState));
          }

          // Leave socket room
          const currentRoomId = (socket as AuthenticatedSocket).data.roomId;
          if (currentRoomId) {
            socket.leave(currentRoomId);
          }
          (socket as AuthenticatedSocket).data.roomId = undefined;

          // Notify remaining players
          if (currentRoomId) {
            socket.to(currentRoomId).emit('room:player_left', {
              playerId: (socket as AuthenticatedSocket).data.userId,
              username: (socket as AuthenticatedSocket).data.username,
              currentPlayerCount: roomState.currentPlayerCount,
              newOwner: removedPlayer.isOwner && roomState.players.length > 0 ? roomState.players[0] : null
            });
          }

          callback({ success: true, message: 'Left room successfully' });

        } catch (error) {
          console.error('Error in room:leave:', error);
          callback({ success: false, message: 'Internal server error' });
        }
      });

      // room:quick_start handler
      socket.on('room:quick_start', async (callback: Function) => {
        try {
          // First, try to find an available room
          const availableRooms = await mockRedis.keys('room:*');
          let joinedRoom: any = null;

          for (const roomKey of availableRooms) {
            const roomStateData = await mockRedis.get(roomKey);
            if (roomStateData) {
              const roomState = JSON.parse(roomStateData);
              
              // Check if room is waiting and has space
              if (roomState.status === 'WAITING' && 
                  roomState.currentPlayerCount < roomState.maxPlayers &&
                  !roomState.hasPassword) {
                
                // Check if player is not already in this room
                const existingPlayer = roomState.players.find((p: any) => p.id === (socket as AuthenticatedSocket).data.userId);
                if (!existingPlayer) {
                  joinedRoom = roomState;
                  break;
                }
              }
            }
          }

          if (joinedRoom) {
            // Join existing room
            socket.emit('room:join', { roomId: joinedRoom.id }, callback);
          } else {
            // Create new room
            const newRoom = {
              playerLimit: 6,
              bigBlind: 20,
              smallBlind: 10,
              password: null
            };

            // Mock room creation
            const createdRoom = {
              id: 'room-' + Date.now(),
              ownerId: (socket as AuthenticatedSocket).data.userId,
              ...newRoom,
              status: 'WAITING',
              createdAt: new Date(),
              updatedAt: new Date()
            };

            (mockPrisma.room.create as jest.Mock).mockResolvedValue(createdRoom);

            // Create room state
            const roomState = {
              id: createdRoom.id,
              ownerId: (socket as AuthenticatedSocket).data.userId,
              players: [{
                id: (socket as AuthenticatedSocket).data.userId,
                username: (socket as AuthenticatedSocket).data.username,
                chips: 5000,
                position: 0,
                isOwner: true,
                status: 'ACTIVE'
              }],
              status: 'WAITING',
              maxPlayers: 6,
              currentPlayerCount: 1,
              hasPassword: false,
              bigBlind: 20,
              smallBlind: 10,
              gameStarted: false,
              createdAt: new Date().toISOString()
            };

            await mockRedis.set(`room:${createdRoom.id}`, JSON.stringify(roomState));

            // Join socket room
            socket.join(createdRoom.id);
            (socket as AuthenticatedSocket).data.roomId = createdRoom.id;

            callback({ 
              success: true, 
              message: 'Created and joined new room',
              roomState: roomState,
              created: true
            });
          }

        } catch (error) {
          console.error('Error in room:quick_start:', error);
          callback({ success: false, message: 'Internal server error' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        console.log(`User ${(socket as AuthenticatedSocket).data.username} disconnected`);
        
        if ((socket as AuthenticatedSocket).data.roomId) {
          // Auto-leave room on disconnect
          socket.emit('room:leave', () => {});
        }
      });
    });

    // Wait for server to start
    await new Promise<void>(resolve => {
      io.on('connection', () => resolve());
    });
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create client socket for each test
    clientSocket = Client(`http://localhost:3001`, {
      auth: {
        token: 'valid-token'
      }
    });

    // Wait for connection
    await new Promise<void>(resolve => {
      clientSocket.on('connect', resolve);
    });

    // Get server socket
    serverSocket = [...io.sockets.sockets.values()][0];
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  afterAll(() => {
    io.close();
  });

  describe('room:join event', () => {
    it('should join room successfully with valid data', (done) => {
      // Mock room exists
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        ownerId: 'other-user',
        password: null,
        status: 'WAITING'
      });

      // Mock room state
      const roomState = {
        id: 'room-123',
        players: [{ id: 'other-user', username: 'owner' }],
        currentPlayerCount: 1,
        maxPlayers: 6,
        hasPassword: false,
        status: 'WAITING'
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
      mockRedis.set.mockResolvedValue('OK');

      clientSocket.emit('room:join', { roomId: 'room-123' }, (response: any) => {
        expect(response.success).toBe(true);
        expect(response.message).toBe('Joined room successfully');
        expect(response.roomState).toBeDefined();
        expect(response.roomState.currentPlayerCount).toBe(2);
        done();
      });
    });

    it('should fail to join non-existent room', (done) => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue(null);

      clientSocket.emit('room:join', { roomId: 'non-existent' }, (response: any) => {
        expect(response.success).toBe(false);
        expect(response.message).toBe('Room not found');
        done();
      });
    });

    it('should fail to join full room', (done) => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        password: null,
        status: 'WAITING'
      });

      // Mock full room state
      const fullRoomState = {
        id: 'room-123',
        players: new Array(6).fill(null).map((_, i) => ({ id: `user-${i}` })),
        currentPlayerCount: 6,
        maxPlayers: 6,
        hasPassword: false
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(fullRoomState));

      clientSocket.emit('room:join', { roomId: 'room-123' }, (response: any) => {
        expect(response.success).toBe(false);
        expect(response.message).toBe('Room is full');
        done();
      });
    });

    it('should fail to join room with wrong password', (done) => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        password: 'hashed-password',
        status: 'WAITING'
      });

      const roomState = {
        id: 'room-123',
        players: [{ id: 'owner' }],
        currentPlayerCount: 1,
        maxPlayers: 6,
        hasPassword: true
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(roomState));

      // Mock bcrypt comparison
      const bcrypt = require('bcrypt');
      bcrypt.compare = jest.fn().mockResolvedValue(false);

      clientSocket.emit('room:join', { 
        roomId: 'room-123', 
        password: 'wrong-password' 
      }, (response: any) => {
        expect(response.success).toBe(false);
        expect(response.message).toBe('Invalid password');
        done();
      });
    });

    it('should fail if already in room', (done) => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        password: null,
        status: 'WAITING'
      });

      // Mock room state with current user already in it
      const roomState = {
        id: 'room-123',
        players: [
          { id: 'user-123', username: 'testuser' }, // Current user
          { id: 'other-user', username: 'other' }
        ],
        currentPlayerCount: 2,
        maxPlayers: 6,
        hasPassword: false
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(roomState));

      clientSocket.emit('room:join', { roomId: 'room-123' }, (response: any) => {
        expect(response.success).toBe(false);
        expect(response.message).toBe('Already in room');
        done();
      });
    });
  });

  describe('room:leave event', () => {
    beforeEach(() => {
      // Set up user in a room
      serverSocket.currentRoom = 'room-123';
      serverSocket.join('room-123');
    });

    it('should leave room successfully', (done) => {
      const roomState = {
        id: 'room-123',
        players: [
          { id: 'user-123', username: 'testuser', isOwner: false },
          { id: 'owner-user', username: 'owner', isOwner: true }
        ],
        currentPlayerCount: 2
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
      mockRedis.set.mockResolvedValue('OK');

      clientSocket.emit('room:leave', (response: any) => {
        expect(response.success).toBe(true);
        expect(response.message).toBe('Left room successfully');
        done();
      });
    });

    it('should transfer ownership when owner leaves', (done) => {
      const roomState = {
        id: 'room-123',
        ownerId: 'user-123',
        players: [
          { id: 'user-123', username: 'testuser', isOwner: true },
          { id: 'other-user', username: 'other', isOwner: false }
        ],
        currentPlayerCount: 2
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
      mockRedis.set.mockResolvedValue('OK');

      // Listen for ownership transfer notification
      clientSocket.on('room:player_left', (data: any) => {
        expect(data.newOwner).toBeDefined();
        expect(data.newOwner.id).toBe('other-user');
        done();
      });

      clientSocket.emit('room:leave', (response: any) => {
        expect(response.success).toBe(true);
      });
    });

    it('should delete room when last player leaves', (done) => {
      const roomState = {
        id: 'room-123',
        players: [{ id: 'user-123', username: 'testuser', isOwner: true }],
        currentPlayerCount: 1
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
      mockRedis.del.mockResolvedValue(1);

      clientSocket.emit('room:leave', (response: any) => {
        expect(response.success).toBe(true);
        expect(mockRedis.del).toHaveBeenCalledWith('room:room-123');
        done();
      });
    });

    it('should fail if not in any room', (done) => {
      serverSocket.currentRoom = null;

      clientSocket.emit('room:leave', (response: any) => {
        expect(response.success).toBe(false);
        expect(response.message).toBe('Not in any room');
        done();
      });
    });
  });

  describe('room:quick_start event', () => {
    it('should join existing available room', (done) => {
      // Mock available rooms
      mockRedis.keys.mockResolvedValue(['room:existing-room']);
      
      const availableRoomState = {
        id: 'existing-room',
        status: 'WAITING',
        currentPlayerCount: 2,
        maxPlayers: 6,
        hasPassword: false,
        players: [
          { id: 'user-1', username: 'player1' },
          { id: 'user-2', username: 'player2' }
        ]
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(availableRoomState));
      mockRedis.set.mockResolvedValue('OK');

      // Mock room lookup for join
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-room',
        password: null,
        status: 'WAITING'
      });

      clientSocket.emit('room:quick_start', (response: any) => {
        expect(response.success).toBe(true);
        expect(response.roomState).toBeDefined();
        expect(response.created).toBeUndefined(); // Joined existing room
        done();
      });
    });

    it('should create new room if no available rooms', (done) => {
      // Mock no available rooms
      mockRedis.keys.mockResolvedValue([]);
      
      // Mock room creation
      const newRoomId = 'room-' + Date.now();
      (mockPrisma.room.create as jest.Mock).mockResolvedValue({
        id: newRoomId,
        ownerId: 'user-123',
        status: 'WAITING'
      });
      mockRedis.set.mockResolvedValue('OK');

      clientSocket.emit('room:quick_start', (response: any) => {
        expect(response.success).toBe(true);
        expect(response.created).toBe(true);
        expect(response.roomState).toBeDefined();
        expect(response.roomState.ownerId).toBe('user-123');
        expect(response.roomState.currentPlayerCount).toBe(1);
        done();
      });
    });

    it('should skip password-protected rooms in quick start', (done) => {
      // Mock room with password
      mockRedis.keys.mockResolvedValue(['room:password-room']);
      
      const passwordRoomState = {
        id: 'password-room',
        status: 'WAITING',
        currentPlayerCount: 1,
        maxPlayers: 6,
        hasPassword: true,
        players: [{ id: 'other-user' }]
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(passwordRoomState));

      // Should create new room instead
      (mockPrisma.room.create as jest.Mock).mockResolvedValue({
        id: 'new-room',
        ownerId: 'user-123'
      });
      mockRedis.set.mockResolvedValue('OK');

      clientSocket.emit('room:quick_start', (response: any) => {
        expect(response.success).toBe(true);
        expect(response.created).toBe(true);
        expect(response.roomState.id).toBe('new-room');
        done();
      });
    });

    it('should skip rooms where user is already present', (done) => {
      mockRedis.keys.mockResolvedValue(['room:user-room']);
      
      const roomWithUser = {
        id: 'user-room',
        status: 'WAITING',
        currentPlayerCount: 2,
        maxPlayers: 6,
        hasPassword: false,
        players: [
          { id: 'user-123', username: 'testuser' }, // Current user already in room
          { id: 'other-user', username: 'other' }
        ]
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(roomWithUser));

      // Should create new room
      (mockPrisma.room.create as jest.Mock).mockResolvedValue({
        id: 'new-room',
        ownerId: 'user-123'
      });
      mockRedis.set.mockResolvedValue('OK');

      clientSocket.emit('room:quick_start', (response: any) => {
        expect(response.success).toBe(true);
        expect(response.created).toBe(true);
        done();
      });
    });
  });

  describe('Player notifications', () => {
    let secondClient: any;

    beforeEach(async () => {
      // Create second client to test notifications
      secondClient = Client(`http://localhost:3001`, {
        auth: { token: 'valid-token' }
      });

      await new Promise<void>(resolve => {
        secondClient.on('connect', resolve);
      });

      // Both clients join the same room
      const roomState = {
        id: 'room-123',
        players: [{ id: 'existing-user', username: 'existing' }],
        currentPlayerCount: 1,
        maxPlayers: 6,
        hasPassword: false,
        status: 'WAITING'
      };

      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        password: null,
        status: 'WAITING'
      });
      mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
      mockRedis.set.mockResolvedValue('OK');
    });

    afterEach(() => {
      if (secondClient && secondClient.connected) {
        secondClient.disconnect();
      }
    });

    it('should notify other players when someone joins', (done) => {
      secondClient.on('room:player_joined', (data: any) => {
        expect(data.player).toBeDefined();
        expect(data.player.username).toBe('testuser');
        expect(data.currentPlayerCount).toBe(2);
        done();
      });

      clientSocket.emit('room:join', { roomId: 'room-123' }, (response: any) => {
        expect(response.success).toBe(true);
      });
    });

    it('should notify other players when someone leaves', (done) => {
      // First join the room
      clientSocket.emit('room:join', { roomId: 'room-123' }, () => {
        // Then set up listener for leave notification
        secondClient.on('room:player_left', (data: any) => {
          expect(data.playerId).toBe('user-123');
          expect(data.username).toBe('testuser');
          done();
        });

        // Leave the room
        clientSocket.emit('room:leave', () => {});
      });
    });
  });

  describe('Error handling', () => {
    it('should handle Redis errors gracefully', (done) => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        password: null
      });
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      clientSocket.emit('room:join', { roomId: 'room-123' }, (response: any) => {
        expect(response.success).toBe(false);
        expect(response.message).toBe('Internal server error');
        done();
      });
    });

    it('should handle database errors gracefully', (done) => {
      (mockPrisma.room.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      clientSocket.emit('room:join', { roomId: 'room-123' }, (response: any) => {
        expect(response.success).toBe(false);
        expect(response.message).toBe('Internal server error');
        done();
      });
    });

    it('should handle malformed room state data', (done) => {
      (mockPrisma.room.findUnique as jest.Mock).mockResolvedValue({
        id: 'room-123',
        password: null
      });
      mockRedis.get.mockResolvedValue('invalid json');

      clientSocket.emit('room:join', { roomId: 'room-123' }, (response: any) => {
        expect(response.success).toBe(false);
        expect(response.message).toBe('Internal server error');
        done();
      });
    });
  });

  describe('Authentication', () => {
    it('should reject connections with invalid tokens', (done) => {
      const invalidClient = Client(`http://localhost:3001`, {
        auth: { token: 'invalid-token' }
      });

      invalidClient.on('connect_error', (error: any) => {
        expect(error.message).toContain('Authentication error');
        done();
      });
    });

    it('should reject connections without tokens', (done) => {
      const noTokenClient = Client(`http://localhost:3001`);

      noTokenClient.on('connect_error', (error: any) => {
        expect(error.message).toContain('Authentication error');
        done();
      });
    });
  });

  describe('Disconnect handling', () => {
    it('should handle auto-leave when user disconnects', (done) => {
      // Set up user in room
      const roomState = {
        id: 'room-123',
        players: [{ id: 'user-123', username: 'testuser' }],
        currentPlayerCount: 1
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(roomState));
      mockRedis.del.mockResolvedValue(1);
      
      serverSocket.currentRoom = 'room-123';

      // Listen for disconnect
      serverSocket.on('disconnect', () => {
        // Verify auto-leave was triggered
        setTimeout(() => {
          expect(mockRedis.del).toHaveBeenCalledWith('room:room-123');
          done();
        }, 100);
      });

      // Simulate disconnect
      clientSocket.disconnect();
    });
  });
});