import { create } from 'zustand';
import { Room, roomAPI, CreateRoomData, JoinRoomData } from '../services/api';

interface RoomState {
  rooms: Room[];
  currentRoom: Room | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Actions
  fetchRooms: (page?: number) => Promise<void>;
  createRoom: (data: CreateRoomData) => Promise<Room>;
  joinRoom: (data: JoinRoomData) => Promise<Room>;
  leaveRoom: () => void;
  deleteRoom: (roomId: string) => Promise<void>;
  clearError: () => void;
  refreshRooms: () => Promise<void>;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  currentRoom: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },

  fetchRooms: async (page = 1) => {
    try {
      set({ isLoading: true, error: null });
      const response = await roomAPI.list(page, get().pagination.limit);
      set({
        rooms: response.rooms,
        pagination: response.pagination,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch rooms',
        isLoading: false,
      });
    }
  },

  createRoom: async (data: CreateRoomData) => {
    try {
      set({ isLoading: true, error: null });
      const response = await roomAPI.create(data);
      
      // Add new room to the list and set as current room
      set((state) => ({
        rooms: [response.room, ...state.rooms],
        currentRoom: response.room,
        isLoading: false,
      }));
      
      return response.room;
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to create room',
        isLoading: false,
      });
      throw error;
    }
  },

  joinRoom: async (data: JoinRoomData) => {
    try {
      set({ isLoading: true, error: null });
      const response = await roomAPI.join(data);
      
      // Update the room in the list and set as current room
      set((state) => ({
        rooms: state.rooms.map(room => 
          room.id === response.room.id ? response.room : room
        ),
        currentRoom: response.room,
        isLoading: false,
      }));
      
      return response.room;
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to join room',
        isLoading: false,
      });
      throw error;
    }
  },

  leaveRoom: () => {
    set({ currentRoom: null });
    // Refresh room list to get updated player counts
    get().refreshRooms();
  },

  deleteRoom: async (roomId: string) => {
    try {
      set({ isLoading: true, error: null });
      await roomAPI.delete(roomId);
      
      // Remove room from list and clear current room if it was deleted
      set((state) => ({
        rooms: state.rooms.filter(room => room.id !== roomId),
        currentRoom: state.currentRoom?.id === roomId ? null : state.currentRoom,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to delete room',
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  refreshRooms: async () => {
    const currentPage = get().pagination.page;
    await get().fetchRooms(currentPage);
  },
}));