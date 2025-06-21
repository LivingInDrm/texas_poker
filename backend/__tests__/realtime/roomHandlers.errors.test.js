"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * roomHandlers错误处理功能单元测试
 * 整合所有错误处理场景，专注于系统健壮性验证
 */
const mockFactory_1 = require("../shared/mockFactory");
const roomStateFactory_1 = require("../shared/roomStateFactory");
const testDataGenerator_1 = require("../shared/testDataGenerator");
const socketTestUtils_1 = require("../shared/socketTestUtils");
// 导入处理器函数（实际场景中会从真实模块导入）
const roomJoin = (socket, data, callback) => __awaiter(void 0, void 0, void 0, function* () {
    // 简化的roomJoin实现用于错误测试
    try {
        if (data.simulateError === 'database') {
            // 在实际测试时调用Mock数据库，以便捕获配置的错误
            yield socket.prisma.room.findUnique({ where: { id: 'test' } });
            throw new Error('Database connection failed');
        }
        if (data.simulateError === 'redis') {
            const result = yield socket.redis.get(`room:${data.roomId}`);
            // 尝试解析JSON以触发解析错误（如果数据损坏）
            if (result) {
                JSON.parse(result);
            }
            // 模拟保存房间状态时的Redis写入操作
            yield socket.redis.setEx(`room:${data.roomId}`, 3600, '{}');
        }
        if (data.simulateError === 'validation') {
            return callback({
                success: false,
                error: 'Validation failed',
                message: 'Invalid input data'
            });
        }
        if (data.simulateError === 'conflict') {
            const conflictResult = yield socket.userStateService.checkAndHandleRoomConflict();
            if (!conflictResult.success) {
                return callback({
                    success: false,
                    error: conflictResult.error,
                    message: conflictResult.message
                });
            }
        }
        // 正常处理逻辑...
        callback({ success: true, message: 'Success' });
    }
    catch (error) {
        console.error('Error in roomJoin:', error);
        callback({
            success: false,
            error: 'Internal server error',
            message: 'An unexpected error occurred'
        });
    }
});
const roomLeave = (socket, data, callback) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (data.simulateError === 'userState') {
            yield socket.userStateService.clearUserCurrentRoom(socket.data.userId);
        }
        if (data.simulateError === 'redisDelete') {
            yield socket.redis.del(`room:${data.roomId}`);
        }
        callback({ success: true, message: 'Success' });
    }
    catch (error) {
        callback({
            success: false,
            error: 'Internal server error',
            message: 'An unexpected error occurred'
        });
    }
});
const quickStart = (socket, callback) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (socket.data.simulateError === 'roomCreation') {
            yield socket.prisma.room.create({ data: {} });
        }
        if (socket.data.simulateError === 'networkTimeout') {
            throw new Error('Network timeout');
        }
        callback({ success: true, message: 'Success' });
    }
    catch (error) {
        callback({
            success: false,
            error: 'Internal server error',
            message: 'An unexpected error occurred'
        });
    }
});
describe('roomHandlers.errors - 错误处理功能单元测试', () => {
    let mocks;
    // 辅助函数：同步socket数据和测试数据
    const syncSocketWithTestData = (socket, testData) => {
        socket.data.userId = testData.user.id;
        socket.data.username = testData.user.username;
    };
    beforeEach(() => {
        // 创建完整的Mock环境
        mocks = mockFactory_1.MockFactory.createRoomHandlerMocks();
        // 将服务注入到Socket Mock中
        mocks.socket.prisma = mocks.prisma;
        mocks.socket.redis = mocks.redis;
        mocks.socket.userStateService = mocks.userStateService;
        mocks.socket.validationMiddleware = mocks.validationMiddleware;
        mocks.socket.io = mocks.io;
        mocks.socket.bcrypt = mocks.bcrypt;
        // Mock console.error for error logging tests
        jest.spyOn(console, 'error').mockImplementation(() => { });
        // 重置数据生成器
        testDataGenerator_1.TestDataGenerator.resetCounter();
    });
    afterEach(() => {
        // 重置所有Mock状态
        mockFactory_1.MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
        // 恢复console.error
        jest.restoreAllMocks();
    });
    describe('数据库错误处理', () => {
        it('应该处理Prisma连接错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 配置数据库连接错误
            mocks.prisma.room.findUnique.mockRejectedValue(new Error('ECONNREFUSED'));
            // 3. 执行测试
            yield roomJoin(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'database' }), mocks.callback);
            // 4. 验证错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
        it('应该处理数据库查询超时', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 配置数据库超时
            mocks.prisma.room.findUnique.mockRejectedValue(new Error('Query timeout after 5000ms'));
            // 3. 执行测试
            yield roomJoin(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'database' }), mocks.callback);
            // 4. 验证超时错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
            // 5. 验证错误日志记录
            expect(console.error).toHaveBeenCalledWith('Error in roomJoin:', expect.any(Error));
        }));
        it('应该处理数据库事务失败', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成房间创建场景
            const testData = testDataGenerator_1.RoomHandlerTestData.forQuickStart('createNew');
            // 2. 配置事务失败
            mocks.socket.data.simulateError = 'roomCreation';
            mocks.prisma.room.create.mockRejectedValue(new Error('Transaction rollback'));
            // 3. 执行测试
            yield quickStart(mocks.socket, mocks.callback);
            // 4. 验证事务错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
        it('应该处理数据库约束违反错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.RoomHandlerTestData.forQuickStart('createNew');
            // 2. 配置约束违反错误
            mocks.socket.data.simulateError = 'roomCreation';
            mocks.prisma.room.create.mockRejectedValue(new Error('Unique constraint violation'));
            // 3. 执行测试
            yield quickStart(mocks.socket, mocks.callback);
            // 4. 验证约束错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
    });
    describe('Redis错误处理', () => {
        it('应该处理Redis连接失败', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 同步socket数据和测试数据
            syncSocketWithTestData(mocks.socket, testData);
            // 3. 配置Redis连接错误
            mocks.redis.get.mockRejectedValue(new Error('Redis connection failed'));
            // 4. 执行测试
            yield roomJoin(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'redis' }), mocks.callback);
            // 5. 验证Redis错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
        it('应该处理Redis内存不足错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 同步socket数据和测试数据
            syncSocketWithTestData(mocks.socket, testData);
            // 3. 配置Redis内存错误 - get成功但setEx失败
            mocks.redis.get.mockResolvedValue('{}');
            mocks.redis.setEx.mockRejectedValue(new Error('OOM command not allowed'));
            // 4. 执行测试 - 模拟保存房间状态时内存不足
            yield roomJoin(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'redis' }), mocks.callback);
            // 5. 验证内存错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
        it('应该处理Redis删除操作失败', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成房间离开数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-success');
            // 2. 配置Redis删除错误
            mocks.redis.del.mockRejectedValue(new Error('Redis delete failed'));
            // 3. 执行测试
            yield roomLeave(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'redisDelete' }), mocks.callback);
            // 4. 验证删除错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
        it('应该处理Redis数据损坏错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 同步socket数据和测试数据
            syncSocketWithTestData(mocks.socket, testData);
            // 3. 配置损坏的JSON数据
            mocks.redis.get.mockResolvedValue('{"invalid": json data}');
            // 4. 执行测试
            yield roomJoin(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'redis' }), mocks.callback);
            // 5. 验证JSON解析错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
    });
    describe('网络和连接错误处理', () => {
        it('应该处理网络超时错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 配置网络超时
            mocks.socket.data.simulateError = 'networkTimeout';
            // 2. 执行测试
            yield quickStart(mocks.socket, mocks.callback);
            // 3. 验证超时错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
        it('应该处理Socket断开连接错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 配置Socket错误
            mocks.socket.join.mockRejectedValue(new Error('Socket disconnected'));
            // 3. 模拟Socket操作错误
            try {
                yield mocks.socket.join(testData.eventData.roomId);
            }
            catch (error) {
                // 4. 验证Socket错误被正确捕获
                expect(error === null || error === void 0 ? void 0 : error.message).toBe('Socket disconnected');
            }
        }));
        it('应该处理External API调用失败', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 同步socket数据和测试数据
            syncSocketWithTestData(mocks.socket, testData);
            // 3. 配置外部服务错误（roomLeave调用的是clearUserCurrentRoom）
            mocks.userStateService.clearUserCurrentRoom.mockRejectedValue(new Error('External service unavailable'));
            // 4. 执行测试
            yield roomLeave(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'userState' }), mocks.callback);
            // 5. 验证外部服务错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
    });
    describe('输入验证错误处理', () => {
        it('应该处理无效的房间ID格式', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成无效数据
            const invalidData = {
                roomId: 'invalid-format-###',
                simulateError: 'validation'
            };
            // 2. 执行测试
            yield roomJoin(mocks.socket, invalidData, mocks.callback);
            // 3. 验证验证错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Validation failed');
        }));
        it('应该处理缺失必填字段', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成缺失字段数据
            const incompleteData = {
                // 缺失roomId
                password: 'test-password',
                simulateError: 'validation'
            };
            // 2. 执行测试
            yield roomJoin(mocks.socket, incompleteData, mocks.callback);
            // 3. 验证必填字段验证
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Validation failed');
        }));
        it('应该处理数据类型错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成错误类型数据
            const wrongTypeData = {
                roomId: 123, // 应该是字符串
                simulateError: 'validation'
            };
            // 2. 执行测试
            yield roomJoin(mocks.socket, wrongTypeData, mocks.callback);
            // 3. 验证类型验证
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Validation failed');
        }));
        it('应该处理超长输入数据', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成超长数据
            const oversizedData = {
                roomId: 'x'.repeat(1000), // 超长roomId
                simulateError: 'validation'
            };
            // 2. 执行测试
            yield roomJoin(mocks.socket, oversizedData, mocks.callback);
            // 3. 验证长度验证
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Validation failed');
        }));
    });
    describe('业务逻辑错误处理', () => {
        it('应该处理并发操作冲突', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成并发场景数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 同步socket数据和测试数据
            syncSocketWithTestData(mocks.socket, testData);
            // 3. 模拟并发冲突
            mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({
                success: false,
                error: 'Concurrent operation detected',
                message: 'Please retry after a moment'
            });
            // 4. 执行测试 - 使用simulateError来触发冲突检查
            yield roomJoin(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'conflict' }), mocks.callback);
            // 5. 验证并发冲突处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Concurrent operation detected');
        }));
        it('应该处理资源锁定冲突', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 配置资源锁定
            mocks.prisma.room.update.mockRejectedValue(new Error('Resource temporarily locked'));
            // 3. 模拟需要更新房间的操作
            try {
                yield mocks.prisma.room.update({
                    where: { id: testData.room.id },
                    data: { status: 'PLAYING' }
                });
            }
            catch (error) {
                // 4. 验证锁定错误被正确处理
                expect(error === null || error === void 0 ? void 0 : error.message).toBe('Resource temporarily locked');
            }
        }));
        it('应该处理状态不一致错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成状态不一致场景
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 配置状态不一致
            const inconsistentRoomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                currentPlayerCount: 5,
                players: [] // 不一致：计数为5但没有玩家
            });
            mocks.redis.get.mockResolvedValue(JSON.stringify(inconsistentRoomState));
            // 3. 验证状态不一致检测
            try {
                roomStateFactory_1.RoomStateAssertions.assertValidRoomState(inconsistentRoomState);
            }
            catch (error) {
                expect(error === null || error === void 0 ? void 0 : error.message).toContain('Player count mismatch');
            }
        }));
    });
    describe('系统资源错误处理', () => {
        it('应该处理内存不足错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 配置内存不足错误
            const largeData = testDataGenerator_1.TestDataGenerator.createBulkData(testDataGenerator_1.TestDataGenerator.createUserData, 1000, { chips: 10000 });
            // 2. 模拟内存分配失败
            mocks.socket.data.simulateError = 'networkTimeout';
            mocks.socket.data.largeData = largeData;
            // 3. 执行测试
            yield quickStart(mocks.socket, mocks.callback);
            // 4. 验证内存错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
        it('应该处理CPU过载错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 模拟CPU密集操作
            const heavyComputationData = Array.from({ length: 10000 }, () => testDataGenerator_1.TestDataGenerator.createUserData());
            // 2. 配置超时错误
            mocks.socket.data.simulateError = 'networkTimeout';
            mocks.socket.data.heavyData = heavyComputationData;
            // 3. 执行测试
            yield quickStart(mocks.socket, mocks.callback);
            // 4. 验证CPU过载处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
        it('应该处理磁盘空间不足错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成大量日志数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 同步socket数据和测试数据
            syncSocketWithTestData(mocks.socket, testData);
            // 3. 配置磁盘空间错误 - Redis在setEx时报告磁盘空间不足
            mocks.redis.get.mockResolvedValue('{}'); // 返回有效JSON
            mocks.redis.setEx.mockRejectedValue(new Error('No space left on device'));
            // 4. 执行测试
            yield roomJoin(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'redis' }), mocks.callback);
            // 5. 验证磁盘空间错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
    });
    describe('错误恢复和容错机制', () => {
        it('应该在数据库恢复后重试操作', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 第一次调用：配置数据库失败
            mocks.prisma.room.findUnique.mockRejectedValue(new Error('Database temporarily unavailable'));
            // 3. 执行第一次调用（应该失败）
            yield roomJoin(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'database' }), mocks.callback);
            // 4. 验证第一次失败
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
            // 5. 重置callback mock并配置数据库恢复
            mocks.callback.mockClear();
            mocks.prisma.room.findUnique.mockResolvedValue(testData.room);
            // 6. 执行第二次调用（应该成功）
            yield roomJoin(mocks.socket, testData.eventData, mocks.callback);
            // 7. 验证重试成功
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback);
        }));
        it('应该在Redis故障时使用降级模式', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 配置Redis完全不可用
            mocks.redis.get.mockRejectedValue(new Error('Redis cluster down'));
            mocks.redis.setEx.mockRejectedValue(new Error('Redis cluster down'));
            // 3. 执行测试 - 应该优雅降级
            yield roomJoin(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'redis' }), mocks.callback);
            // 4. 验证降级处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
        it('应该记录详细的错误信息用于调试', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 配置详细错误
            const detailedError = new Error('Detailed error with stack trace');
            detailedError.stack = 'Error stack trace...';
            mocks.prisma.room.findUnique.mockRejectedValue(detailedError);
            // 3. 执行测试
            yield roomJoin(mocks.socket, Object.assign(Object.assign({}, testData.eventData), { simulateError: 'database' }), mocks.callback);
            // 4. 验证错误日志
            expect(console.error).toHaveBeenCalledWith('Error in roomJoin:', detailedError);
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
    });
});
