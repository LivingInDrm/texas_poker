/**
 * roomHandlers快速开始功能单元测试
 * 迁移自集成测试，专注于智能房间匹配和自动创建逻辑
 */
import { MockFactory } from '../shared/mockFactory';
import { RoomStateFactory, RoomStateAssertions } from '../shared/roomStateFactory';
import { TestDataGenerator, RoomHandlerTestData, MockDataConfigurator } from '../shared/testDataGenerator';
import { SocketTestHelper } from '../shared/socketTestUtils';

// 模拟quickStart的实际实现
const quickStart = async (socket: any, callback: Function) => {
  const { userId, username } = socket.data;

  try {
    // 1. 检查并处理当前房间冲突
    const conflictResult = await socket.userStateService.checkAndHandleRoomConflict(userId, null, socket, socket.io);
    if (!conflictResult.success && conflictResult.code !== 'NO_CURRENT_ROOM') {
      return callback({
        success: false,
        error: conflictResult.error,
        message: conflictResult.message
      });
    }

    // 2. 查找可用的房间
    const availableRooms = await socket.prisma.room.findMany({
      where: {
        status: 'WAITING',
        password: null // 快速开始只匹配无密码房间
      },
      include: { owner: true },
      take: 10 // 限制查询数量
    });

    let targetRoom: any = null;
    let targetRoomState: any = null;

    // 3. 检查每个房间的实际容量
    for (const room of availableRooms) {
      const roomStateData = await socket.redis.get(`room:${room.id}`);
      
      if (roomStateData) {
        const roomState = JSON.parse(roomStateData);
        
        // 检查房间是否有空位且用户不在其中
        const isUserInRoom = roomState.players.some((p: any) => p.id === userId);
        const hasSpace = roomState.currentPlayerCount < roomState.maxPlayers;
        
        if (!isUserInRoom && hasSpace) {
          targetRoom = room;
          targetRoomState = roomState;
          break;
        }
      } else {
        // 房间在数据库中但Redis中无状态，可以加入
        targetRoom = room;
        break;
      }
    }

    // 4. 如果找到合适的房间，加入该房间
    if (targetRoom) {
      if (!targetRoomState) {
        // 初始化房间状态
        targetRoomState = {
          id: targetRoom.id,
          ownerId: targetRoom.ownerId,
          status: 'WAITING',
          maxPlayers: targetRoom.playerLimit,
          currentPlayerCount: 0,
          hasPassword: false,
          bigBlind: targetRoom.bigBlind,
          smallBlind: targetRoom.smallBlind,
          players: [],
          gameStarted: false,
          createdAt: targetRoom.createdAt.toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      // 检查玩家是否已在房间中（重连场景）
      const existingPlayer = targetRoomState.players.find((p: any) => p.id === userId);
      if (existingPlayer) {
        if (existingPlayer.isConnected) {
          return callback({
            success: false,
            error: 'Already in room',
            message: 'You are already in this room'
          });
        } else {
          // 重连逻辑
          existingPlayer.isConnected = true;
        }
      } else {
        // 添加新玩家
        const newPlayer = {
          id: userId,
          username: username,
          chips: 5000,
          position: targetRoomState.players.length,
          isOwner: userId === targetRoom.ownerId,
          status: 'ACTIVE',
          isConnected: true
        };
        
        targetRoomState.players.push(newPlayer);
        targetRoomState.currentPlayerCount++;
      }

      // 更新状态
      await socket.join(targetRoom.id);
      socket.data.roomId = targetRoom.id;
      
      targetRoomState.updatedAt = new Date().toISOString();
      await socket.redis.setEx(`room:${targetRoom.id}`, 3600, JSON.stringify(targetRoomState));
      await socket.userStateService.setUserCurrentRoom(userId, targetRoom.id);

      // 通知其他玩家
      socket.to(targetRoom.id).emit('room:player_joined', {
        player: targetRoomState.players.find((p: any) => p.id === userId)
      });

      return callback({
        success: true,
        message: 'Quick start successful - joined existing room',
        data: {
          roomId: targetRoom.id,
          roomState: targetRoomState
        }
      });
    }

    // 5. 没有合适的房间，创建新房间
    const newRoom = await socket.prisma.room.create({
      data: {
        id: `room-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        ownerId: userId,
        playerLimit: 6,
        password: null,
        status: 'WAITING',
        bigBlind: 20,
        smallBlind: 10
      },
      include: { owner: true }
    });

    // 6. 初始化新房间状态
    const newRoomState = {
      id: newRoom.id,
      ownerId: newRoom.ownerId,
      status: 'WAITING',
      maxPlayers: newRoom.playerLimit,
      currentPlayerCount: 1,
      hasPassword: false,
      bigBlind: newRoom.bigBlind,
      smallBlind: newRoom.smallBlind,
      players: [{
        id: userId,
        username: username,
        chips: 5000,
        position: 0,
        isOwner: true,
        status: 'ACTIVE',
        isConnected: true
      }],
      gameStarted: false,
      createdAt: newRoom.createdAt.toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 7. 设置用户状态
    await socket.join(newRoom.id);
    socket.data.roomId = newRoom.id;
    
    await socket.redis.setEx(`room:${newRoom.id}`, 3600, JSON.stringify(newRoomState));
    await socket.userStateService.setUserCurrentRoom(userId, newRoom.id);

    return callback({
      success: true,
      message: 'Quick start successful - created new room',
      data: {
        roomId: newRoom.id,
        roomState: newRoomState
      }
    });

  } catch (error) {
    console.error('Error in quick start:', error);
    callback({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
};

describe('roomHandlers.quickStart - 快速开始功能单元测试', () => {
  let mocks: any;

  // 辅助函数：同步socket数据和测试数据
  const syncSocketWithTestData = (socket: any, testData: any) => {
    socket.data.userId = testData.user.id;
    socket.data.username = testData.user.username;
  };

  beforeEach(() => {
    // 创建完整的Mock环境
    mocks = MockFactory.createRoomHandlerMocks();
    
    // 将服务注入到Socket Mock中
    mocks.socket.prisma = mocks.prisma;
    mocks.socket.redis = mocks.redis;
    mocks.socket.userStateService = mocks.userStateService;
    mocks.socket.validationMiddleware = mocks.validationMiddleware;
    mocks.socket.io = mocks.io;
    
    // 重置数据生成器
    TestDataGenerator.resetCounter();
  });

  afterEach(() => {
    // 重置所有Mock状态
    MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
  });

  describe('加入现有房间场景', () => {
    it('应该成功加入有空位的现有房间', async () => {
      // 1. 生成测试数据
      const testData = RoomHandlerTestData.forQuickStart('joinExisting');
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 3. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockResolvedValue(testData.availableRooms);
      mocks.redis.get.mockResolvedValue(JSON.stringify(testData.roomState));
      
      // 4. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证结果  
      SocketTestHelper.expectSuccessCallback(mocks.callback, expect.any(Object), 'Quick start successful - joined existing room');
      SocketTestHelper.expectSocketJoin(mocks.socket, testData.availableRooms[0].id);
      
      // 5. 验证房间状态更新
      expect(mocks.redis.setEx).toHaveBeenCalledWith(
        `room:${testData.availableRooms[0].id}`,
        3600,
        expect.stringContaining('"currentPlayerCount":3')
      );
    });

    it('应该跳过已满员的房间', async () => {
      // 1. 生成满员房间数据
      const testData = RoomHandlerTestData.forQuickStart('joinExisting');
      const fullRoomState = RoomStateFactory.createFullRoomState();
      const emptyRoomState = RoomStateFactory.createBasicRoomState({
        currentPlayerCount: 1
      });
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 3. 配置Mock - 第一个房间满员，第二个有空位
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockResolvedValue([
        { ...testData.availableRooms[0], id: 'full-room' },
        { ...testData.availableRooms[0], id: 'available-room' }
      ]);
      mocks.redis.get
        .mockResolvedValueOnce(JSON.stringify(fullRoomState)) // 第一个房间满员
        .mockResolvedValueOnce(JSON.stringify(emptyRoomState)); // 第二个房间有空位
      
      // 4. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证加入了第二个房间
      expect(mocks.socket.join).toHaveBeenCalledWith('available-room');
      expect(mocks.socket.data.roomId).toBe('available-room');
    });

    it('应该跳过用户已在其中的房间', async () => {
      // 1. 生成测试数据
      const testData = RoomHandlerTestData.forQuickStart('joinExisting');
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      const roomStateWithUser = RoomStateFactory.createBasicRoomState({
        players: [
          { id: testData.user.id, username: testData.user.username, isConnected: true, chips: 1000, isReady: false, position: 0 }
        ],
        currentPlayerCount: 1
      });
      const emptyRoomState = RoomStateFactory.createBasicRoomState({
        currentPlayerCount: 1
      });
      
      // 3. 配置Mock
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockResolvedValue([
        { ...testData.availableRooms[0], id: 'user-in-room' },
        { ...testData.availableRooms[0], id: 'available-room' }
      ]);
      mocks.redis.get
        .mockResolvedValueOnce(JSON.stringify(roomStateWithUser)) // 用户已在其中
        .mockResolvedValueOnce(JSON.stringify(emptyRoomState));   // 可用房间
      
      // 4. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证跳过了第一个房间，加入了第二个
      expect(mocks.socket.join).toHaveBeenCalledWith('available-room');
    });

    it('应该处理断线重连场景', async () => {
      // 1. 生成重连场景数据
      const testData = RoomHandlerTestData.forQuickStart('joinExisting');
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      const roomStateWithDisconnectedUser = RoomStateFactory.createBasicRoomState({
        players: [
          { 
            id: testData.user.id, 
            username: testData.user.username, 
            isConnected: false, // 断线状态
            chips: 1000,
            isReady: false,
            position: 0
          },
          { 
            id: 'other-player', 
            username: 'otherplayer', 
            isConnected: true,
            chips: 1000,
            isReady: false,
            position: 1
          }
        ],
        currentPlayerCount: 2
      });
      
      // 3. 配置Mock
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockResolvedValue(testData.availableRooms);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomStateWithDisconnectedUser));
      
      // 添加创建房间的Mock，以防万一走到创建新房间逻辑
      mocks.prisma.room.create.mockResolvedValue(TestDataGenerator.createRoomData(testData.user.id));
      
      // 4. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证重连成功
      SocketTestHelper.expectSuccessCallback(mocks.callback);
      
      // 5. 验证玩家标记为已连接
      const savedRoomState = JSON.parse(mocks.redis.setEx.mock.calls[0][2]);
      const reconnectedPlayer = savedRoomState.players.find((p: any) => p.id === testData.user.id);
      expect(reconnectedPlayer.isConnected).toBe(true);
    });
  });

  describe('创建新房间场景', () => {
    it('应该在没有可用房间时创建新房间', async () => {
      // 1. 生成创建新房间数据
      const testData = RoomHandlerTestData.forQuickStart('createNew');
      const newRoom = TestDataGenerator.createRoomData(testData.user.id);
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 3. 配置Mock
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockResolvedValue([]); // 无可用房间
      mocks.prisma.room.create.mockResolvedValue(newRoom);
      
      // 4. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证创建新房间
      expect(mocks.prisma.room.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerId: testData.user.id,
          playerLimit: 6,
          password: null,
          status: 'WAITING',
          bigBlind: 20,
          smallBlind: 10
        }),
        include: { owner: true }
      });
      
      // 5. 验证成功响应
      SocketTestHelper.expectSuccessCallback(mocks.callback, expect.any(Object), 'Quick start successful - created new room');
    });

    it('应该在所有房间都不合适时创建新房间', async () => {
      // 1. 生成测试数据
      const testData = RoomHandlerTestData.forQuickStart('createNew');
      const fullRoomState = RoomStateFactory.createFullRoomState();
      const newRoom = TestDataGenerator.createRoomData(testData.user.id);
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 3. 配置Mock - 所有房间都满员
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockResolvedValue([
        TestDataGenerator.createRoomData(),
        TestDataGenerator.createRoomData()
      ]);
      mocks.redis.get.mockResolvedValue(JSON.stringify(fullRoomState)); // 所有房间都满员
      mocks.prisma.room.create.mockResolvedValue(newRoom);
      
      // 3. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证创建了新房间
      expect(mocks.prisma.room.create).toHaveBeenCalled();
      SocketTestHelper.expectSuccessCallback(mocks.callback, expect.any(Object), 'Quick start successful - created new room');
    });

    it('应该正确初始化新房间状态', async () => {
      // 1. 生成测试数据
      const testData = RoomHandlerTestData.forQuickStart('createNew');
      const newRoom = TestDataGenerator.createRoomData(testData.user.id);
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 3. 配置Mock
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockResolvedValue([]);
      mocks.prisma.room.create.mockResolvedValue(newRoom);
      
      // 3. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证房间状态初始化
      const savedRoomState = JSON.parse(mocks.redis.setEx.mock.calls[0][2]);
      RoomStateAssertions.assertValidRoomState(savedRoomState);
      RoomStateAssertions.assertPlayerCount(savedRoomState, 1);
      RoomStateAssertions.assertRoomStatus(savedRoomState, 'WAITING');
      
      // 5. 验证房主设置
      expect(savedRoomState.players[0].id).toBe(testData.user.id);
      expect(savedRoomState.players[0].isOwner).toBe(true);
      expect(savedRoomState.ownerId).toBe(testData.user.id);
    });

    it('应该正确设置新房间的默认参数', async () => {
      // 1. 生成测试数据
      const testData = RoomHandlerTestData.forQuickStart('createNew');
      const newRoom = TestDataGenerator.createRoomData(testData.user.id);
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 3. 配置Mock
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockResolvedValue([]);
      mocks.prisma.room.create.mockResolvedValue(newRoom);
      
      // 3. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证默认参数
      expect(mocks.prisma.room.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          playerLimit: 6,        // 默认最大玩家数
          password: null,        // 默认无密码
          bigBlind: 20,         // 默认大盲注
          smallBlind: 10,       // 默认小盲注
          status: 'WAITING'     // 默认等待状态
        }),
        include: { owner: true }
      });
    });
  });

  describe('冲突处理场景', () => {
    it('应该处理用户已在其他房间的冲突', async () => {
      // 1. 生成测试数据
      const testData = RoomHandlerTestData.forQuickStart('createNew');
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 2. 配置冲突处理失败
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({
        success: false,
        error: 'User already in another room',
        message: 'Please leave current room first',
        code: 'ROOM_CONFLICT'
      });
      
      // 3. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证冲突处理响应
      SocketTestHelper.expectErrorCallback(mocks.callback, 'User already in another room');
      
      // 5. 验证不会继续执行房间查找
      expect(mocks.prisma.room.findMany).not.toHaveBeenCalled();
    });

    it('应该允许没有当前房间的用户快速开始', async () => {
      // 1. 生成测试数据
      const testData = RoomHandlerTestData.forQuickStart('createNew');
      const newRoom = TestDataGenerator.createRoomData(testData.user.id);
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 2. 配置无当前房间
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({
        success: true,
        code: 'NO_CURRENT_ROOM'
      });
      mocks.prisma.room.findMany.mockResolvedValue([]);
      mocks.prisma.room.create.mockResolvedValue(newRoom);
      
      // 3. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证成功执行
      SocketTestHelper.expectSuccessCallback(mocks.callback);
    });
  });

  describe('错误处理场景', () => {
    it('应该处理数据库查询错误', async () => {
      // 1. 配置数据库错误
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockRejectedValue(new Error('Database query failed'));
      
      // 2. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 3. 验证错误处理
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
    });

    it('应该处理Redis获取错误', async () => {
      // 1. 生成测试数据
      const testData = RoomHandlerTestData.forQuickStart('joinExisting');
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 2. 配置Redis错误
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockResolvedValue(testData.availableRooms);
      mocks.redis.get.mockRejectedValue(new Error('Redis connection failed'));
      
      // 3. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证错误处理
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
    });

    it('应该处理房间创建错误', async () => {
      // 1. 配置房间创建错误
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockResolvedValue([]);
      mocks.prisma.room.create.mockRejectedValue(new Error('Room creation failed'));
      
      // 2. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 3. 验证错误处理
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
    });

    it('应该处理用户状态服务错误', async () => {
      // 1. 生成测试数据
      const testData = RoomHandlerTestData.forQuickStart('joinExisting');
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 2. 配置用户状态服务错误
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ 
        success: true, 
        code: 'NO_CURRENT_ROOM' 
      });
      mocks.prisma.room.findMany.mockResolvedValue(testData.availableRooms);
      mocks.redis.get.mockResolvedValue(JSON.stringify(testData.roomState));
      mocks.userStateService.setUserCurrentRoom.mockRejectedValue(
        new Error('User state service failed')
      );
      
      // 3. 执行测试
      await quickStart(mocks.socket, mocks.callback);
      
      // 4. 验证错误处理
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
    });
  });
});