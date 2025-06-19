# Frontend Technical Design Document - Texas Poker

## 1. Background & Goals

This Texas Poker frontend system is designed to provide an immersive, real-time poker gaming experience. The primary goals include:

- **Real-time Gaming**: Deliver smooth, low-latency poker gameplay with live updates
- **Scalable Architecture**: Support multiple concurrent rooms and players
- **Responsive Design**: Ensure optimal experience across desktop and mobile devices  
- **Maintainable Codebase**: Clean separation of concerns and modular components
- **Robust State Management**: Handle complex game states and real-time synchronization

## 2. Tech Stack Overview

| Layer          | Technology               | Purpose                                |
|----------------|--------------------------|----------------------------------------|
| Framework      | React 19 + TypeScript   | Component-based UI with static typing  |
| Build Tool     | Vite 6.3.5              | Fast dev server and optimized bundling |
| Routing        | React Router DOM 7.6.2  | SPA navigation and protected routes    |
| State Mgmt     | Zustand 5.0.5           | Lightweight, scalable global state     |
| Styling        | TailwindCSS 4.1.10      | Utility-first CSS framework            |
| API Layer      | Axios 1.10.0            | HTTP client with interceptors          |
| Real-time      | Socket.IO Client 4.8.1  | WebSocket communication                |
| Icons          | Lucide React 0.515.0    | Consistent icon system                 |
| Testing        | Vitest 3.2.3            | Unit and component testing             |

## 3. System Architecture Overview

```
Frontend Application
├── React SPA (Vite + TypeScript)
├── Router (React Router DOM)
├── State Management (Zustand)
├── Real-time Communication (Socket.IO)
├── API Services (Axios)
├── UI Components (Custom + TailwindCSS)
└── Testing Framework (Vitest)

External Dependencies:
├── Backend REST API
├── WebSocket Server
└── Authentication Service
```

## 4. Project Structure

```
/frontend/
├── src/
│   ├── App.tsx                 # Main app component with routing
│   ├── main.tsx               # Entry point
│   ├── index.css              # Global styles and TailwindCSS
│   ├── vite-env.d.ts          # Vite type definitions
│   │
│   ├── pages/                 # Route-based page components
│   │   ├── LoginPage.tsx      # Authentication page
│   │   ├── LobbyPage.tsx      # Room selection and user management
│   │   └── GamePage.tsx       # Poker game interface
│   │
│   ├── components/            # Reusable UI components
│   │   ├── ProtectedRoute.tsx     # Auth guard component
│   │   ├── ReconnectionIndicator.tsx  # Network status
│   │   ├── NetworkIndicator.tsx       # Connection quality
│   │   ├── RoomList.tsx              # Room listing
│   │   ├── CreateRoomModal.tsx       # Room creation
│   │   ├── JoinRoomModal.tsx         # Room joining
│   │   ├── GameTable.tsx             # Poker table UI
│   │   ├── PlayerSeat.tsx            # Individual player display
│   │   ├── ActionPanel.tsx           # Player action controls
│   │   ├── PokerCards.tsx            # Card rendering
│   │   ├── PotDisplay.tsx            # Pot and betting display
│   │   ├── HandReveal.tsx            # Hand result display
│   │   ├── ActionHistory.tsx         # Game action log
│   │   ├── GameEffects.tsx           # Visual effects
│   │   ├── ResultModal.tsx           # Game end results
│   │   └── WinnerHighlight.tsx       # Winner animations
│   │
│   ├── hooks/                 # Custom React hooks
│   │   └── useSocket.ts       # Socket.IO integration hook
│   │
│   ├── stores/                # Zustand state stores
│   │   ├── userStore.ts       # User auth and profile state
│   │   ├── roomStore.ts       # Room management state
│   │   └── gameStore.ts       # Game state and actions
│   │
│   ├── services/              # External service integrations
│   │   ├── api.ts             # REST API client
│   │   └── socketService.ts   # Socket.IO service
│   │
│   ├── types/                 # TypeScript type definitions
│   │   ├── game.ts            # Game-related types
│   │   └── socket.ts          # Socket event types
│   │
│   └── assets/                # Static assets
│       └── react.svg          # Icons and images
│
├── __tests__/                 # Test files
│   ├── components/            # Component tests
│   ├── hooks/                 # Hook tests
│   ├── pages/                 # Page tests
│   ├── services/              # Service tests
│   ├── fixtures/              # Test data
│   └── helpers/               # Test utilities
│
├── public/                    # Static public assets
├── package.json              # Dependencies and scripts
├── vite.config.ts            # Vite configuration
├── tailwind.config.ts        # TailwindCSS configuration
├── tsconfig.json             # TypeScript configuration
└── vitest.config.ts          # Testing configuration
```

## 5. Routing & Access Control

### Route Configuration
Routes are defined in `src/App.tsx` with the following structure:
- `/login` - Public authentication page
- `/lobby` - Protected lobby page (room selection)
- `/game/:roomId` - Protected game page (poker gameplay)
- `/` - Redirects to `/lobby`
- `*` - Catch-all redirects to `/lobby`

