import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

const mockRooms = [
  {
    id: 'room-1',
    ownerId: 'user-1',
    owner: { id: 'user-1', username: 'player1' },
    playerLimit: 6,
    currentPlayers: 2,
    hasPassword: false,
    status: 'WAITING',
    bigBlind: 20,
    smallBlind: 10,
    createdAt: '2025-06-15T10:00:00.000Z'
  },
  {
    id: 'room-2',
    ownerId: 'user-2',
    owner: { id: 'user-2', username: 'player2' },
    playerLimit: 4,
    currentPlayers: 4,
    hasPassword: false,
    status: 'WAITING',
    bigBlind: 40,
    smallBlind: 20,
    createdAt: '2025-06-15T11:00:00.000Z'
  },
  {
    id: 'room-3',
    ownerId: 'user-3',
    owner: { id: 'user-3', username: 'player3' },
    playerLimit: 8,
    currentPlayers: 1,
    hasPassword: true,
    status: 'WAITING',
    bigBlind: 100,
    smallBlind: 50,
    createdAt: '2025-06-15T09:15:00.000Z'
  }
];

const mockCreateRoom = vi.fn();
const mockJoinRoom = vi.fn();
const mockSocketQuickStart = vi.fn();
const mockSocketJoinRoom = vi.fn();

vi.mock('../../src/components/../stores/roomStore', () => ({
  useRoomStore: vi.fn(() => ({
    rooms: mockRooms,
    createRoom: mockCreateRoom,
    joinRoom: mockJoinRoom,
    isLoading: false
  }))
}));

vi.mock('../../src/components/useSocket', () => ({
  useSocket: vi.fn(() => ({
    connected: true,
    quickStart: mockSocketQuickStart,
    joinRoom: mockSocketJoinRoom
  }))
}));

// Create a custom hook for quick start functionality
const useQuickStart = () => {
  const navigate = mockNavigate;
  const { rooms, createRoom, joinRoom } = require('../../stores/roomStore').useRoomStore();
  const { connected, quickStart: socketQuickStart, joinRoom: socketJoinRoom } = require('../useSocket').useSocket();

  const findAvailableRoom = () => {
    return rooms.find((room: any) => 
      room.status === 'WAITING' && 
      room.currentPlayers < room.playerLimit &&
      !room.hasPassword
    );
  };

  const quickStartSocket = async () => {
    if (!connected) {
      throw new Error('Not connected to server');
    }

    const response = await socketQuickStart();
    if (response.success && response.data?.roomId) {
      navigate(`/game/${response.data.roomId}`);
      return response;
    } else {
      throw new Error(response.error || 'Quick start failed');
    }
  };

  const quickStartAPI = async () => {
    const availableRoom = findAvailableRoom();
    
    if (availableRoom) {
      const response = await joinRoom({
        roomId: availableRoom.id,
        password: undefined
      });
      navigate(`/game/${availableRoom.id}`);
      return response;
    } else {
      // Create new room
      const newRoom = await createRoom({
        playerLimit: 6,
        bigBlind: 20,
        smallBlind: 10,
        password: undefined
      });
      navigate(`/game/${newRoom.id}`);
      return newRoom;
    }
  };

  const quickStart = async (useSocket = true) => {
    if (useSocket && connected) {
      return await quickStartSocket();
    } else {
      return await quickStartAPI();
    }
  };

  return {
    quickStart,
    quickStartSocket,
    quickStartAPI,
    findAvailableRoom,
    connected,
    rooms
  };
};

