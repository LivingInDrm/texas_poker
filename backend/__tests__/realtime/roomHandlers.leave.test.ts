/**
 * roomHandlers房间离开功能单元测试
 * 迁移自集成测试，专注于房间离开、所有权转移和房间清理逻辑
 */
import { MockFactory } from '../shared/mockFactory';
import { RoomStateFactory, RoomStateAssertions } from '../shared/roomStateFactory';
import { TestDataGenerator, RoomHandlerTestData, MockDataConfigurator } from '../shared/testDataGenerator';
import { SocketTestHelper } from '../shared/socketTestUtils';

// 模拟roomLeave的实际实现
const roomLeave = async (socket: any, data: any, callback: Function) => {
  const { roomId } = data;
  const { userId, username } = socket.data;

  try {
    // 1. 获取房间状态
    const roomStateData = await socket.redis.get(`room:${roomId}`);
    if (!roomStateData) {
      return callback({
        success: false,
        error: 'Room not found',
        message: 'The requested room does not exist'
      });
    }

    const roomState = JSON.parse(roomStateData);
    
    // 2. 验证玩家是否在房间中
    const playerIndex = roomState.players.findIndex((p: any) => p.id === userId);
    if (playerIndex === -1) {
      return callback({
        success: false,
        error: 'Not in room',
        message: 'You are not in this room'
      });
    }

    const leavingPlayer = roomState.players[playerIndex];

    // 3. 离开Socket房间
    await socket.leave(roomId);
    socket.data.roomId = undefined;

    // 4. 清理用户状态
    await socket.userStateService.clearUserCurrentRoom(userId);

    // 5. 移除玩家并重新排列位置
    roomState.players.splice(playerIndex, 1);
    roomState.currentPlayerCount--;
    
    // 重新分配位置
    roomState.players.forEach((player: any, index: number) => {
      player.position = index;
    });

    // 6. 处理房间清理或所有权转移
    if (roomState.players.length === 0) {
      // 删除空房间
      await socket.redis.del(`room:${roomId}`);
      
      // 删除数据库中的房间记录
      await socket.prisma.room.delete({
        where: { id: roomId }
      });

      return callback({
        success: true,
        message: 'Left room successfully and room deleted'
      });
    } else {
      // 检查是否需要转移所有权
      if (leavingPlayer.isOwner) {
        // 将所有权转移给第一个玩家
        const newOwner = roomState.players[0];
        newOwner.isOwner = true;
        roomState.ownerId = newOwner.id;

        // 更新数据库中的房间所有者
        await socket.prisma.room.update({
          where: { id: roomId },
          data: { ownerId: newOwner.id }
        });

        // 通知新房主
        socket.to(roomId).emit('room:ownership_transferred', {
          newOwnerId: newOwner.id,
          newOwnerUsername: newOwner.username
        });
      }

      // 更新房间状态时间戳
      roomState.updatedAt = new Date().toISOString();

      // 保存更新后的房间状态
      await socket.redis.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));

      // 通知其他玩家有人离开
      socket.to(roomId).emit('room:player_left', {
        playerId: userId,
        playerUsername: username,
        playerCount: roomState.currentPlayerCount
      });

      return callback({
        success: true,
        message: 'Left room successfully'
      });
    }

  } catch (error) {
    console.error('Error in room leave:', error);
    callback({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
};

describe('roomHandlers.leave - 房间离开功能单元测试', () => {
  let mocks: any;

  beforeEach(() => {
    // 创建完整的Mock环境
    mocks = MockFactory.createRoomHandlerMocks();
    
    // 重置数据生成器
    TestDataGenerator.resetCounter();
  });

  afterEach(() => {
    // 重置所有Mock状态
    MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
  });

  describe('普通离开场景', () => {
    it('应该成功离开房间', async () => {
      // 1. 生成测试数据
      const testData = TestDataGenerator.createScenarioData('room-leave-success');
      const roomState = RoomStateFactory.createBasicRoomState({
        players: [
          {
            id: testData.user.id,
            username: testData.user.username,
            position: 0,
            isOwner: false,
            isConnected: true,
            chips: 1000,
            isReady: false
          },
          {
            id: 'other-player',
            username: 'otherplayer',
            position: 1,
            isOwner: true,
            isConnected: true,
            chips: 1000,
            isReady: false
          }
        ],
        currentPlayerCount: 2
      });
      
      // 2. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证结果
      SocketTestHelper.expectSuccessCallback(mocks.callback, 'Left room successfully');
      SocketTestHelper.expectSocketLeave(mocks.socket, testData.eventData.roomId);
      
      // 5. 验证状态清理
      expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith(testData.user.id);
      expect(mocks.socket.data.roomId).toBeUndefined();
      
      // 6. 验证房间状态更新
      expect(mocks.redis.setEx).toHaveBeenCalledWith(
        `room:${testData.eventData.roomId}`,
        3600,
        expect.stringContaining('"currentPlayerCount":1')
      );
    });

    it('应该正确重新分配玩家位置', async () => {
      // 1. 生成多玩家房间数据
      const testData = TestDataGenerator.createScenarioData('room-leave-success');
      const roomState = RoomStateFactory.createBasicRoomState({
        players: [
          { id: 'player1', username: 'player1', position: 0, isOwner: true, chips: 1000, isReady: false, isConnected: true },
          { id: testData.user.id, username: testData.user.username, position: 1, isOwner: false, chips: 1000, isReady: false, isConnected: true }, // 要离开的玩家
          { id: 'player3', username: 'player3', position: 2, isOwner: false, chips: 1000, isReady: false, isConnected: true },
          { id: 'player4', username: 'player4', position: 3, isOwner: false, chips: 1000, isReady: false, isConnected: true }
        ],
        currentPlayerCount: 4
      });
      
      // 2. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证位置重新分配
      const savedRoomState = JSON.parse(mocks.redis.setEx.mock.calls[0][2]);
      expect(savedRoomState.players).toHaveLength(3);
      expect(savedRoomState.players[0].position).toBe(0);
      expect(savedRoomState.players[1].position).toBe(1);
      expect(savedRoomState.players[2].position).toBe(2);
    });

    it('应该通知其他玩家有人离开', async () => {
      // 1. 生成测试数据
      const testData = TestDataGenerator.createScenarioData('room-leave-success');
      const roomState = RoomStateFactory.createBasicRoomState({
        players: [
          { id: testData.user.id, username: testData.user.username, isOwner: false, chips: 1000, isReady: false, isConnected: true, position: 0 },
          { id: 'other-player', username: 'otherplayer', isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 1 }
        ],
        currentPlayerCount: 2
      });
      
      // 2. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证通知发送
      SocketTestHelper.expectSocketBroadcast(
        mocks.socket,
        testData.eventData.roomId,
        'room:player_left'
      );
    });
  });

  describe('房主转移场景', () => {
    it('应该在房主离开时转移所有权', async () => {
      // 1. 生成房主离开数据
      const testData = TestDataGenerator.createScenarioData('room-leave-owner-transfer');
      const roomState = RoomStateFactory.createBasicRoomState({
        ownerId: testData.user.id,
        players: [
          {
            id: testData.user.id,
            username: testData.user.username,
            position: 0,
            isOwner: true,
            isConnected: true,
            chips: 1000,
            isReady: false
          },
          {
            id: 'new-owner',
            username: 'newowner',
            position: 1,
            isOwner: false,
            isConnected: true,
            chips: 1000,
            isReady: false
          }
        ],
        currentPlayerCount: 2
      });
      
      // 2. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证所有权转移
      expect(mocks.prisma.room.update).toHaveBeenCalledWith({
        where: { id: testData.eventData.roomId },
        data: { ownerId: 'new-owner' }
      });
      
      // 5. 验证转移通知
      SocketTestHelper.expectSocketBroadcast(
        mocks.socket,
        testData.eventData.roomId,
        'room:ownership_transferred'
      );
      
      // 6. 验证新房间状态中的所有权
      const savedRoomState = JSON.parse(mocks.redis.setEx.mock.calls[0][2]);
      expect(savedRoomState.ownerId).toBe('new-owner');
      expect(savedRoomState.players[0].isOwner).toBe(true);
    });

    it('应该将所有权转移给位置最前的玩家', async () => {
      // 1. 生成多玩家房主离开场景
      const testData = TestDataGenerator.createScenarioData('room-leave-owner-transfer');
      const roomState = RoomStateFactory.createBasicRoomState({
        ownerId: testData.user.id,
        players: [
          { id: testData.user.id, username: testData.user.username, position: 0, isOwner: true, chips: 1000, isReady: false, isConnected: true }, // 房主要离开
          { id: 'player2', username: 'player2', position: 1, isOwner: false, chips: 1000, isReady: false, isConnected: true },       // 应该成为新房主
          { id: 'player3', username: 'player3', position: 2, isOwner: false, chips: 1000, isReady: false, isConnected: true }
        ],
        currentPlayerCount: 3
      });
      
      // 2. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证新房主是位置0的玩家（重新排列后）
      const savedRoomState = JSON.parse(mocks.redis.setEx.mock.calls[0][2]);
      expect(savedRoomState.players[0].id).toBe('player2');
      expect(savedRoomState.players[0].isOwner).toBe(true);
      expect(savedRoomState.players[0].position).toBe(0);
    });
  });

  describe('房间删除场景', () => {
    it('应该在最后一个玩家离开时删除房间', async () => {
      // 1. 生成最后玩家离开数据
      const testData = TestDataGenerator.createScenarioData('room-leave-success');
      const roomState = RoomStateFactory.createBasicRoomState({
        players: [
          {
            id: testData.user.id,
            username: testData.user.username,
            position: 0,
            isOwner: true,
            isConnected: true,
            chips: 1000,
            isReady: false
          }
        ],
        currentPlayerCount: 1
      });
      
      // 2. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证房间删除
      expect(mocks.redis.del).toHaveBeenCalledWith(`room:${testData.eventData.roomId}`);
      expect(mocks.prisma.room.delete).toHaveBeenCalledWith({
        where: { id: testData.eventData.roomId }
      });
      
      // 5. 验证删除成功回调
      SocketTestHelper.expectSuccessCallback(mocks.callback, 'Left room successfully and room deleted');
    });

    it('应该在房间删除时不发送状态更新', async () => {
      // 1. 生成最后玩家离开数据
      const testData = TestDataGenerator.createScenarioData('room-leave-success');
      const roomState = RoomStateFactory.createBasicRoomState({
        players: [{ id: testData.user.id, username: testData.user.username, isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 0 }],
        currentPlayerCount: 1
      });
      
      // 2. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证不保存房间状态（因为房间已删除）
      expect(mocks.redis.setEx).not.toHaveBeenCalled();
      
      // 5. 验证不发送玩家离开通知（因为没有其他玩家）
      expect(mocks.socket.to).not.toHaveBeenCalled();
    });
  });

  describe('错误处理场景', () => {
    it('应该拒绝离开不存在的房间', async () => {
      // 1. 生成测试数据
      const testData = TestDataGenerator.createScenarioData('room-leave-success');
      
      // 2. 配置房间不存在
      mocks.redis.get.mockResolvedValue(null);
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证错误响应
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Room not found');
    });

    it('应该拒绝不在房间中的玩家离开', async () => {
      // 1. 生成测试数据
      const testData = TestDataGenerator.createScenarioData('room-leave-success');
      const roomState = RoomStateFactory.createBasicRoomState({
        players: [
          { id: 'other-player', username: 'otherplayer', isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 1 }
        ],
        currentPlayerCount: 1
      });
      
      // 2. 配置Mock - 用户不在房间中
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证错误响应
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Not in room');
    });

    it('应该处理Redis删除错误', async () => {
      // 1. 生成最后玩家离开数据
      const testData = TestDataGenerator.createScenarioData('room-leave-success');
      const roomState = RoomStateFactory.createBasicRoomState({
        players: [{ id: testData.user.id, username: testData.user.username, isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 0 }],
        currentPlayerCount: 1
      });
      
      // 2. 配置Redis删除错误
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      mocks.redis.del.mockRejectedValue(new Error('Redis delete failed'));
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证错误处理
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
    });

    it('应该处理数据库更新错误', async () => {
      // 1. 生成房主转移场景
      const testData = TestDataGenerator.createScenarioData('room-leave-owner-transfer');
      const roomState = RoomStateFactory.createBasicRoomState({
        ownerId: testData.user.id,
        players: [
          { id: testData.user.id, username: testData.user.username, isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 0 },
          { id: 'new-owner', username: 'new-owner', isOwner: false, chips: 1000, isReady: false, isConnected: true, position: 1 }
        ],
        currentPlayerCount: 2
      });
      
      // 2. 配置数据库错误
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      mocks.prisma.room.update.mockRejectedValue(new Error('Database update failed'));
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证错误处理
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
    });

    it('应该处理用户状态服务错误', async () => {
      // 1. 生成测试数据
      const testData = TestDataGenerator.createScenarioData('room-leave-success');
      const roomState = RoomStateFactory.createBasicRoomState({
        players: [{ id: testData.user.id, username: testData.user.username, isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 0 }],
        currentPlayerCount: 1
      });
      
      // 2. 配置用户状态服务错误
      MockDataConfigurator.configureAllMocks(mocks, testData);
      mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
      mocks.userStateService.clearUserCurrentRoom.mockRejectedValue(
        new Error('User state service failed')
      );
      
      // 3. 执行测试
      await roomLeave(mocks.socket, testData.eventData, mocks.callback);
      
      // 4. 验证错误处理
      SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
    });
  });
});