### Protected Route Implementation
- **Component**: `ProtectedRoute.tsx` (src/components/ProtectedRoute.tsx:9)
- **Authentication Check**: Uses `useUserStore` to verify `isAuthenticated` state
- **Token Loading**: Attempts to load user from stored token on mount
- **Redirect Logic**: Redirects unauthenticated users to `/login` with return URL

### Access Control Features
- JWT token-based authentication
- Automatic token refresh via API interceptors
- Route state preservation for post-login navigation
- Loading states during authentication verification

## 6. State Management Strategy

### Zustand Store Architecture
The application uses three main Zustand stores for state management:

#### 6.1 User Store (`userStore.ts`)
**Purpose**: Authentication and user profile management
**Key Features**:
- JWT token persistence with localStorage
- Login/register operations with error handling
- Automatic token validation and refresh
- User session management

```typescript
interface UserState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}
```

#### 6.2 Room Store (`roomStore.ts`) 
**Purpose**: Room listing and management via REST API
**Key Features**:
- Room CRUD operations (create, read, delete)
- Paginated room listing with filtering
- Join/leave room functionality
- Error handling and loading states

```typescript
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
}
```

#### 6.3 Game Store (`gameStore.ts`)
**Purpose**: Real-time game state management
**Key Features**:
- Socket-driven game state updates
- Player action tracking and history
- Game phase management (waiting, playing, finished)
- Turn-based logic and validation

```typescript
interface GameStoreState {
  currentRoom: RoomState | null;
  gameState: GameState | null;
  gameResults: GameResult[] | null;
  isInGame: boolean;
  isGameStarted: boolean;
  isMyTurn: boolean;
  currentPlayerId: string | null;
  recentActions: Array<{
    playerId: string;
    action: PlayerAction;
    timestamp: Date;
  }>;
}
```

### State Persistence Strategy
- **User Store**: Persisted to localStorage for authentication persistence
- **Room Store**: Session-only, refreshed on app load
- **Game Store**: Real-time only, synchronized via Socket.IO

## 7. API Communication

### 7.1 REST API Integration (`api.ts`)
**Base Configuration**:
- Axios instance with configurable base URL via `VITE_API_URL`
- Request/response interceptors for authentication
- Automatic token attachment via Authorization header
- 401 error handling with automatic logout

**API Modules**:
- **Auth API**: login, register, getCurrentUser
- **Room API**: list, create, join, delete operations

### 7.2 Real-time Communication (`socketService.ts`)
**Architecture**: Class-based singleton service for Socket.IO management

**Key Features**:
- Connection lifecycle management with automatic reconnection
- Event-driven architecture with typed event handlers
- Network quality monitoring with ping/latency tracking
- State recovery after disconnection
- Room and game event handling

**Connection Flow**:
1. Authentication via JWT token in connection auth
2. Automatic event handler setup for room/game events
3. Connection status monitoring and user notification
4. Graceful reconnection with state synchronization

**Event Categories**:
- **Connection Events**: connect, disconnect, reconnect attempts
- **Room Events**: join, leave, player updates, state changes  
- **Game Events**: game start, player actions, phase changes, game end
- **System Events**: errors, heartbeat, network quality updates

### 7.3 Socket Integration Hook (`useSocket.ts`)
**Purpose**: React hook for Socket.IO integration with state management

**Features**:
- Declarative Socket.IO integration for React components
- Automatic store updates from socket events
- Connection state management and error handling
- Game action methods with promise-based responses
- Navigation integration for room/game transitions

## 8. Styling System

### 8.1 TailwindCSS Configuration
- **Version**: 4.1.10 with PostCSS integration
- **Content Paths**: `./index.html`, `./src/**/*.{js,ts,jsx,tsx}`
- **Theme**: Default theme with minimal extensions
- **Build Integration**: Configured via PostCSS in Vite

### 8.2 Styling Approach
- **Utility-First**: Prefer TailwindCSS utility classes over custom CSS
- **Component Styling**: Consistent patterns for poker game elements
- **Responsive Design**: Mobile-first responsive breakpoints
- **Color Scheme**: Green poker table theme with dark UI elements
- **Animations**: Custom CSS animations for card reveals and game effects

### 8.3 Custom Styles (`index.css`)
```css
/* Custom animations for game effects */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.5s ease-out;
}
```

## 9. Component Architecture

### 9.1 Page Components
- **LoginPage**: Authentication form with login/register toggle
- **LobbyPage**: Room listing, creation, quick start, and user status
- **GamePage**: Complete poker game interface with real-time updates

### 9.2 Game Components
- **GameTable**: Central poker table layout and community cards
- **PlayerSeat**: Individual player display with chips, cards, and status
- **ActionPanel**: Player action controls (fold, call, raise, etc.)
- **PokerCards**: Card rendering with animations and face-up/down states
- **PotDisplay**: Current pot size and betting round information
- **ActionHistory**: Scrollable log of player actions

