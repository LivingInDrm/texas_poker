import * as Redis from 'redis';

// Mock Redis client
jest.mock('redis');

// Define types for our room state manager
interface Player {
  id: string;
  username: string;
  chips: number;
  position: number;
  isOwner: boolean;
  status: string;
}

interface RoomState {
  id: string;
  ownerId: string;
  players: Player[];
  status: string;
  maxPlayers: number;
  currentPlayerCount: number;
  hasPassword: boolean;
  bigBlind: number;
  smallBlind: number;
  gameStarted: boolean;
  dealerPosition: number;
  currentTurn: string | null;
  pot: number;
  communityCards: string[];
  gamePhase: string;
  createdAt: string;
  lastActivity: string;
}

interface RoomData {
  id: string;
  ownerId: string;
  ownerUsername: string;
  playerLimit: number;
  password?: string;
  bigBlind: number;
  smallBlind: number;
}

interface PlayerData {
  id: string;
  username: string;
}

describe('Room State Management in Redis', () => {
  let mockRedisClient: any;
  let roomStateManager: any;

  beforeAll(() => {
    // Mock Redis client
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      hSet: jest.fn(),
      hGet: jest.fn(),
      hGetAll: jest.fn(),
      hDel: jest.fn()
    };
    (Redis.createClient as jest.Mock).mockReturnValue(mockRedisClient);

    // Create a room state manager for testing
    roomStateManager = {
      createRoomState: async (roomData: RoomData): Promise<RoomState> => {
        const roomState: RoomState = {
          id: roomData.id,
          ownerId: roomData.ownerId,
          players: [{
            id: roomData.ownerId,
            username: roomData.ownerUsername,
            chips: 5000,
            position: 0,
            isOwner: true,
            status: 'ACTIVE'
          }],
          status: 'WAITING',
          maxPlayers: roomData.playerLimit,
          currentPlayerCount: 1,
          hasPassword: !!roomData.password,
          bigBlind: roomData.bigBlind,
          smallBlind: roomData.smallBlind,
          gameStarted: false,
          dealerPosition: 0,
          currentTurn: null,
          pot: 0,
          communityCards: [],
          gamePhase: 'WAITING',
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString()
        };

        await mockRedisClient.set(
          `room:${roomData.id}`,
          JSON.stringify(roomState),
          'EX',
          3600 // 1 hour expiry
        );

        return roomState;
      },

      getRoomState: async (roomId: string): Promise<RoomState | null> => {
        const data = await mockRedisClient.get(`room:${roomId}`);
        return data ? JSON.parse(data) : null;
      },

      addPlayerToRoom: async (roomId: string, playerData: PlayerData): Promise<RoomState> => {
        const roomState = await roomStateManager.getRoomState(roomId);
        if (!roomState) {
          throw new Error('Room not found');
        }

        // Check if player already in room
        const existingPlayer = roomState.players.find((p: Player) => p.id === playerData.id);
        if (existingPlayer) {
          throw new Error('Player already in room');
        }

        // Check room capacity
        if (roomState.currentPlayerCount >= roomState.maxPlayers) {
          throw new Error('Room is full');
        }

        // Add player to room
        roomState.players.push({
          id: playerData.id,
          username: playerData.username,
          chips: 5000,
          position: roomState.players.length,
          isOwner: false,
          status: 'ACTIVE'
        });

        roomState.currentPlayerCount = roomState.players.length;
        roomState.lastActivity = new Date().toISOString();

        await mockRedisClient.set(
          `room:${roomId}`,
          JSON.stringify(roomState),
          'EX',
          3600
        );

        return roomState;
      },

      removePlayerFromRoom: async (roomId: string, playerId: string): Promise<RoomState | null> => {
        const roomState = await roomStateManager.getRoomState(roomId);
        if (!roomState) {
          throw new Error('Room not found');
        }

        const playerIndex = roomState.players.findIndex((p: Player) => p.id === playerId);
        if (playerIndex === -1) {
          throw new Error('Player not in room');
        }

        const removedPlayer = roomState.players[playerIndex];
        roomState.players.splice(playerIndex, 1);
        roomState.currentPlayerCount = roomState.players.length;

        // If owner left and there are other players, transfer ownership
        if (removedPlayer.isOwner && roomState.players.length > 0) {
          roomState.players[0].isOwner = true;
          roomState.ownerId = roomState.players[0].id;
        }

        // Update positions
        roomState.players.forEach((player: Player, index: number) => {
          player.position = index;
        });

        roomState.lastActivity = new Date().toISOString();

        if (roomState.players.length === 0) {
          // Delete empty room
          await mockRedisClient.del(`room:${roomId}`);
          return null;
        } else {
          await mockRedisClient.set(
            `room:${roomId}`,
            JSON.stringify(roomState),
            'EX',
            3600
          );
          return roomState;
        }
      },

      updateRoomStatus: async (roomId: string, status: string): Promise<RoomState> => {
        const roomState = await roomStateManager.getRoomState(roomId);
        if (!roomState) {
          throw new Error('Room not found');
        }

        roomState.status = status;
        roomState.lastActivity = new Date().toISOString();

        await mockRedisClient.set(
          `room:${roomId}`,
          JSON.stringify(roomState),
          'EX',
          3600
        );

        return roomState;
      },

      deleteRoom: async (roomId: string): Promise<boolean> => {
        const result = await mockRedisClient.del(`room:${roomId}`);
        return result > 0;
      },

      getAllRooms: async (): Promise<RoomState[]> => {
        const keys = await mockRedisClient.keys('room:*');
        const rooms: RoomState[] = [];

        for (const key of keys) {
          const data = await mockRedisClient.get(key);
          if (data) {
            rooms.push(JSON.parse(data));
          }
        }

        return rooms;
      },

      getRoomsByStatus: async (status: string): Promise<RoomState[]> => {
        const allRooms = await roomStateManager.getAllRooms();
        return allRooms.filter((room: RoomState) => room.status === status);
      }
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Room State Creation and Retrieval', () => {
    it('should create a new room state successfully', async () => {
      const roomData: RoomData = {
        id: 'room-123',
        ownerId: 'user-456',
        ownerUsername: 'testowner',
        playerLimit: 6,
        password: 'test123',
        bigBlind: 20,
        smallBlind: 10
      };

      mockRedisClient.set.mockResolvedValue('OK');

      const roomState = await roomStateManager.createRoomState(roomData);

      expect(roomState).toMatchObject({
        id: 'room-123',
        ownerId: 'user-456',
        status: 'WAITING',
        maxPlayers: 6,
        currentPlayerCount: 1,
        hasPassword: true,
        bigBlind: 20,
        smallBlind: 10,
        gameStarted: false
      });

      expect(roomState.players).toHaveLength(1);
      expect(roomState.players[0]).toMatchObject({
        id: 'user-456',
        username: 'testowner',
        chips: 5000,
        position: 0,
        isOwner: true,
        status: 'ACTIVE'
      });

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'room:room-123',
        expect.stringContaining('"id":"room-123"'),
        'EX',
        3600
      );
    });

    it('should retrieve room state by ID', async () => {
      const mockRoomState = {
        id: 'room-123',
        ownerId: 'user-456',
        players: [{ id: 'user-456', username: 'owner' }],
        status: 'WAITING',
        currentPlayerCount: 1
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));

      const roomState = await roomStateManager.getRoomState('room-123');

      expect(roomState).toEqual(mockRoomState);
      expect(mockRedisClient.get).toHaveBeenCalledWith('room:room-123');
    });

    it('should return null for non-existent room', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const roomState = await roomStateManager.getRoomState('non-existent');

      expect(roomState).toBeNull();
    });
  });

  describe('Player Management', () => {
    let mockRoomState: RoomState;

    beforeEach(() => {
      mockRoomState = {
        id: 'room-123',
        ownerId: 'user-456',
        players: [{
          id: 'user-456',
          username: 'owner',
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
        dealerPosition: 0,
        currentTurn: null,
        pot: 0,
        communityCards: [],
        gamePhase: 'WAITING',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };
    });

    it('should add a player to room successfully', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
      mockRedisClient.set.mockResolvedValue('OK');

      const playerData: PlayerData = {
        id: 'user-789',
        username: 'newplayer'
      };

      const updatedState = await roomStateManager.addPlayerToRoom('room-123', playerData);

      expect(updatedState.players).toHaveLength(2);
      expect(updatedState.currentPlayerCount).toBe(2);
      expect(updatedState.players[1]).toMatchObject({
        id: 'user-789',
        username: 'newplayer',
        chips: 5000,
        position: 1,
        isOwner: false,
        status: 'ACTIVE'
      });

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'room:room-123',
        expect.stringContaining('"currentPlayerCount":2'),
        'EX',
        3600
      );
    });

    it('should fail to add player when room is full', async () => {
      const fullRoomState = {
        ...mockRoomState,
        players: new Array(6).fill(null).map((_, i) => ({
          id: `user-${i}`,
          username: `player${i}`,
          position: i,
          chips: 5000,
          isOwner: false,
          status: 'ACTIVE'
        })),
        currentPlayerCount: 6,
        maxPlayers: 6
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(fullRoomState));

      const playerData: PlayerData = { id: 'user-new', username: 'newplayer' };

      await expect(
        roomStateManager.addPlayerToRoom('room-123', playerData)
      ).rejects.toThrow('Room is full');
    });

    it('should fail to add player already in room', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));

      const playerData: PlayerData = { id: 'user-456', username: 'owner' }; // Already in room

      await expect(
        roomStateManager.addPlayerToRoom('room-123', playerData)
      ).rejects.toThrow('Player already in room');
    });

    it('should remove player from room successfully', async () => {
      const roomWithMultiplePlayers = {
        ...mockRoomState,
        players: [
          { id: 'user-456', username: 'owner', position: 0, isOwner: true, chips: 5000, status: 'ACTIVE' },
          { id: 'user-789', username: 'player2', position: 1, isOwner: false, chips: 5000, status: 'ACTIVE' },
          { id: 'user-101', username: 'player3', position: 2, isOwner: false, chips: 5000, status: 'ACTIVE' }
        ],
        currentPlayerCount: 3
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(roomWithMultiplePlayers));
      mockRedisClient.set.mockResolvedValue('OK');

      const updatedState = await roomStateManager.removePlayerFromRoom('room-123', 'user-789');

      expect(updatedState?.players).toHaveLength(2);
      expect(updatedState?.currentPlayerCount).toBe(2);
      expect(updatedState?.players.find((p: Player) => p.id === 'user-789')).toBeUndefined();

      // Check positions were updated
      expect(updatedState?.players[0].position).toBe(0);
      expect(updatedState?.players[1].position).toBe(1);
    });

    it('should transfer ownership when owner leaves', async () => {
      const roomWithMultiplePlayers = {
        ...mockRoomState,
        players: [
          { id: 'user-456', username: 'owner', position: 0, isOwner: true, chips: 5000, status: 'ACTIVE' },
          { id: 'user-789', username: 'player2', position: 1, isOwner: false, chips: 5000, status: 'ACTIVE' }
        ],
        currentPlayerCount: 2
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(roomWithMultiplePlayers));
      mockRedisClient.set.mockResolvedValue('OK');

      const updatedState = await roomStateManager.removePlayerFromRoom('room-123', 'user-456');

      expect(updatedState?.players).toHaveLength(1);
      expect(updatedState?.ownerId).toBe('user-789');
      expect(updatedState?.players[0]).toMatchObject({
        id: 'user-789',
        username: 'player2',
        position: 0,
        isOwner: true
      });
    });

    it('should delete room when last player leaves', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRoomState));
      mockRedisClient.del.mockResolvedValue(1);

      const result = await roomStateManager.removePlayerFromRoom('room-123', 'user-456');

      expect(result).toBeNull();
      expect(mockRedisClient.del).toHaveBeenCalledWith('room:room-123');
    });
  });

  describe('Room Status Management', () => {
    it('should update room status successfully', async () => {
      const roomState = {
        id: 'room-123',
        status: 'WAITING',
        lastActivity: '2025-06-15T10:00:00.000Z'
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(roomState));
      mockRedisClient.set.mockResolvedValue('OK');

      const updatedState = await roomStateManager.updateRoomStatus('room-123', 'PLAYING');

      expect(updatedState.status).toBe('PLAYING');
      expect(updatedState.lastActivity).not.toBe('2025-06-15T10:00:00.000Z');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'room:room-123',
        expect.stringContaining('"status":"PLAYING"'),
        'EX',
        3600
      );
    });

    it('should fail to update status for non-existent room', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        roomStateManager.updateRoomStatus('non-existent', 'PLAYING')
      ).rejects.toThrow('Room not found');
    });
  });

  describe('Room Deletion', () => {
    it('should delete room successfully', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await roomStateManager.deleteRoom('room-123');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('room:room-123');
    });

    it('should return false when room does not exist', async () => {
      mockRedisClient.del.mockResolvedValue(0);

      const result = await roomStateManager.deleteRoom('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('Room Querying', () => {
    it('should get all rooms', async () => {
      const mockRooms = [
        { id: 'room-1', status: 'WAITING' },
        { id: 'room-2', status: 'PLAYING' },
        { id: 'room-3', status: 'WAITING' }
      ];

      mockRedisClient.keys.mockResolvedValue(['room:room-1', 'room:room-2', 'room:room-3']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(mockRooms[0]))
        .mockResolvedValueOnce(JSON.stringify(mockRooms[1]))
        .mockResolvedValueOnce(JSON.stringify(mockRooms[2]));

      const rooms = await roomStateManager.getAllRooms();

      expect(rooms).toHaveLength(3);
      expect(rooms).toEqual(mockRooms);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('room:*');
    });

    it('should filter rooms by status', async () => {
      const mockRooms = [
        { id: 'room-1', status: 'WAITING' },
        { id: 'room-2', status: 'PLAYING' },
        { id: 'room-3', status: 'WAITING' }
      ];

      mockRedisClient.keys.mockResolvedValue(['room:room-1', 'room:room-2', 'room:room-3']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(mockRooms[0]))
        .mockResolvedValueOnce(JSON.stringify(mockRooms[1]))
        .mockResolvedValueOnce(JSON.stringify(mockRooms[2]));

      const waitingRooms = await roomStateManager.getRoomsByStatus('WAITING');

      expect(waitingRooms).toHaveLength(2);
      expect(waitingRooms.every((room: RoomState) => room.status === 'WAITING')).toBe(true);
    });

    it('should handle empty room list', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const rooms = await roomStateManager.getAllRooms();

      expect(rooms).toHaveLength(0);
      expect(rooms).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis connection failed'));

      const roomData: RoomData = {
        id: 'room-123',
        ownerId: 'user-456',
        ownerUsername: 'testowner',
        playerLimit: 6,
        bigBlind: 20,
        smallBlind: 10
      };

      await expect(
        roomStateManager.createRoomState(roomData)
      ).rejects.toThrow('Redis connection failed');
    });

    it('should handle malformed JSON data', async () => {
      mockRedisClient.get.mockResolvedValue('invalid json');

      await expect(
        roomStateManager.getRoomState('room-123')
      ).rejects.toThrow();
    });

    it('should handle Redis timeout errors', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Command timeout'));

      await expect(
        roomStateManager.getRoomState('room-123')
      ).rejects.toThrow('Command timeout');
    });
  });

  describe('Data Integrity', () => {
    it('should maintain consistent player count', async () => {
      const roomState = {
        id: 'room-123',
        players: [
          { id: 'user-1' },
          { id: 'user-2' },
          { id: 'user-3' }
        ],
        currentPlayerCount: 3,
        maxPlayers: 6
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(roomState));
      mockRedisClient.set.mockResolvedValue('OK');

      const playerData: PlayerData = { id: 'user-4', username: 'player4' };
      const updatedState = await roomStateManager.addPlayerToRoom('room-123', playerData);

      expect(updatedState.players.length).toBe(updatedState.currentPlayerCount);
      expect(updatedState.currentPlayerCount).toBe(4);
    });

    it('should maintain correct player positions after removal', async () => {
      const roomState = {
        id: 'room-123',
        players: [
          { id: 'user-1', position: 0, isOwner: true, chips: 5000, username: 'player1', status: 'ACTIVE' },
          { id: 'user-2', position: 1, isOwner: false, chips: 5000, username: 'player2', status: 'ACTIVE' },
          { id: 'user-3', position: 2, isOwner: false, chips: 5000, username: 'player3', status: 'ACTIVE' },
          { id: 'user-4', position: 3, isOwner: false, chips: 5000, username: 'player4', status: 'ACTIVE' }
        ],
        currentPlayerCount: 4,
        ownerId: 'user-1'
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(roomState));
      mockRedisClient.set.mockResolvedValue('OK');

      // Remove middle player
      const updatedState = await roomStateManager.removePlayerFromRoom('room-123', 'user-2');

      expect(updatedState?.players).toHaveLength(3);
      expect(updatedState?.players[0].position).toBe(0);
      expect(updatedState?.players[1].position).toBe(1); // was user-3
      expect(updatedState?.players[2].position).toBe(2); // was user-4
    });

    it('should preserve other room data when updating players', async () => {
      const roomState = {
        id: 'room-123',
        ownerId: 'user-1',
        players: [{ id: 'user-1', isOwner: true, chips: 5000, username: 'owner', position: 0, status: 'ACTIVE' }],
        status: 'WAITING',
        maxPlayers: 6,
        currentPlayerCount: 1,
        bigBlind: 50,
        smallBlind: 25,
        hasPassword: true,
        gameStarted: false,
        pot: 0
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(roomState));
      mockRedisClient.set.mockResolvedValue('OK');

      const playerData: PlayerData = { id: 'user-2', username: 'player2' };
      const updatedState = await roomStateManager.addPlayerToRoom('room-123', playerData);

      // Check that non-player data is preserved
      expect(updatedState.bigBlind).toBe(50);
      expect(updatedState.smallBlind).toBe(25);
      expect(updatedState.hasPassword).toBe(true);
      expect(updatedState.gameStarted).toBe(false);
      expect(updatedState.pot).toBe(0);
      expect(updatedState.status).toBe('WAITING');
    });
  });
});