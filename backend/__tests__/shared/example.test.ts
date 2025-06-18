/**
 * 测试基建工具使用示例
 * 展示如何使用新搭建的测试工具来创建单元测试
 */
import { MockFactory } from './mockFactory';
import { RoomStateFactory, RoomStateAssertions } from './roomStateFactory';
import { TestDataGenerator, RoomHandlerTestData, MockDataConfigurator } from './testDataGenerator';

describe('测试基建工具使用示例', () => {
  let mocks: any;

  beforeEach(() => {
    // 创建完整的Mock环境
    mocks = MockFactory.createRoomHandlerMocks();
  });

  afterEach(() => {
    // 重置所有Mock状态
    MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
    TestDataGenerator.resetCounter();
  });

  describe('房间加入成功场景示例', () => {
    it('应该成功加入一个有空位的房间', () => {
      // 1. 生成测试数据
      const testData = TestDataGenerator.createScenarioData('room-join-success');
      
      // 2. 配置Mock返回值
      MockDataConfigurator.configureAllMocks(mocks, testData);
      
      // 3. 验证测试数据完整性
      expect(testData.user).toBeDefined();
      expect(testData.room).toBeDefined();
      expect(testData.roomState).toBeDefined();
      expect(testData.eventData).toBeDefined();
      
      // 4. 验证房间状态
      RoomStateAssertions.assertValidRoomState(testData.roomState);
      RoomStateAssertions.assertPlayerCount(testData.roomState, 2);
      
      // 5. 模拟实际测试逻辑（这里只是展示Mock配置）
      expect(mocks.prisma.user.findUnique).toBeDefined();
      expect(mocks.redis.get).toBeDefined();
      expect(mocks.callback).toBeDefined();
    });
  });

  describe('房间满员错误场景示例', () => {
    it('应该正确处理房间满员的情况', () => {
      // 1. 使用专用数据生成器
      const fullRoomData = RoomHandlerTestData.forRoomJoin('full');
      
      // 2. 配置Mock
      MockDataConfigurator.configureAllMocks(mocks, fullRoomData);
      
      // 3. 验证满员房间状态
      expect(fullRoomData.roomState.currentPlayerCount).toBe(6);
      expect(fullRoomData.roomState.maxPlayers).toBe(6);
      
      RoomStateAssertions.assertPlayerCount(fullRoomData.roomState, 6);
    });
  });

  describe('批量数据生成示例', () => {
    it('应该能批量生成用户数据', () => {
      // 批量生成5个用户
      const users = TestDataGenerator.createBulkData(
        TestDataGenerator.createUserData,
        5,
        { chips: 10000 }
      );
      
      expect(users).toHaveLength(5);
      users.forEach((user, index) => {
        expect(user.chips).toBe(10000);
        expect(user.bulkIndex).toBe(index);
        expect(user.id).toBeTruthy();
        expect(user.username).toBeTruthy();
      });
    });
  });

  describe('自定义房间状态示例', () => {
    it('应该能创建自定义房间状态', () => {
      // 创建游戏进行中的房间
      const gameInProgressRoom = RoomStateFactory.createGameInProgressState({
        bigBlind: 50,
        smallBlind: 25
      });
      
      expect(gameInProgressRoom.status).toBe('PLAYING');
      expect(gameInProgressRoom.gameStarted).toBe(true);
      expect(gameInProgressRoom.bigBlind).toBe(50);
      expect(gameInProgressRoom.smallBlind).toBe(25);
      
      RoomStateAssertions.assertValidRoomState(gameInProgressRoom);
      RoomStateAssertions.assertRoomStatus(gameInProgressRoom, 'PLAYING');
    });

    it('应该能创建不同游戏阶段的房间', () => {
      const flopRoom = RoomStateFactory.createRoomWithGamePhase('flop');
      const riverRoom = RoomStateFactory.createRoomWithGamePhase('river');
      
      expect(flopRoom.gameState?.phase).toBe('flop');
      expect(flopRoom.gameState?.board).toHaveLength(3);
      
      expect(riverRoom.gameState?.phase).toBe('river');
      expect(riverRoom.gameState?.board).toHaveLength(5);
    });
  });

  describe('错误场景数据生成示例', () => {
    it('应该能生成各种错误场景数据', () => {
      const errorScenarios = [
        'user-not-found',
        'room-not-found', 
        'room-join-full'
      ];
      
      errorScenarios.forEach(scenario => {
        const errorData = TestDataGenerator.createScenarioData(scenario);
        expect(errorData).toBeDefined();
        
        if (scenario === 'user-not-found') {
          expect(errorData.user).toBeNull();
        } else if (scenario === 'room-not-found') {
          expect(errorData.room).toBeNull();
        } else if (scenario === 'room-join-full') {
          expect(errorData.roomState.currentPlayerCount).toBe(6);
        }
      });
    });
  });

  describe('快速开始场景示例', () => {
    it('应该能生成快速开始的测试数据', () => {
      const createNewData = RoomHandlerTestData.forQuickStart('createNew');
      const joinExistingData = RoomHandlerTestData.forQuickStart('joinExisting');
      
      // 服务器无可用房间，需要创建新房间
      expect(createNewData.availableRooms).toHaveLength(0);
      
      // 服务器有可用房间，直接加入
      expect(joinExistingData.availableRooms).toHaveLength(1);
      expect(joinExistingData.roomState).toBeDefined();
    });
  });
});