/**
 * roomHandlers单元测试性能验证
 * 验证测试基建工具在大量数据生成和复杂场景下的性能表现
 */
import { MockFactory } from '../shared/mockFactory';
import { RoomStateFactory } from '../shared/roomStateFactory';
import { TestDataGenerator } from '../shared/testDataGenerator';

describe('roomHandlers性能和稳定性验证', () => {
  describe('数据生成性能测试', () => {
    it('应该能快速生成大量用户数据', () => {
      const startTime = Date.now();
      
      // 生成1000个用户
      const users = TestDataGenerator.createBulkData(
        TestDataGenerator.createUserData,
        1000,
        { chips: 5000 }
      );
      
      const executionTime = Date.now() - startTime;
      
      expect(users).toHaveLength(1000);
      expect(executionTime).toBeLessThan(500); // 应该在500ms内完成
      
      // 验证数据唯一性
      const userIds = users.map(u => u.id);
      const uniqueIds = new Set(userIds);
      expect(uniqueIds.size).toBe(1000);
    });

    it('应该能快速生成复杂房间状态', () => {
      const startTime = Date.now();
      
      // 生成100个复杂房间状态
      const rooms = Array.from({ length: 100 }, () => 
        RoomStateFactory.createGameInProgressState({
          maxPlayers: 6,
          currentPlayerCount: 6
        })
      );
      
      const executionTime = Date.now() - startTime;
      
      expect(rooms).toHaveLength(100);
      expect(executionTime).toBeLessThan(200); // 应该在200ms内完成
      
      // 验证每个房间都有6个玩家
      rooms.forEach(room => {
        expect(room.players).toHaveLength(6);
        expect(room.currentPlayerCount).toBe(6);
      });
    });

    it('应该能快速生成测试场景数据包', () => {
      const startTime = Date.now();
      
      // 生成100个不同场景数据包
      const scenarios = [
        'room-join-success',
        'room-join-full',
        'room-join-password',
        'room-leave-success',
        'room-leave-owner-transfer',
        'quick-start-createNew',
        'quick-start-joinExisting',
        'user-not-found',
        'room-not-found'
      ];
      
      const scenarioData: any[] = [];
      for (let i = 0; i < 100; i++) {
        const scenario = scenarios[i % scenarios.length];
        scenarioData.push(TestDataGenerator.createScenarioData(scenario as any));
      }
      
      const executionTime = Date.now() - startTime;
      
      expect(scenarioData).toHaveLength(100);
      expect(executionTime).toBeLessThan(300); // 应该在300ms内完成
      
      // 验证数据完整性
      scenarioData.forEach(data => {
        expect(data).toBeDefined();
        if (data.user) {
          expect(data.user.id).toBeDefined();
          expect(data.user.username).toBeDefined();
        }
      });
    });
  });

  describe('Mock对象性能测试', () => {
    it('应该能快速创建和重置Mock环境', () => {
      const startTime = Date.now();
      
      // 创建100个Mock环境
      const mockEnvironments: any[] = [];
      for (let i = 0; i < 100; i++) {
        const mocks = MockFactory.createRoomHandlerMocks();
        mockEnvironments.push(mocks);
        
        // 重置Mock状态
        MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
      }
      
      const executionTime = Date.now() - startTime;
      
      expect(mockEnvironments).toHaveLength(100);
      expect(executionTime).toBeLessThan(1000); // 应该在1秒内完成
      
      // 验证Mock对象结构
      mockEnvironments.forEach(mocks => {
        expect(mocks.prisma).toBeDefined();
        expect(mocks.redis).toBeDefined();
        expect(mocks.socket).toBeDefined();
        expect(mocks.userStateService).toBeDefined();
        expect(mocks.callback).toBeDefined();
      });
    });

    it('应该能处理大量并发Mock调用', () => {
      const mocks = MockFactory.createRoomHandlerMocks();
      const startTime = Date.now();
      
      // 配置Mock返回值
      (mocks.prisma.room.findUnique as any).mockResolvedValue({
        id: 'test-room',
        ownerId: 'test-owner',
        playerLimit: 6
      } as any);
      
      // 模拟100次并发调用
      const promises = Array.from({ length: 100 }, async () => {
        const result = await mocks.prisma.room.findUnique({ where: { id: 'test-room' } });
        return result;
      });
      
      return Promise.all(promises).then(results => {
        const executionTime = Date.now() - startTime;
        
        expect(results).toHaveLength(100);
        expect(executionTime).toBeLessThan(100); // 应该在100ms内完成
        
        // 验证所有调用返回相同结果
        results.forEach((result: any) => {
          expect(result?.id).toBe('test-room');
        });
      });
    });
  });

  describe('内存使用测试', () => {
    it('应该在大量数据生成后正确清理内存', () => {
      const initialMemory = process.memoryUsage();
      
      // 生成大量数据
      for (let i = 0; i < 10; i++) {
        const users = TestDataGenerator.createBulkData(
          TestDataGenerator.createUserData,
          1000
        );
        
        const rooms = Array.from({ length: 100 }, () => 
          RoomStateFactory.createGameInProgressState()
        );
        
        // 重置计数器释放引用
        TestDataGenerator.resetCounter();
      }
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // 内存增长应该在合理范围内（少于100MB）
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('应该能处理重复的数据生成和清理循环', () => {
      const memoryReadings: number[] = [];
      
      for (let cycle = 0; cycle < 10; cycle++) {
        // 生成数据
        const users = TestDataGenerator.createBulkData(
          TestDataGenerator.createUserData,
          500
        );
        
        const mocks = MockFactory.createRoomHandlerMocks();
        
        // 记录内存使用
        memoryReadings.push(process.memoryUsage().heapUsed);
        
        // 清理
        TestDataGenerator.resetCounter();
        MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
      }
      
      // 验证内存使用趋于稳定（最后3次读数的差异应该很小）
      const lastThreeReadings = memoryReadings.slice(-3);
      const maxReading = Math.max(...lastThreeReadings);
      const minReading = Math.min(...lastThreeReadings);
      const variation = maxReading - minReading;
      
      // 内存变化应该小于50MB
      expect(variation).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('并发安全性测试', () => {
    it('应该能安全处理并发数据生成', async () => {
      // 并发生成不同类型的数据
      const promises = [
        ...Array.from({ length: 50 }, () => 
          Promise.resolve(TestDataGenerator.createUserData())
        ),
        ...Array.from({ length: 30 }, () => 
          Promise.resolve(TestDataGenerator.createRoomData())
        ),
        ...Array.from({ length: 20 }, () => 
          Promise.resolve(RoomStateFactory.createBasicRoomState())
        )
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(100);
      
      // 验证所有ID都是唯一的
      const allIds = results
        .filter(item => item && item.id)
        .map(item => item.id);
      
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it('应该能处理快速连续的计数器重置', () => {
      const generatedIds: string[] = [];
      
      for (let i = 0; i < 100; i++) {
        // 生成一些数据
        const user = TestDataGenerator.createUserData();
        const room = TestDataGenerator.createRoomData();
        
        generatedIds.push(user.id as string, room.id as string);
        
        // 每10次重置一次计数器
        if (i % 10 === 9) {
          TestDataGenerator.resetCounter();
        }
      }
      
      // 验证所有ID都是唯一的
      const uniqueIds = new Set(generatedIds);
      expect(uniqueIds.size).toBe(generatedIds.length);
    });
  });

  describe('复杂场景性能测试', () => {
    it('应该能快速处理完整的测试流程', () => {
      const startTime = Date.now();
      
      // 模拟完整的测试流程
      for (let i = 0; i < 50; i++) {
        // 1. 创建Mock环境
        const mocks = MockFactory.createRoomHandlerMocks();
        
        // 2. 生成测试数据
        const testData = TestDataGenerator.createScenarioData('room-join-success');
        
        // 3. 配置Mock
        (mocks.prisma.room.findUnique as any).mockResolvedValue(testData.room as any);
        (mocks.redis.get as any).mockResolvedValue(JSON.stringify(testData.roomState as any));
        
        // 4. 验证数据
        expect(testData.user).toBeDefined();
        expect(testData.room).toBeDefined();
        expect(testData.roomState).toBeDefined();
        
        // 5. 重置环境
        MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
        TestDataGenerator.resetCounter();
      }
      
      const executionTime = Date.now() - startTime;
      
      // 50个完整流程应该在2秒内完成
      expect(executionTime).toBeLessThan(2000);
    });

    it('应该能处理错误恢复场景', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        try {
          // 尝试生成可能导致错误的数据
          const invalidScenario = i % 2 === 0 ? 'valid-scenario' : 'room-join-success';
          const data = TestDataGenerator.createScenarioData(invalidScenario);
          
          expect(data).toBeDefined();
        } catch (error) {
          // 错误应该被优雅处理
          expect(error).toBeInstanceOf(Error);
        }
        
        // 即使出错也要重置
        TestDataGenerator.resetCounter();
      }
      
      const executionTime = Date.now() - startTime;
      
      // 错误处理不应该显著影响性能
      expect(executionTime).toBeLessThan(1000);
    });
  });
});