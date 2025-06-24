# Overall Upgrade Plan

## Goal
Implement automatic room destruction functionality where rooms are automatically destroyed after 30 seconds of having no online users. This includes handling both new rooms going forward and cleaning up existing empty rooms in the system.

## Affected Modules

### Backend
- `backend/src/services/` - New room cleanup service
- `backend/src/socket/socketServer.ts` - Connection/disconnection tracking
- `backend/src/socket/handlers/roomHandlers.ts` - Room state management
- `backend/src/types/socket.ts` - Type definitions for cleanup events
- `backend/src/game/GameState.ts` - Room state updates
- Database models (if needed for tracking room activity)

### Frontend
- No direct frontend changes needed, but may need to handle room destruction notifications
- `frontend/src/services/socketService.ts` - Handle room cleanup events
- `frontend/src/stores/roomStore.ts` - Update room state when rooms are destroyed

## High-Level Actions

### Backend Implementation
1. **Create Room Cleanup Service**
   - Implement timer-based room monitoring
   - Track user connection/disconnection events per room
   - Automatically destroy rooms after 30s of no online users
   - Handle cleanup of associated game state and resources

2. **Update Socket Connection Tracking**
   - Track which users are connected to which rooms
   - Update room user counts on connect/disconnect events
   - Trigger cleanup checks when users leave rooms

3. **Integrate Cleanup Service**
   - Start cleanup service when server starts
   - Hook into existing room join/leave logic
   - Add proper error handling and logging

4. **Database Cleanup (if needed)**
   - Remove room records from database
   - Clean up associated game history/state

### Frontend Integration
1. **Handle Room Destruction Events**
   - Listen for room cleanup notifications
   - Update room store to remove destroyed rooms
   - Redirect users if they're in a destroyed room
   - Show appropriate notifications to users

### Testing
1. **Unit Tests**
   - Test room cleanup logic
   - Test timer functionality
   - Test edge cases (rapid join/leave, reconnections)

2. **Integration Tests**
   - Test full room lifecycle with cleanup
   - Test multiple rooms with different user patterns
   - Test cleanup of existing empty rooms

## Key Considerations
- Handle edge cases like reconnections within the 30s window
- Ensure proper cleanup of Redis/database state
- Graceful handling of users who might rejoin destroyed rooms
- Performance impact of polling/monitoring multiple rooms
- Race conditions between user connections and cleanup timers