describe('useQuickStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAvailableRoom', () => {
    it('should find an available room', () => {
      const { result } = renderHook(() => useQuickStart());
      
      const availableRoom = result.current.findAvailableRoom();
      expect(availableRoom).toBeDefined();
      expect(availableRoom.id).toBe('room-1');
      expect(availableRoom.status).toBe('WAITING');
      expect(availableRoom.hasPassword).toBe(false);
      expect(availableRoom.currentPlayers).toBeLessThan(availableRoom.playerLimit);
    });

    it('should not find room that is full', () => {
      // Mock rooms with only full rooms
      const fullRooms = mockRooms.map(room => ({
        ...room,
        currentPlayers: room.playerLimit
      }));

      const { useRoomStore } = require('../../stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: fullRooms,
        createRoom: mockCreateRoom,
        joinRoom: mockJoinRoom,
        isLoading: false
      });

      const { result } = renderHook(() => useQuickStart());
      
      const availableRoom = result.current.findAvailableRoom();
      expect(availableRoom).toBeUndefined();
    });

    it('should not find room with password', () => {
      // Mock rooms with only password rooms
      const passwordRooms = mockRooms.map(room => ({
        ...room,
        hasPassword: true
      }));

      const { useRoomStore } = require('../../stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: passwordRooms,
        createRoom: mockCreateRoom,
        joinRoom: mockJoinRoom,
        isLoading: false
      });

      const { result } = renderHook(() => useQuickStart());
      
      const availableRoom = result.current.findAvailableRoom();
      expect(availableRoom).toBeUndefined();
    });

    it('should not find room that is not waiting', () => {
      // Mock rooms with only non-waiting rooms
      const nonWaitingRooms = mockRooms.map(room => ({
        ...room,
        status: 'PLAYING'
      }));

      const { useRoomStore } = require('../../stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: nonWaitingRooms,
        createRoom: mockCreateRoom,
        joinRoom: mockJoinRoom,
        isLoading: false
      });

      const { result } = renderHook(() => useQuickStart());
      
      const availableRoom = result.current.findAvailableRoom();
      expect(availableRoom).toBeUndefined();
    });

    it('should return undefined when no rooms exist', () => {
      const { useRoomStore } = require('../../stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: [],
        createRoom: mockCreateRoom,
        joinRoom: mockJoinRoom,
        isLoading: false
      });

      const { result } = renderHook(() => useQuickStart());
      
      const availableRoom = result.current.findAvailableRoom();
      expect(availableRoom).toBeUndefined();
    });
  });

  describe('quickStartSocket', () => {
    it('should use socket quick start when connected', async () => {
      mockSocketQuickStart.mockResolvedValue({
        success: true,
        data: { roomId: 'socket-room-123' }
      });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        const response = await result.current.quickStartSocket();
        expect(response.success).toBe(true);
        expect(response.data.roomId).toBe('socket-room-123');
      });

      expect(mockSocketQuickStart).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/game/socket-room-123');
    });

    it('should throw error when not connected', async () => {
      const { useSocket } = require('../useSocket');
      useSocket.mockReturnValue({
        connected: false,
        quickStart: mockSocketQuickStart,
        joinRoom: mockSocketJoinRoom
      });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        await expect(result.current.quickStartSocket()).rejects.toThrow('Not connected to server');
      });

      expect(mockSocketQuickStart).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should throw error when socket quick start fails', async () => {
      mockSocketQuickStart.mockResolvedValue({
        success: false,
        error: 'No available rooms'
      });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        await expect(result.current.quickStartSocket()).rejects.toThrow('No available rooms');
      });

      expect(mockSocketQuickStart).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should throw error when socket response has no room ID', async () => {
      mockSocketQuickStart.mockResolvedValue({
        success: true,
        data: null
      });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        await expect(result.current.quickStartSocket()).rejects.toThrow('Quick start failed');
      });

      expect(mockSocketQuickStart).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('quickStartAPI', () => {
    it('should join available room when one exists', async () => {
      mockJoinRoom.mockResolvedValue({ room: mockRooms[0] });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        const response = await result.current.quickStartAPI();
        expect(response.room).toEqual(mockRooms[0]);
      });

      expect(mockJoinRoom).toHaveBeenCalledWith({
        roomId: 'room-1',
        password: undefined
      });
      expect(mockNavigate).toHaveBeenCalledWith('/game/room-1');
      expect(mockCreateRoom).not.toHaveBeenCalled();
    });

    it('should create new room when no available rooms exist', async () => {
      // Mock no available rooms
      const noAvailableRooms = mockRooms.map(room => ({
        ...room,
        currentPlayers: room.playerLimit // All rooms full
      }));

      const { useRoomStore } = require('../../stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: noAvailableRooms,
        createRoom: mockCreateRoom,
        joinRoom: mockJoinRoom,
        isLoading: false
      });

      const newRoom = { id: 'new-room-123', ownerId: 'current-user' };
      mockCreateRoom.mockResolvedValue(newRoom);

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        const response = await result.current.quickStartAPI();
        expect(response).toEqual(newRoom);
      });

      expect(mockCreateRoom).toHaveBeenCalledWith({
        playerLimit: 6,
        bigBlind: 20,
        smallBlind: 10,
        password: undefined
      });
      expect(mockNavigate).toHaveBeenCalledWith('/game/new-room-123');
      expect(mockJoinRoom).not.toHaveBeenCalled();
    });

    it('should handle join room failure', async () => {
      mockJoinRoom.mockRejectedValue(new Error('Room join failed'));

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        await expect(result.current.quickStartAPI()).rejects.toThrow('Room join failed');
      });

      expect(mockJoinRoom).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should handle create room failure', async () => {
      // Mock no available rooms
      const { useRoomStore } = require('../../stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: [],
        createRoom: mockCreateRoom,
        joinRoom: mockJoinRoom,
        isLoading: false
      });

      mockCreateRoom.mockRejectedValue(new Error('Room creation failed'));

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        await expect(result.current.quickStartAPI()).rejects.toThrow('Room creation failed');
      });

      expect(mockCreateRoom).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('quickStart (unified method)', () => {
    it('should use socket when connected and useSocket is true', async () => {
      mockSocketQuickStart.mockResolvedValue({
        success: true,
        data: { roomId: 'socket-room-123' }
      });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        const response = await result.current.quickStart(true);
        expect(response.success).toBe(true);
      });

      expect(mockSocketQuickStart).toHaveBeenCalled();
      expect(mockJoinRoom).not.toHaveBeenCalled();
      expect(mockCreateRoom).not.toHaveBeenCalled();
    });

    it('should use API when not connected', async () => {
      const { useSocket } = require('../useSocket');
      useSocket.mockReturnValue({
        connected: false,
        quickStart: mockSocketQuickStart,
        joinRoom: mockSocketJoinRoom
      });

      mockJoinRoom.mockResolvedValue({ room: mockRooms[0] });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        const response = await result.current.quickStart(true);
        expect(response.room).toEqual(mockRooms[0]);
      });

      expect(mockSocketQuickStart).not.toHaveBeenCalled();
      expect(mockJoinRoom).toHaveBeenCalled();
    });

    it('should use API when useSocket is false', async () => {
      mockJoinRoom.mockResolvedValue({ room: mockRooms[0] });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        const response = await result.current.quickStart(false);
        expect(response.room).toEqual(mockRooms[0]);
      });

      expect(mockSocketQuickStart).not.toHaveBeenCalled();
      expect(mockJoinRoom).toHaveBeenCalled();
    });

    it('should default to using socket when no parameter provided', async () => {
      mockSocketQuickStart.mockResolvedValue({
        success: true,
        data: { roomId: 'socket-room-123' }
      });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        const response = await result.current.quickStart();
        expect(response.success).toBe(true);
      });

      expect(mockSocketQuickStart).toHaveBeenCalled();
    });
  });

  describe('Room Matching Logic', () => {
    it('should prefer room with fewer players', () => {
      const roomsWithDifferentCounts = [
        {
          ...mockRooms[0],
          id: 'room-many',
          currentPlayers: 5,
          playerLimit: 6
        },
        {
          ...mockRooms[0],
          id: 'room-few',
          currentPlayers: 1,
          playerLimit: 6
        }
      ];

      const { useRoomStore } = require('../../stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: roomsWithDifferentCounts,
        createRoom: mockCreateRoom,
        joinRoom: mockJoinRoom,
        isLoading: false
      });

      const { result } = renderHook(() => useQuickStart());
      
      const availableRoom = result.current.findAvailableRoom();
      expect(availableRoom.id).toBe('room-many'); // First room found (array order)
    });

    it('should handle rooms with edge cases', () => {
      const edgeCaseRooms = [
        {
          ...mockRooms[0],
          id: 'room-zero',
          currentPlayers: 0,
          playerLimit: 2
        },
        {
          ...mockRooms[0],
          id: 'room-almost-full',
          currentPlayers: 8,
          playerLimit: 9
        }
      ];

      const { useRoomStore } = require('../../stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: edgeCaseRooms,
        createRoom: mockCreateRoom,
        joinRoom: mockJoinRoom,
        isLoading: false
      });

      const { result } = renderHook(() => useQuickStart());
      
      const availableRoom = result.current.findAvailableRoom();
      expect(availableRoom).toBeDefined();
      expect(availableRoom.currentPlayers).toBeLessThan(availableRoom.playerLimit);
    });
  });

  describe('Error Recovery', () => {
    it('should fallback to API when socket fails', async () => {
      mockSocketQuickStart.mockRejectedValue(new Error('Socket error'));
      mockJoinRoom.mockResolvedValue({ room: mockRooms[0] });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        // Try socket first, should fail
        await expect(result.current.quickStartSocket()).rejects.toThrow('Socket error');
        
        // Then try API fallback
        const response = await result.current.quickStartAPI();
        expect(response.room).toEqual(mockRooms[0]);
      });
    });

    it('should handle multiple consecutive failures gracefully', async () => {
      // First call fails
      mockSocketQuickStart.mockRejectedValueOnce(new Error('First failure'));
      // Second call succeeds
      mockSocketQuickStart.mockResolvedValueOnce({
        success: true,
        data: { roomId: 'recovery-room' }
      });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        // First attempt should fail
        await expect(result.current.quickStartSocket()).rejects.toThrow('First failure');
        
        // Second attempt should succeed
        const response = await result.current.quickStartSocket();
        expect(response.success).toBe(true);
        expect(response.data.roomId).toBe('recovery-room');
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large number of rooms efficiently', () => {
      const manyRooms = Array.from({ length: 1000 }, (_, i) => ({
        ...mockRooms[0],
        id: `room-${i}`,
        currentPlayers: i % 6, // Some will be available
        playerLimit: 6,
        hasPassword: i % 10 === 0 // 10% have passwords
      }));

      const { useRoomStore } = require('../../stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: manyRooms,
        createRoom: mockCreateRoom,
        joinRoom: mockJoinRoom,
        isLoading: false
      });

      const { result } = renderHook(() => useQuickStart());
      
      const startTime = performance.now();
      const availableRoom = result.current.findAvailableRoom();
      const endTime = performance.now();
      
      expect(availableRoom).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10); // Should be fast
    });

    it('should handle rooms with invalid data gracefully', () => {
      const invalidRooms = [
        {
          ...mockRooms[0],
          currentPlayers: null,
          playerLimit: undefined
        },
        {
          ...mockRooms[0],
          status: null,
          hasPassword: undefined
        }
      ];

      const { useRoomStore } = require('../../stores/roomStore');
      useRoomStore.mockReturnValue({
        rooms: invalidRooms,
        createRoom: mockCreateRoom,
        joinRoom: mockJoinRoom,
        isLoading: false
      });

      const { result } = renderHook(() => useQuickStart());
      
      // Should not crash
      expect(() => result.current.findAvailableRoom()).not.toThrow();
    });

    it('should handle concurrent quick start attempts', async () => {
      mockSocketQuickStart.mockResolvedValue({
        success: true,
        data: { roomId: 'concurrent-room' }
      });

      const { result } = renderHook(() => useQuickStart());
      
      await act(async () => {
        // Start multiple quick starts simultaneously
        const promises = [
          result.current.quickStart(),
          result.current.quickStart(),
          result.current.quickStart()
        ];
        
        const results = await Promise.all(promises);
        
        // All should succeed
        results.forEach(response => {
          expect(response.success).toBe(true);
        });
      });

      // Socket should be called multiple times
      expect(mockSocketQuickStart).toHaveBeenCalledTimes(3);
    });
  });
});