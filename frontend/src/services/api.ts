import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login will be handled by the router
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export interface RegisterData {
  username: string;
  password: string;
  avatar?: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  avatar?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface UserResponse {
  message: string;
  user: User;
}

export const authAPI = {
  register: (data: RegisterData): Promise<AuthResponse> =>
    api.post('/auth/register', data).then(res => res.data),
  
  login: (data: LoginData): Promise<AuthResponse> =>
    api.post('/auth/login', data).then(res => res.data),
  
  getCurrentUser: (): Promise<UserResponse> =>
    api.get('/user/me').then(res => res.data),
};

// Room API
export interface Room {
  id: string;
  ownerId: string;
  owner: {
    id: string;
    username: string;
    avatar?: string;
  };
  playerLimit: number;
  currentPlayers: number;
  hasPassword: boolean;
  status: 'WAITING' | 'PLAYING' | 'ENDED';
  bigBlind: number;
  smallBlind: number;
  createdAt: string;
  players?: Player[];
}

export interface Player {
  id: string;
  username: string;
  chips: number;
  position: number;
  isOwner: boolean;
}

export interface CreateRoomData {
  playerLimit: number;
  password?: string;
  bigBlind: number;
  smallBlind: number;
}

export interface JoinRoomData {
  roomId: string;
  password?: string;
}

export interface RoomListResponse {
  rooms: Room[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RoomResponse {
  message: string;
  room: Room;
}

export const roomAPI = {
  list: (page = 1, limit = 10): Promise<RoomListResponse> =>
    api.get(`/room/list?page=${page}&limit=${limit}`).then(res => res.data),
  
  create: (data: CreateRoomData): Promise<RoomResponse> =>
    api.post('/room/create', data).then(res => res.data),
  
  join: (data: JoinRoomData): Promise<RoomResponse> =>
    api.post('/room/join', data).then(res => res.data),
  
  delete: (roomId: string): Promise<{ message: string }> =>
    api.delete(`/room/${roomId}`).then(res => res.data),
};

export default api;