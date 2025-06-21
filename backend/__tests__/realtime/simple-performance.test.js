"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 简化的性能测试 - 验证测试基建工具的性能表现
 */
const testDataGenerator_1 = require("../shared/testDataGenerator");
const roomStateFactory_1 = require("../shared/roomStateFactory");
const mockFactory_1 = require("../shared/mockFactory");
describe('测试基建工具性能验证', () => {
    afterEach(() => {
        testDataGenerator_1.TestDataGenerator.resetCounter();
    });
    it('应该能快速生成1000个用户数据', () => {
        const startTime = Date.now();
        const users = testDataGenerator_1.TestDataGenerator.createBulkData(testDataGenerator_1.TestDataGenerator.createUserData, 1000, { chips: 5000 });
        const executionTime = Date.now() - startTime;
        expect(users).toHaveLength(1000);
        expect(executionTime).toBeLessThan(500); // 应该在500ms内完成
        console.log(`生成1000个用户耗时: ${executionTime}ms`);
        // 验证数据唯一性
        const userIds = users.map(u => u.id);
        const uniqueIds = new Set(userIds);
        expect(uniqueIds.size).toBe(1000);
    });
    it('应该能快速生成100个房间状态', () => {
        const startTime = Date.now();
        const rooms = Array.from({ length: 100 }, () => roomStateFactory_1.RoomStateFactory.createBasicRoomState());
        const executionTime = Date.now() - startTime;
        expect(rooms).toHaveLength(100);
        expect(executionTime).toBeLessThan(200); // 应该在200ms内完成
        console.log(`生成100个房间状态耗时: ${executionTime}ms`);
    });
    it('应该能快速生成100个测试场景', () => {
        const startTime = Date.now();
        const scenarios = Array.from({ length: 100 }, (_, i) => {
            const scenarioTypes = [
                'room-join-success',
                'room-join-full',
                'room-leave-success',
                'quick-start-createNew'
            ];
            const scenario = scenarioTypes[i % scenarioTypes.length];
            return testDataGenerator_1.TestDataGenerator.createScenarioData(scenario);
        });
        const executionTime = Date.now() - startTime;
        expect(scenarios).toHaveLength(100);
        expect(executionTime).toBeLessThan(300); // 应该在300ms内完成
        console.log(`生成100个测试场景耗时: ${executionTime}ms`);
    });
    it('应该能快速创建和重置Mock环境', () => {
        const startTime = Date.now();
        for (let i = 0; i < 100; i++) {
            const mocks = mockFactory_1.MockFactory.createRoomHandlerMocks();
            mockFactory_1.MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
        }
        const executionTime = Date.now() - startTime;
        expect(executionTime).toBeLessThan(1000); // 应该在1秒内完成
        console.log(`创建和重置100个Mock环境耗时: ${executionTime}ms`);
    });
    it('应该能稳定处理多次测试循环', () => {
        const executionTimes = [];
        for (let cycle = 0; cycle < 10; cycle++) {
            const startTime = Date.now();
            // 模拟完整测试流程
            const users = testDataGenerator_1.TestDataGenerator.createBulkData(testDataGenerator_1.TestDataGenerator.createUserData, 100);
            const rooms = Array.from({ length: 20 }, () => roomStateFactory_1.RoomStateFactory.createBasicRoomState());
            const scenario = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            const mocks = mockFactory_1.MockFactory.createRoomHandlerMocks();
            mockFactory_1.MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
            testDataGenerator_1.TestDataGenerator.resetCounter();
            const cycleTime = Date.now() - startTime;
            executionTimes.push(cycleTime);
            expect(users).toHaveLength(100);
            expect(rooms).toHaveLength(20);
            expect(scenario).toBeDefined();
        }
        // 验证性能稳定性
        const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
        const maxTime = Math.max(...executionTimes);
        const minTime = Math.min(...executionTimes);
        console.log(`10个测试周期平均耗时: ${avgTime.toFixed(2)}ms`);
        console.log(`最大耗时: ${maxTime}ms, 最小耗时: ${minTime}ms`);
        expect(avgTime).toBeLessThan(100); // 平均应该在100ms内
        expect(maxTime - minTime).toBeLessThan(50); // 时间变化应该小于50ms
    });
    it('应该能正确处理并发ID生成', () => {
        const startTime = Date.now();
        // 快速生成大量数据，检查ID唯一性
        const allIds = [];
        for (let i = 0; i < 50; i++) {
            const users = testDataGenerator_1.TestDataGenerator.createBulkData(testDataGenerator_1.TestDataGenerator.createUserData, 20);
            const rooms = testDataGenerator_1.TestDataGenerator.createBulkData(testDataGenerator_1.TestDataGenerator.createRoomData, 10);
            allIds.push(...users.map(u => u.id));
            allIds.push(...rooms.map(r => r.id));
        }
        const executionTime = Date.now() - startTime;
        // 验证所有ID都是唯一的
        const uniqueIds = new Set(allIds);
        expect(uniqueIds.size).toBe(allIds.length);
        expect(allIds).toHaveLength(1500); // 50 * (20 + 10)
        expect(executionTime).toBeLessThan(500);
        console.log(`生成1500个唯一ID耗时: ${executionTime}ms`);
    });
});
