"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 测试基建工具使用示例
 * 展示如何使用新搭建的测试工具来创建单元测试
 */
const mockFactory_1 = require("./mockFactory");
const roomStateFactory_1 = require("./roomStateFactory");
const testDataGenerator_1 = require("./testDataGenerator");
describe('测试基建工具使用示例', () => {
    let mocks;
    beforeEach(() => {
        // 创建完整的Mock环境
        mocks = mockFactory_1.MockFactory.createRoomHandlerMocks();
    });
    afterEach(() => {
        // 重置所有Mock状态
        mockFactory_1.MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
        testDataGenerator_1.TestDataGenerator.resetCounter();
    });
    describe('房间加入成功场景示例', () => {
        it('应该成功加入一个有空位的房间', () => {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 配置Mock返回值
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            // 3. 验证测试数据完整性
            expect(testData.user).toBeDefined();
            expect(testData.room).toBeDefined();
            expect(testData.roomState).toBeDefined();
            expect(testData.eventData).toBeDefined();
            // 4. 验证房间状态
            roomStateFactory_1.RoomStateAssertions.assertValidRoomState(testData.roomState);
            roomStateFactory_1.RoomStateAssertions.assertPlayerCount(testData.roomState, 2);
            // 5. 模拟实际测试逻辑（这里只是展示Mock配置）
            expect(mocks.prisma.user.findUnique).toBeDefined();
            expect(mocks.redis.get).toBeDefined();
            expect(mocks.callback).toBeDefined();
        });
    });
    describe('房间满员错误场景示例', () => {
        it('应该正确处理房间满员的情况', () => {
            // 1. 使用专用数据生成器
            const fullRoomData = testDataGenerator_1.RoomHandlerTestData.forRoomJoin('full');
            // 2. 配置Mock
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, fullRoomData);
            // 3. 验证满员房间状态
            expect(fullRoomData.roomState.currentPlayerCount).toBe(6);
            expect(fullRoomData.roomState.maxPlayers).toBe(6);
            roomStateFactory_1.RoomStateAssertions.assertPlayerCount(fullRoomData.roomState, 6);
        });
    });
    describe('批量数据生成示例', () => {
        it('应该能批量生成用户数据', () => {
            // 批量生成5个用户
            const users = testDataGenerator_1.TestDataGenerator.createBulkData(testDataGenerator_1.TestDataGenerator.createUserData, 5, { chips: 10000 });
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
            const gameInProgressRoom = roomStateFactory_1.RoomStateFactory.createGameInProgressState({
                bigBlind: 50,
                smallBlind: 25
            });
            expect(gameInProgressRoom.status).toBe('PLAYING');
            expect(gameInProgressRoom.gameStarted).toBe(true);
            expect(gameInProgressRoom.bigBlind).toBe(50);
            expect(gameInProgressRoom.smallBlind).toBe(25);
            roomStateFactory_1.RoomStateAssertions.assertValidRoomState(gameInProgressRoom);
            roomStateFactory_1.RoomStateAssertions.assertRoomStatus(gameInProgressRoom, 'PLAYING');
        });
        it('应该能创建不同游戏阶段的房间', () => {
            var _a, _b, _c, _d;
            const flopRoom = roomStateFactory_1.RoomStateFactory.createRoomWithGamePhase('flop');
            const riverRoom = roomStateFactory_1.RoomStateFactory.createRoomWithGamePhase('river');
            expect((_a = flopRoom.gameState) === null || _a === void 0 ? void 0 : _a.phase).toBe('flop');
            expect((_b = flopRoom.gameState) === null || _b === void 0 ? void 0 : _b.board).toHaveLength(3);
            expect((_c = riverRoom.gameState) === null || _c === void 0 ? void 0 : _c.phase).toBe('river');
            expect((_d = riverRoom.gameState) === null || _d === void 0 ? void 0 : _d.board).toHaveLength(5);
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
                const errorData = testDataGenerator_1.TestDataGenerator.createScenarioData(scenario);
                expect(errorData).toBeDefined();
                if (scenario === 'user-not-found') {
                    expect(errorData.user).toBeNull();
                }
                else if (scenario === 'room-not-found') {
                    expect(errorData.room).toBeNull();
                }
                else if (scenario === 'room-join-full') {
                    expect(errorData.roomState.currentPlayerCount).toBe(6);
                }
            });
        });
    });
    describe('快速开始场景示例', () => {
        it('应该能生成快速开始的测试数据', () => {
            const createNewData = testDataGenerator_1.RoomHandlerTestData.forQuickStart('createNew');
            const joinExistingData = testDataGenerator_1.RoomHandlerTestData.forQuickStart('joinExisting');
            // 服务器无可用房间，需要创建新房间
            expect(createNewData.availableRooms).toHaveLength(0);
            // 服务器有可用房间，直接加入
            expect(joinExistingData.availableRooms).toHaveLength(1);
            expect(joinExistingData.roomState).toBeDefined();
        });
    });
});
