import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock store types
export interface MockUserStore {
  user: any;
  token: string | null;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  setToken: ReturnType<typeof vi.fn>;
}

export interface MockGameStore {
  gameState: any;
  currentRoom: any;
  setGameState: ReturnType<typeof vi.fn>;
  setCurrentRoom: ReturnType<typeof vi.fn>;
  resetGame: ReturnType<typeof vi.fn>;
  joinRoom: ReturnType<typeof vi.fn>;
  leaveRoom: ReturnType<typeof vi.fn>;
}

// Default mock store implementations
export const createMockUserStore = (overrides: Partial<MockUserStore> = {}): MockUserStore => ({
  user: { id: '1', username: 'testuser', avatar: 'test-avatar.jpg' },
  token: 'mock-token',
  login: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
  setToken: vi.fn(),
  ...overrides,
});

export const createMockGameStore = (overrides: Partial<MockGameStore> = {}): MockGameStore => ({
  gameState: null,
  currentRoom: null,
  setGameState: vi.fn(),
  setCurrentRoom: vi.fn(),
  resetGame: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  ...overrides,
});

// Socket service mock factory
export const createMockSocketService = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  makeAction: vi.fn(),
  restartGame: vi.fn(),
  isConnected: vi.fn(() => true),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  getUserCurrentRoomStatus: vi.fn(),
  attemptStateRecovery: vi.fn(),
  getConnectionStatus: vi.fn(() => ({ isConnected: true, isReconnecting: false })),
});

// Router wrapper options
interface RouterWrapperOptions {
  initialEntries?: string[];
  initialIndex?: number;
  useMemoryRouter?: boolean;
}

// Create router wrapper
const createRouterWrapper = (options: RouterWrapperOptions = {}) => {
  const { initialEntries = ['/'], initialIndex = 0, useMemoryRouter = true } = options;
  
  if (useMemoryRouter) {
    return ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        {children}
      </MemoryRouter>
    );
  }
  
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

// All providers wrapper
interface AllProvidersProps {
  children: React.ReactNode;
  routerOptions?: RouterWrapperOptions;
}

const AllProviders: React.FC<AllProvidersProps> = ({ children, routerOptions = {} }) => {
  const RouterWrapper = createRouterWrapper(routerOptions);
  
  return (
    <RouterWrapper>
      {children}
    </RouterWrapper>
  );
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  routerOptions?: RouterWrapperOptions;
}

export const customRender = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { routerOptions, ...renderOptions } = options;
  
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AllProviders routerOptions={routerOptions}>
      {children}
    </AllProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Utility for testing hooks that use router context
export const createHookWrapper = (routerOptions: RouterWrapperOptions = {}) => {
  const RouterWrapper = createRouterWrapper(routerOptions);
  
  return ({ children }: { children: React.ReactNode }) => (
    <RouterWrapper>
      {children}
    </RouterWrapper>
  );
};

// Mock setup helpers
export const setupStoreMocks = (userStore?: Partial<MockUserStore>, gameStore?: Partial<MockGameStore>) => {
  const mockUserStore = createMockUserStore(userStore);
  const mockGameStore = createMockGameStore(gameStore);
  
  // Mock the store modules
  vi.doMock('../../src/stores/userStore', () => ({
    useUserStore: vi.fn(() => mockUserStore),
  }));
  
  vi.doMock('../../src/stores/gameStore', () => ({
    useGameStore: vi.fn(() => mockGameStore),
  }));
  
  return { mockUserStore, mockGameStore };
};

export const setupSocketServiceMock = (overrides: Record<string, any> = {}) => {
  const mockSocketService = createMockSocketService();
  Object.assign(mockSocketService, overrides);
  
  vi.doMock('../../src/services/socketService', () => ({
    default: mockSocketService,
    socketService: mockSocketService,
  }));
  
  return mockSocketService;
};

// Test cleanup helper
export const cleanupMocks = () => {
  vi.clearAllMocks();
  vi.resetModules();
};

// Export everything from testing library with our custom render
export * from '@testing-library/react';
export { customRender as render };