### 9.3 Modal Components
- **CreateRoomModal**: Room creation form with game settings
- **JoinRoomModal**: Room password entry and joining
- **ResultModal**: Game end results and statistics
- **RoomSwitchConfirmModal**: Confirmation for leaving current room

### 9.4 Utility Components
- **ProtectedRoute**: Authentication guard for protected pages
- **NetworkIndicator**: Connection status and quality display
- **ReconnectionIndicator**: Connection loss and recovery notifications

### 9.5 Component Design Patterns
- **Composition**: Components accept children and render props
- **Props Interface**: TypeScript interfaces for all component props
- **Error Boundaries**: Graceful error handling in game components
- **Conditional Rendering**: Game state-based UI variations

## 10. Real-time Game Features

### 10.1 Socket Event Handling
**Connection Management**:
- Automatic connection on user authentication
- Graceful reconnection with state recovery
- Network quality monitoring and user feedback

**Room Events**:
- Real-time player join/leave notifications
- Room state synchronization across clients
- Quick start matchmaking

**Game Events**:
- Turn-based action prompts and timeouts
- Live game state updates (cards, pots, player status)
- Phase transitions (pre-flop, flop, turn, river)
- Game end with results and statistics

### 10.2 State Synchronization
- **Optimistic Updates**: Local state updates before server confirmation
- **Conflict Resolution**: Server state takes precedence on conflicts
- **Recovery Mechanisms**: Full state sync after reconnection
- **Validation**: Client-side validation with server-side verification

## 11. Performance Optimization

### 11.1 Build Optimizations
- **Vite**: Fast development server with HMR
- **Code Splitting**: Automatic chunk splitting by Vite
- **Tree Shaking**: Unused code elimination in production builds
- **TypeScript**: Static type checking for runtime error prevention

### 11.2 Runtime Optimizations
- **React 19**: Latest React features and performance improvements
- **Zustand**: Minimal re-renders with selective subscriptions
- **Socket.IO**: Efficient WebSocket communication with automatic fallbacks
- **Component Memoization**: Strategic use of React.memo for expensive components

### 11.3 Network Optimizations
- **Request Interceptors**: Automatic retry logic and error handling
- **Connection Pooling**: Socket.IO connection reuse
- **Compression**: Gzip compression for API responses
- **Caching**: API response caching where appropriate

## 12. Testing Strategy

### 12.1 Testing Framework
- **Vitest**: Fast unit testing with ES modules support
- **Testing Library**: Component testing with user behavior focus
- **Jest DOM**: Extended matchers for DOM testing

### 12.2 Test Coverage
- **Component Tests**: All game components with user interaction testing
- **Hook Tests**: Socket integration and state management hooks
- **Service Tests**: API and Socket.IO service functionality
- **Integration Tests**: End-to-end user flows

### 12.3 Test Utilities
- **Mock Factory**: Realistic test data generation
- **Test Utils**: Custom render functions with store providers
- **Socket Mocking**: Socket.IO event simulation for testing

## 13. Security Considerations

### 13.1 Authentication Security
- **JWT Tokens**: Secure token-based authentication
- **Token Expiration**: Automatic token refresh and validation
- **Secure Storage**: Appropriate token storage in localStorage
- **Route Protection**: Authentication guards on protected routes

### 13.2 API Security
- **HTTPS**: Secure communication with backend services
- **CORS**: Proper cross-origin resource sharing configuration
- **Input Validation**: Client-side validation with server-side verification
- **Error Handling**: Secure error messages without sensitive data exposure

### 13.3 WebSocket Security
- **Authentication**: Socket.IO connection authentication via JWT
- **Rate Limiting**: Client-side action throttling
- **Input Sanitization**: Validation of all socket event data
- **Connection Security**: Secure WebSocket connections (WSS)

## 14. Development & Deployment

### 14.1 Development Setup
```bash
npm install          # Install dependencies
npm run dev         # Start development server
npm run test        # Run test suite
npm run lint        # Run ESLint
```

### 14.2 Build Configuration
- **Production Build**: `npm run build` - TypeScript compilation + Vite bundling
- **Preview**: `npm run preview` - Local preview of production build
- **Docker**: Containerized deployment with nginx serving static files

### 14.3 Environment Configuration
- **Development**: `VITE_API_URL` and `VITE_BACKEND_URL` for local backend
- **Production**: Environment-specific API endpoints
- **Feature Flags**: Environment-based feature toggles

## 15. Future Enhancements

### 15.1 Planned Features
- **Spectator Mode**: Allow users to watch ongoing games
- **Tournament Support**: Multi-table tournament functionality
- **Chat System**: In-game text chat with emoji support
- **Player Statistics**: Detailed game history and performance metrics
- **Mobile App**: React Native mobile application

### 15.2 Technical Improvements
- **PWA**: Progressive Web App features for mobile experience
- **Internationalization**: Multi-language support with i18n
- **Advanced Animations**: Enhanced card animations and transitions
- **Performance Monitoring**: Real-time performance tracking and optimization
- **Accessibility**: Enhanced screen reader and keyboard navigation support