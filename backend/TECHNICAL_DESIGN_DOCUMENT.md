# Texas Poker Backend - Technical Design Document

## Table of Contents

1. [System Overview](#system-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Component Design](#component-design)
5. [Data Architecture](#data-architecture)
6. [API Design](#api-design)
7. [Real-time Communication](#real-time-communication)
8. [Game Engine Design](#game-engine-design)
9. [State Management](#state-management)
10. [Security Architecture](#security-architecture)
11. [Performance & Scalability](#performance--scalability)
12. [Testing Strategy](#testing-strategy)
13. [Deployment Architecture](#deployment-architecture)
14. [Monitoring & Observability](#monitoring--observability)

## System Overview

The Texas Poker backend is a real-time multiplayer poker server built using Node.js with TypeScript. It provides both REST API endpoints for traditional client-server communication and WebSocket connections for real-time gameplay features.

### Key Features
- User authentication and session management
- Room-based multiplayer gameplay
- Real-time poker game mechanics
- State synchronization across multiple clients
- Comprehensive game statistics and history
- Scalable architecture for concurrent games

### Design Principles
- **Separation of Concerns**: Clear separation between API, game logic, and real-time communication
- **Type Safety**: Full TypeScript implementation with strict type checking
- **Real-time First**: Optimized for low-latency multiplayer gaming
- **Stateful Design**: Hybrid approach using both persistent and in-memory state management
- **Testability**: Comprehensive test coverage with isolated unit tests

## System Architecture

### Overall Architecture Pattern

The system follows a **layered architecture** with **event-driven patterns** for real-time features:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
├─────────────────────────────────────────────────────────────┤
│              Load Balancer / Reverse Proxy                  │
├─────────────────────────────────────────────────────────────┤
│                    Texas Poker Backend                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   HTTP Server   │  │  WebSocket      │  │   Game      │  │
│  │   (Express.js)  │  │   Server        │  │   Engine    │  │
│  │                 │  │  (Socket.IO)    │  │             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │  Authentication │  │   Room          │  │   User      │  │
│  │   Middleware    │  │  Management     │  │   Service   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   PostgreSQL    │  │     Redis       │                  │
│  │   (Persistent)  │  │   (Session)     │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Core Architectural Components

1. **HTTP Server Layer** - REST API endpoints for CRUD operations
2. **WebSocket Layer** - Real-time bidirectional communication
3. **Game Engine** - Poker game logic and rule enforcement
4. **Service Layer** - Business logic and state management
5. **Data Layer** - Persistent storage and caching
6. **Authentication Layer** - JWT-based security

## Technology Stack

### Runtime & Framework
- **Node.js** (v18+) - JavaScript runtime
- **TypeScript** (v5.8.3) - Type-safe JavaScript
- **Express.js** (v4.21.2) - HTTP server framework
- **Socket.IO** (v4.8.1) - Real-time communication

**Rationale**: Node.js provides excellent performance for I/O-intensive applications like multiplayer games. TypeScript ensures type safety and better development experience. Express.js offers a mature, lightweight framework for REST APIs.

### Database & Storage
- **PostgreSQL** - Primary relational database
- **Prisma** (v6.9.0) - Type-safe ORM and database toolkit
- **Redis** (v5.5.6) - In-memory cache and session store

**Rationale**: PostgreSQL provides ACID compliance for critical game data. Prisma offers type-safe database operations with excellent TypeScript integration. Redis enables fast session management and temporary game state storage.

### Authentication & Security
- **JWT** (jsonwebtoken v9.0.2) - Stateless authentication
- **bcrypt** (v6.0.0) - Password hashing
- **CORS** (v2.8.5) - Cross-origin resource sharing

### Development & Testing
- **Jest** (v29.7.0) - Testing framework
- **ts-jest** (v29.4.0) - TypeScript support for Jest
- **SuperTest** (v7.1.1) - HTTP assertion library
- **ESLint** - Code linting
- **Prettier** - Code formatting

### DevOps & Deployment
- **Docker** - Containerization
- **nodemon** - Development server
- **ts-node** - TypeScript execution

## Component Design

### 1. HTTP Server Component (`src/index.ts`)

**Responsibilities**:
- Application bootstrapping and configuration
- HTTP server initialization
- Middleware setup and routing
- Database connection management
- Health check endpoints

**Key Features**:
- Graceful server startup with database connectivity validation
- Comprehensive health check with multi-database status
- Development-friendly test endpoints
- Error handling and graceful shutdown

### 2. Authentication Middleware (`src/middleware/auth.ts`)

**Responsibilities**:
- JWT token validation
- User session management
- Route protection
- Token generation and refresh

**Implementation Details**:
- Stateless JWT authentication with 24-hour expiration
- Database validation for each request (ensures user still exists)
- Secure token generation with configurable secrets
- Express middleware pattern for easy integration

### 3. API Routes

#### Auth Routes (`src/routes/auth.ts`)
- User registration with password hashing
- User login with credential validation
- JWT token generation
- Input validation and error handling

#### Room Routes (`src/routes/room.ts`)
- Room creation with configurable parameters
- Room listing with pagination
- Room joining with password validation
- Room management (delete, update)
- Real-time state synchronization with Redis

#### User Routes (`src/routes/user.ts`)
- User profile management
- Game statistics and history
- User preferences

#### Admin Routes (`src/routes/admin.ts`)
- Administrative functions
- System monitoring endpoints
- Game management tools

### 4. Real-time Communication Layer

#### Socket Server (`src/socket/socketServer.ts`)

**Architecture**:
- JWT-based socket authentication
- Connection lifecycle management
- Event handler registration
- Error handling and reconnection logic

**Key Features**:
- Authenticated socket connections
- Automatic user validation
- Graceful disconnect handling
- Room-based message broadcasting

#### Socket Handlers

**Room Handlers** (`src/socket/handlers/roomHandlers.ts`):
- Room join/leave operations
- Player state synchronization
- Room status broadcasting
- Conflict resolution for multi-room scenarios

**Game Handlers** (`src/socket/handlers/gameHandlers.ts`):
- Game action processing
- Turn management
- Game state synchronization
- Timer and timeout handling

**System Handlers** (`src/socket/handlers/systemHandlers.ts`):
- Connection management
- Ping/pong heartbeat
- Reconnection handling
- Global user state management

### 5. Game Engine Components

#### Game State Manager (`src/game/GameState.ts`)

**Core Features**:
- Complete poker game state management
- Turn-based action processing
- Game phase transitions (pre-flop, flop, turn, river, showdown)
- Player status tracking (active, folded, all-in)
- Betting round management
- Timeout handling

**Key Classes**:
- `GameState` - Main game state controller
- `GamePlayer` - Player state representation
- `GameAction` - Action history tracking
- `GameResult` - Game outcome calculation

#### Supporting Game Components

**Card System** (`src/game/Card.ts`, `src/game/Deck.ts`):
- Card representation and manipulation
- Deck shuffling and dealing
- Card comparison utilities

**Hand Evaluation** (`src/game/HandRank.ts`):
- Poker hand ranking system
- Hand comparison algorithms
- Winner determination logic

**Position Management** (`src/game/PositionManager.ts`):
- Dealer, small blind, big blind tracking
- Betting order calculation
- Position rotation between hands

**Pot Management** (`src/game/PotManager.ts`):
- Main pot and side pot calculations
- Bet collection and distribution
- All-in scenario handling
- Winner payout calculation

### 6. Service Layer

#### User State Service (`src/services/userStateService.ts`)

**Responsibilities**:
- Global user state management
- Room conflict prevention
- User session tracking
- Cross-room state synchronization

**Implementation**:
- Singleton pattern for global state management
- Redis-based persistent storage
- Conflict resolution algorithms
- Automatic cleanup mechanisms

## Data Architecture

### Database Schema Design

#### User Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(255),
    chips INTEGER DEFAULT 5000,
    games_played INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Room Table
```sql
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_limit INTEGER DEFAULT 6,
    password VARCHAR(255),
    status room_status DEFAULT 'WAITING',
    big_blind INTEGER DEFAULT 20,
    small_blind INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Game Records Table
```sql
CREATE TABLE game_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chips_before INTEGER NOT NULL,
    chips_after INTEGER NOT NULL,
    chips_change INTEGER NOT NULL,
    hand_result VARCHAR(255),
    is_winner BOOLEAN DEFAULT FALSE,
    game_data JSONB, -- Complete game state snapshot
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Redis Data Structures

#### Room State Storage
```typescript
// Key: room:{roomId}
interface RoomState {
  id: string;
  ownerId: string;
  players: RoomPlayer[];
  status: 'WAITING' | 'PLAYING' | 'ENDED';
  maxPlayers: number;
  currentPlayerCount: number;
  gameState?: GameState;
  // ... other properties
}
```

#### User Session Storage
```typescript
// Key: user_room:{userId}
// Value: roomId (string)
// TTL: 3600 seconds (1 hour)
```

### Data Flow Patterns

1. **Read-Heavy Operations**: Room listings, user profiles
   - Direct PostgreSQL queries with Prisma
   - Optional Redis caching for frequently accessed data

2. **Write-Heavy Operations**: Game actions, real-time updates
   - Immediate Redis updates for real-time state
   - Periodic PostgreSQL synchronization for persistence

3. **Hybrid Operations**: Room joining, game results
   - Immediate Redis updates for real-time features
   - Transactional PostgreSQL writes for consistency

## API Design

### REST API Endpoints

#### Authentication APIs
```
POST /api/auth/register
POST /api/auth/login
```

#### Room APIs
```
POST /api/room/create
GET  /api/room/list
POST /api/room/join
DELETE /api/room/:id
```

#### User APIs
```
GET  /api/user/profile
PUT  /api/user/profile
GET  /api/user/stats
GET  /api/user/history
```

#### System APIs
```
GET  /api/health
GET  /api/test/prisma
```

### API Response Format

```typescript
// Success Response
interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

// Error Response
interface ApiError {
  success: false;
  error: string;
  message: string;
  code?: string;
}
```

## Real-time Communication

### Socket.IO Event Architecture

#### Client-to-Server Events
```typescript
interface ClientToServerEvents {
  'room:join': (data: { roomId: string; password?: string }) => void;
  'room:leave': (data: { roomId: string }) => void;
  'game:action': (data: { roomId: string; action: PlayerAction }) => void;
  'game:ready': (data: { roomId: string }) => void;
  // ... other events
}
```

#### Server-to-Client Events
```typescript
interface ServerToClientEvents {
  'room:joined': (data: { roomId: string; players: RoomPlayer[] }) => void;
  'room:state_update': (data: { roomState: RoomState }) => void;
  'game:started': (data: { gameState: GameState }) => void;
  'game:action_required': (data: { playerId: string; timeout: number }) => void;
  // ... other events
}
```

### Real-time State Synchronization

1. **Room State Updates**
   - Broadcast to all room members on player join/leave
   - Throttled updates during rapid state changes
   - Conflict resolution for simultaneous operations

2. **Game State Updates**
   - Action-based state updates
   - Phase transition notifications
   - Timer synchronization across clients

3. **Connection Management**
   - Automatic reconnection handling
   - State recovery on reconnection
   - Graceful degradation for network issues

## Game Engine Design

### State Machine Architecture

```
[WAITING] → [PRE_FLOP] → [FLOP] → [TURN] → [RIVER] → [SHOWDOWN] → [FINISHED]
    ↑                                                                  ↓
    └──────────────────── New Hand Start ←────────────────────────────┘
```

### Game Engine Core Classes

#### GameState Class
- **State Management**: Complete game state tracking
- **Action Validation**: Ensures only valid actions are processed
- **Phase Management**: Automatic progression through game phases
- **Timer Management**: Action timeouts and automatic folding

#### Position Management
- **Dealer Position**: Rotates after each hand
- **Blind Positions**: Small blind and big blind calculation
- **Betting Order**: Pre-flop and post-flop betting sequences

#### Pot Management
- **Main Pot**: Primary betting pool
- **Side Pots**: Handling all-in scenarios
- **Distribution**: Winner calculation and chip distribution

### Game Rules Implementation

1. **Texas Hold'em Rules**
   - 2 hole cards per player
   - 5 community cards (3 flop, 1 turn, 1 river)
   - Standard betting rounds and actions

2. **Betting Actions**
   - Fold, Check, Call, Raise, All-in
   - Minimum bet validation
   - Pot-limit and no-limit support

3. **Hand Evaluation**
   - Standard poker hand rankings
   - Tie-breaking mechanisms
   - Kicker card handling

## State Management

### Multi-layer State Architecture

1. **Application State** (In-Memory)
   - Active game sessions
   - Connected user sessions
   - Temporary UI state

2. **Session State** (Redis)
   - Room states and player positions
   - Game progress and current actions
   - User-room associations
   - TTL-based automatic cleanup

3. **Persistent State** (PostgreSQL)
   - User accounts and profiles
   - Room configurations
   - Game history and statistics
   - Audit trails

### State Synchronization Strategies

1. **Optimistic Updates**
   - Immediate UI updates
   - Background state synchronization
   - Rollback mechanisms for conflicts

2. **Event Sourcing**
   - Complete action history tracking
   - State reconstruction capabilities
   - Audit and replay functionality

3. **Conflict Resolution**
   - Last-writer-wins for most operations
   - Merge strategies for complex conflicts
   - Manual resolution for critical conflicts

## Security Architecture

### Authentication & Authorization

1. **JWT Authentication**
   - Stateless token-based authentication
   - 24-hour token expiration
   - Secure token generation with strong secrets
   - Token refresh mechanisms

2. **Password Security**
   - bcrypt hashing with salt rounds
   - Strong password requirements
   - Secure password reset flows

3. **API Security**
   - Route-level authentication middleware
   - Input validation and sanitization
   - Rate limiting and DDoS protection
   - CORS configuration

### WebSocket Security

1. **Connection Authentication**
   - JWT token validation on connection
   - User identity verification
   - Automatic disconnection for invalid tokens

2. **Event Authorization**
   - User permission validation per event
   - Room membership verification
   - Action authorization based on game state

### Data Security

1. **Database Security**
   - Connection encryption
   - Query parameterization (SQL injection prevention)
   - Sensitive data encryption
   - Access control and user permissions

2. **Redis Security**
   - Authentication and ACL
   - Connection encryption
   - Data expiration policies
   - Memory usage monitoring

## Performance & Scalability

### Performance Optimizations

1. **Database Performance**
   - Indexed queries for common operations
   - Connection pooling
   - Query optimization with Prisma
   - Read replicas for scaling reads

2. **Caching Strategy**
   - Redis caching for frequently accessed data
   - Application-level caching
   - CDN for static assets
   - Browser caching headers

3. **Real-time Performance**
   - Efficient event handling
   - Message batching for high-frequency updates
   - Connection pooling
   - Compression for large payloads

### Scalability Design

1. **Horizontal Scaling**
   - Stateless application design
   - Load balancer compatibility
   - Session affinity handling
   - Database sharding preparation

2. **Vertical Scaling**
   - Efficient memory usage
   - CPU optimization
   - Connection limits management
   - Resource monitoring

3. **Microservices Preparation**
   - Modular component design
   - Service boundary definition
   - Inter-service communication patterns
   - Data consistency strategies

### Performance Metrics

1. **Response Time Targets**
   - API responses: < 200ms
   - WebSocket events: < 50ms
   - Database queries: < 100ms
   - Game action processing: < 100ms

2. **Throughput Targets**
   - Concurrent connections: 1000+
   - Simultaneous games: 100+
   - API requests/second: 1000+
   - WebSocket events/second: 5000+

## Testing Strategy

### Test Architecture

1. **Unit Tests** (Individual components)
   - Game engine logic
   - Utility functions
   - Service layer methods
   - Database models

2. **Integration Tests** (Component interactions)
   - API endpoint testing
   - Database operations
   - Redis operations
   - Socket.IO events

3. **End-to-End Tests** (Complete user flows)
   - User registration and login
   - Room creation and joining
   - Complete game flows
   - Error scenarios

### Test Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/__tests__/shared/setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};
```

### Test Utilities

1. **Mock Factories** (`__tests__/shared/mockFactory.ts`)
   - User creation mocks
   - Room state mocks
   - Game state mocks
   - Socket connection mocks

2. **Test Data Generators** (`__tests__/shared/testDataGenerator.ts`)
   - Realistic test data generation
   - Edge case data scenarios
   - Performance test data

3. **Socket Test Utils** (`__tests__/shared/socketTestUtils.ts`)
   - Socket connection helpers
   - Event assertion utilities
   - Async event testing

### Coverage Targets

- **Overall Coverage**: 85%+
- **Critical Path Coverage**: 95%+
- **Game Logic Coverage**: 98%+
- **API Coverage**: 90%+

## Deployment Architecture

### Development Environment

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

### Production Environment

```dockerfile
# Dockerfile.prod
FROM node:18-alpine AS builder
# Multi-stage build for optimized production image
# ... build steps ...

FROM node:18-alpine AS production
# ... production setup ...
```

### Environment Configuration

```env
# Core Configuration
NODE_ENV=production
PORT=3001
JWT_SECRET=your-secure-secret

# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/texas_poker
REDIS_URL=redis://localhost:6379

# Application Configuration
FRONTEND_URL=https://your-frontend-domain.com
```

### Container Orchestration

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: texas_poker
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

## Monitoring & Observability

### Logging Strategy

1. **Structured Logging**
   - JSON format for log aggregation
   - Correlation IDs for request tracking
   - Different log levels (error, warn, info, debug)
   - Sensitive data redaction

2. **Log Categories**
   - Application logs (errors, warnings)
   - Access logs (HTTP requests)
   - Game logs (actions, state changes)
   - Performance logs (slow queries, high latency)

### Metrics Collection

1. **Application Metrics**
   - Request rate and response time
   - Error rates and types
   - Active user count
   - Game session metrics

2. **System Metrics**
   - CPU and memory usage
   - Database connection pool
   - Redis memory usage
   - Network I/O

3. **Business Metrics**
   - User registration rate
   - Game completion rate
   - Average session duration
   - Revenue metrics (if applicable)

### Health Checks

```typescript
// Health check endpoint implementation
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    databases: {
      postgres: await checkPostgres(),
      redis: await checkRedis(),
      prisma: await checkPrisma()
    },
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  };
  
  res.json(health);
});
```

### Error Handling

1. **Global Error Handlers**
   - Uncaught exception handling
   - Promise rejection handling
   - Express error middleware
   - Socket.IO error handling

2. **Error Response Format**
   - Consistent error response structure
   - Error codes and categories
   - Client-friendly error messages
   - Internal error logging

3. **Circuit Breaker Pattern**
   - Database connection failures
   - External service failures
   - Automatic recovery mechanisms
   - Graceful degradation

---

## Implementation Status

### Completed Components
- ✅ Core HTTP server and routing
- ✅ JWT authentication system
- ✅ Database schema and Prisma integration
- ✅ Redis integration for session management
- ✅ Socket.IO real-time communication
- ✅ Complete poker game engine
- ✅ Room management system
- ✅ User state management service
- ✅ Comprehensive test suite
- ✅ Docker containerization

### Architecture Highlights

1. **Type Safety**: Full TypeScript implementation with strict types
2. **Real-time First**: Optimized for low-latency multiplayer gaming
3. **Scalable Design**: Prepared for horizontal scaling
4. **Test Coverage**: Comprehensive test suite with 85%+ coverage
5. **Security**: JWT authentication with bcrypt password hashing
6. **Performance**: Redis caching and optimized database queries

### Technology Rationale

The technology choices are well-suited for a real-time multiplayer poker application:

- **Node.js + TypeScript**: Excellent for I/O-intensive real-time applications
- **Socket.IO**: Battle-tested WebSocket library with fallback support
- **PostgreSQL + Redis**: Optimal combination for persistent and session data
- **Prisma**: Type-safe database operations with excellent TypeScript integration
- **Jest**: Comprehensive testing framework with great TypeScript support

This architecture provides a solid foundation for a production-ready Texas Poker backend with room for future enhancements and scaling.