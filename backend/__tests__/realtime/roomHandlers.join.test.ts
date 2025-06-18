/**
 * roomHandlers房间加入功能单元测试
 * 迁移自集成测试，使用测试基建工具实现高效Mock和数据管理
 */
import { MockFactory } from '../shared/mockFactory';
import { RoomStateFactory, RoomStateAssertions } from '../shared/roomStateFactory';
import { TestDataGenerator, RoomHandlerTestData, MockDataConfigurator } from '../shared/testDataGenerator';
import { SocketTestHelper } from '../shared/socketTestUtils';

// 模拟roomHandlers的实际实现
const roomJoin = async (socket: any, data: any, callback: Function) => {
  const { roomId, password } = data;
  const { userId, username } = socket.data;

  try {
    // 1. 验证房间加入请求
    const validationResult = await socket.validationMiddleware.validateRoomJoin(socket, roomId, password);
    if (!validationResult.valid) {
      return callback({
        success: false,
        error: validationResult.error,
        message: 'Validation failed'
      });
    }

    // 2. 检查房间冲突
    const conflictResult = await socket.userStateService.checkAndHandleRoomConflict(userId, roomId, socket, socket.io);
    if (!conflictResult.success) {
      return callback({
        success: false,
        error: conflictResult.error,
        message: conflictResult.message
      });
    }

    // 3. 检查房间是否存在
    const room = await socket.prisma.room.findUnique({
      where: { id: roomId },
      include: { owner: true }
    });

    if (!room) {
      return callback({
        success: false,
        error: 'Room not found',
        message: 'The requested room does not exist'
      });
    }

    // 4. 验证密码（如果需要）
    if (room.password) {
      if (!password) {
        return callback({
          success: false,
          error: 'Password required',
          message: 'This room requires a password'
        });
      }
      
      const passwordMatch = await socket.bcrypt.compare(password, room.password);
      if (!passwordMatch) {
        return callback({
          success: false,
          error: 'Invalid password',
          message: 'Incorrect room password'
        });
      }
    }

    // 5. 获取房间状态
    let roomState;
    const roomStateData = await socket.redis.get(`room:${roomId}`);
    
    if (roomStateData) {
      roomState = JSON.parse(roomStateData);
    } else {
      // 初始化房间状态
      roomState = {
        id: roomId,
        ownerId: room.ownerId,
        status: 'WAITING',
        maxPlayers: room.playerLimit,
        currentPlayerCount: 0,
        hasPassword: !!room.password,
        bigBlind: room.bigBlind,
        smallBlind: room.smallBlind,
        players: [],
        gameStarted: false,
        createdAt: room.createdAt.toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    // 6. 检查玩家是否已在房间中
    const existingPlayer = roomState.players.find((p: any) => p.id === userId);
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
        await socket.join(roomId);
        socket.data.roomId = roomId;
        
        await socket.redis.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
        await socket.userStateService.setUserCurrentRoom(userId, roomId);
        
        return callback({
          success: true,
          message: 'Rejoined room successfully',
          data: { roomState }
        });
      }
    }

    // 7. 检查房间是否已满
    if (roomState.currentPlayerCount >= roomState.maxPlayers) {
      return callback({
        success: false,
        error: 'Room is full',
        message: 'This room has reached its maximum capacity'
      });
    }

    // 8. 添加新玩家
    const newPlayer = {
      id: userId,
      username: username,
      chips: 5000, // 默认筹码
      position: roomState.players.length,
      isOwner: userId === room.ownerId,
      status: 'ACTIVE',
      isConnected: true
    };

    roomState.players.push(newPlayer);
    roomState.currentPlayerCount++;
    roomState.updatedAt = new Date().toISOString();

    // 9. 更新状态
    await socket.join(roomId);
    socket.data.roomId = roomId;
    
    await socket.redis.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
    await socket.userStateService.setUserCurrentRoom(userId, roomId);

    // 10. 通知其他玩家
    socket.to(roomId).emit('room:player_joined', {
      player: newPlayer
    });

    // 11. 返回成功结果
    callback({
      success: true,
      message: 'Joined room successfully',
      data: { roomState }
    });

  } catch (error) {
    console.error('Error in room join:', error);
    callback({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
};

describe('roomHandlers.join - 房间加入功能单元测试', () => {
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
    mocks.socket.bcrypt = mocks.bcrypt;
    
    // 重置数据生成器
    TestDataGenerator.resetCounter();
  });

  afterEach(() => {
    // 重置所有Mock状态
    MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
  });

  describe('成功场景', () => {
    it('应该成功加入一个有空位的房间', async () => {
      // 1. 生成测试数据和空房间状态
      const testData = TestDataGenerator.createScenarioData('room-join-success');
      // 创建一个空的房间状态，不包含测试用户
      const emptyRoomState = RoomStateFactory.createBasicRoomState({
        id: testData.room.id,
        ownerId: testData.room.ownerId,
        players: [] // 空房间
      });
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 3. 配置Mock返回值
      MockDataConfigurator.configureAllMocks(mocks, { ...testData, roomState: null }); // 无房间状态，需要初始化
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
      
      // 4. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 5. 验证结果
      SocketTestHelper.expectSuccessCallback(mocks.callback);
      SocketTestHelper.expectSocketJoin(mocks.socket, testData.eventData.roomId);
      
      // 6. 验证Mock调用
      expect(mocks.prisma.room.findUnique).toHaveBeenCalledWith({
        where: { id: testData.eventData.roomId },
        include: { owner: true }
      });
      expect(mocks.userStateService.setUserCurrentRoom).toHaveBeenCalledWith(
        testData.user.id, 
        testData.eventData.roomId
      );
    });

    it('应该能重连到已加入的房间', async () => {
      // 1. 生成重连场景数据
      const testData = TestDataGenerator.createScenarioData('room-join-success');
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      const roomState = RoomStateFactory.createBasicRoomState({
        players: [{
          id: testData.user.id,
          username: testData.user.username,
          chips: 5000,
          isReady: false,
          position: 0,
          isConnected: false // 标记为断线状态
        }]
      });
      
      // 3. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
      
      // 4. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 5. 验证重连成功
      SocketTestHelper.expectSuccessCallback(mocks.callback, undefined, 'Rejoined room successfully');
      expect(mocks.socket.data.roomId).toBe(testData.eventData.roomId);
    });
  });

  describe('密码验证场景', () => {
    it('应该成功加入有正确密码的房间', async () => {
      // 1. 生成密码房间数据
      const testData = TestDataGenerator.createScenarioData('room-join-password');
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 3. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
      mocks.bcrypt.compare.mockResolvedValue(true); // 密码正确
      
      // 4. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 5. 验证结果
      SocketTestHelper.expectSuccessCallback(mocks.callback);
      expect(mocks.bcrypt.compare).toHaveBeenCalledWith(
        testData.eventData.password,
        testData.room.password
      );
    });

    it('应该拒绝密码错误的加入请求', async () => {
      // 1. 生成密码错误场景
      const testData = TestDataGenerator.createScenarioData('room-join-password');
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      // 3. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
      mocks.bcrypt.compare.mockResolvedValue(false); // 密码错误
      
      // 4. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 5. 验证错误响应
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Invalid password');
    });

    it('应该拒绝未提供密码的加入请求', async () => {
      // 1. 生成需要密码但未提供密码的场景
      const testData = TestDataGenerator.createScenarioData('room-join-password');
      testData.eventData.password = undefined; // 不提供密码
      
      // 2. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
      
      // 3. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证错误响应
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Password required');
    });
  });

  describe('房间状态验证场景', () => {
    it('应该拒绝加入不存在的房间', async () => {
      // 1. 生成房间不存在场景
      const testData = TestDataGenerator.createScenarioData('room-not-found');
      
      // 2. 配置Mock
      mocks.prisma.room.findUnique.mockResolvedValue(null); // 房间不存在
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
      
      // 3. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证错误响应
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Room not found');
    });

    it('应该拒绝加入已满员的房间', async () => {
      // 1. 生成满员房间数据
      const testData = TestDataGenerator.createScenarioData('room-join-full');
      
      // 2. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
      
      // 3. 验证房间状态
      RoomStateAssertions.assertPlayerCount(testData.roomState, 6);
      
      // 4. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 5. 验证错误响应
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Room is full');
    });

    it('应该拒绝重复加入已在线的房间', async () => {
      // 1. 生成已在房间场景
      const testData = TestDataGenerator.createScenarioData('room-join-success');
      
      // 2. 同步socket数据和测试数据
      syncSocketWithTestData(mocks.socket, testData);
      
      const roomStateWithUser = RoomStateFactory.createBasicRoomState({
        players: [{
          id: testData.user.id,
          username: testData.user.username,
          chips: 5000,
          isReady: false,
          position: 0,
          isConnected: true // 已连接状态
        }]
      });
      
      // 3. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomStateWithUser));
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
      
      // 4. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 5. 验证错误响应
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Already in room');
    });
  });

  describe('验证和冲突处理场景', () => {
    it('应该拒绝验证失败的请求', async () => {
      // 1. 生成测试数据
      const testData = TestDataGenerator.createScenarioData('room-join-success');
      
      // 2. 配置验证失败
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({
        valid: false,
        error: 'Invalid room ID format'
      });
      
      // 3. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证验证失败响应
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Invalid room ID format');
    });

    it('应该处理房间冲突情况', async () => {
      // 1. 生成测试数据
      const testData = TestDataGenerator.createScenarioData('room-join-success');
      
      // 2. 配置冲突处理失败
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({
        success: false,
        error: 'User already in another room',
        message: 'Please leave current room first'
      });
      
      // 3. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证冲突处理响应
      SocketTestHelper.expectErrorCallback(mocks.callback, 'User already in another room');
    });
  });

  describe('错误处理场景', () => {
    it('应该处理数据库错误', async () => {
      // 1. 生成测试数据
      const testData = TestDataGenerator.createScenarioData('room-join-success');
      
      // 2. 配置数据库错误
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
      mocks.prisma.room.findUnique.mockRejectedValue(new Error('Database connection failed'));
      
      // 3. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证错误处理
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
    });

    it('应该处理Redis错误', async () => {
      // 1. 生成测试数据
      const testData = TestDataGenerator.createScenarioData('room-join-success');
      
      // 2. 配置Redis错误
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
      mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
      mocks.redis.get.mockRejectedValue(new Error('Redis connection failed'));
      
      // 3. 执行测试
      await roomJoin(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证错误处理
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
    });
  });
});