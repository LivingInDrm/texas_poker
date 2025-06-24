# Detailed Upgrade Plan

## Backend Implementation

### 1. Create Room Cleanup Service (`backend/src/services/roomCleanupService.ts`)

**Purpose**: Manage automatic room destruction after 30 seconds of no online users

**Key Features**:
- Timer-based monitoring for each room
- Track room activity timestamps
- Automatic cleanup of Redis and database records
- Integration with existing socket events

**Implementation Details**:
```typescript
class RoomCleanupService {
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  private CLEANUP_DELAY_MS = 30000; // 30 seconds
  
  // Methods:
  - scheduleRoomCleanup(roomId: string)
  - cancelRoomCleanup(roomId: string) 
  - performRoomCleanup(roomId: string)
  - getRoomOnlineUserCount(roomId: string)
  - cleanupExistingEmptyRooms()
}
```

### 2. Create Room Scanner Service (`backend/src/services/roomScannerService.ts`)

**Purpose**: One-time scan and cleanup of existing empty rooms in the system

**Key Features**:
- Scan all existing rooms in Redis and database
- Identify rooms with no online users
- Immediate cleanup of empty rooms
- Report cleanup statistics

### 3. Update Socket Connection Tracking

**Files to Modify**:

#### 3.1 `backend/src/socket/socketServer.ts`
- **Line 89-100**: Modify `handlePlayerDisconnect` function
- **Add**: Call to room cleanup service when user disconnects
- **Add**: Cancel cleanup timer when user reconnects

#### 3.2 `backend/src/socket/handlers/roomHandlers.ts`
- **Line 172-210**: Modify `ROOM_JOIN` handler
- **Add**: Cancel room cleanup when user joins
- **Line 243-309**: Modify `ROOM_LEAVE` handler  
- **Add**: Schedule room cleanup when user leaves and room becomes empty

#### 3.3 `backend/src/types/socket.ts`
- **Add**: New socket events for room cleanup notifications
- **Add**: Room cleanup event interfaces

### 4. Integration Points

#### 4.1 Server Startup (`backend/src/index.ts`)
- Initialize and start room cleanup service
- Run initial scan for existing empty rooms

#### 4.2 Error Handling
- Graceful handling of Redis failures
- Cleanup timer persistence across service restarts
- Conflict resolution for rapid join/leave scenarios

### 5. Database Impact

**No new database schema changes needed**
- Leverage existing `Room` table
- Use existing Redis room state structure
- Clean up database records when rooms are destroyed

## Frontend Integration

### 1. Socket Service Updates (`frontend/src/services/socketService.ts`)

**Add Event Listeners**:
- `room:destroyed` - Handle room destruction notifications
- `room:cleanup_warning` - Optional warning before destruction

### 2. Room Store Updates (`frontend/src/stores/roomStore.ts`)

**Add Methods**:
- Handle room removal from room list
- Update current room state when room is destroyed
- Navigate user away from destroyed rooms

### 3. User Experience

**Room Destruction Handling**:
- Show notification when user's current room is destroyed
- Redirect to lobby page
- Update room listings in real-time

## Testing Strategy

### 1. Unit Tests

**New Test Files**:
- `backend/__tests__/services/roomCleanupService.test.ts`
- `backend/__tests__/services/roomScannerService.test.ts`

**Test Scenarios**:
- Room cleanup timer functionality
- User connection/disconnection tracking
- Edge cases (rapid join/leave, reconnections)
- Redis failure scenarios
- Concurrent access to rooms

### 2. Integration Tests

**Test File**: `backend/__tests__/integration/roomCleanup.test.ts`

**Test Scenarios**:
- Full room lifecycle with cleanup
- Multiple rooms with different user patterns
- Socket event integration
- Database consistency after cleanup

### 3. Frontend Tests

**Test Files**:
- `frontend/__tests__/services/socketService.roomCleanup.test.ts`
- `frontend/__tests__/stores/roomStore.cleanup.test.ts`

## Implementation Order

### Phase 1: Core Service Implementation
1. Create `roomCleanupService.ts`
2. Create `roomScannerService.ts` 
3. Add unit tests for services

### Phase 2: Socket Integration
1. Update socket event handlers
2. Modify room join/leave logic
3. Add socket event types

### Phase 3: Frontend Integration  
1. Update socket service
2. Modify room store
3. Add UI notifications

### Phase 4: Testing & Validation
1. Integration testing
2. Performance testing
3. Edge case validation

## Key Considerations

### 1. Race Conditions
- Handle rapid user join/leave within 30s window
- Ensure cleanup timers are properly cancelled
- Atomic operations for room state updates

### 2. Performance Impact
- Minimal overhead from timer management
- Efficient Redis operations
- Cleanup timer memory management

### 3. Error Recovery
- Service restart resilience
- Redis connection failures
- Inconsistent state detection and recovery

### 4. Monitoring
- Log room cleanup events
- Track cleanup statistics
- Monitor timer memory usage

## Configuration

**Environment Variables**:
- `ROOM_CLEANUP_DELAY_MS`: Configurable cleanup delay (default: 30000)
- `ENABLE_ROOM_CLEANUP`: Feature flag to enable/disable cleanup

**Constants**:
- Default cleanup delay: 30 seconds
- Cleanup service polling interval: 60 seconds
- Maximum concurrent cleanup operations: 10