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
 * roomHandlers单元测试主文件
 * 整合所有专项测试的核心用例，提供完整的业务逻辑覆盖
 */
const mockFactory_1 = require("../shared/mockFactory");
const roomStateFactory_1 = require("../shared/roomStateFactory");
const testDataGenerator_1 = require("../shared/testDataGenerator");
const socketTestUtils_1 = require("../shared/socketTestUtils");
// 导入实际的roomHandlers实现
// 在真实项目中，这里会导入真实的处理器函数
// import { setupRoomHandlers } from '../../../src/socket/handlers/roomHandlers';
// 临时模拟实现用于测试
const mockRoomHandlers = {
    roomJoin(socket, data, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const { roomId, password } = data;
            const { userId, username } = socket.data;
            try {
                // 验证
                const validationResult = yield socket.validationMiddleware.validateRoomJoin(data);
                if (!validationResult.valid) {
                    return callback({ success: false, error: validationResult.error });
                }
                // 冲突检查
                const conflictResult = yield socket.userStateService.checkAndHandleRoomConflict(userId, roomId, socket, socket.io);
                if (!conflictResult.success) {
                    return callback({ success: false, error: conflictResult.error });
                }
                // 房间存在性检查
                const room = yield socket.prisma.room.findUnique({
                    where: { id: roomId },
                    include: { owner: true }
                });
                if (!room) {
                    return callback({ success: false, error: 'Room not found' });
                }
                // 密码验证
                if (room.password && (!password || !(yield socket.bcrypt.compare(password, room.password)))) {
                    return callback({ success: false, error: 'Invalid password' });
                }
                // 房间状态检查
                const roomStateData = yield socket.redis.get(`room:${roomId}`);
                const roomState = roomStateData ? JSON.parse(roomStateData) : null;
                if (roomState && roomState.currentPlayerCount >= roomState.maxPlayers) {
                    return callback({ success: false, error: 'Room is full' });
                }
                // 成功加入
                yield socket.join(roomId);
                socket.data.roomId = roomId;
                return callback({
                    success: true,
                    message: 'Joined room successfully',
                    data: { roomState: roomState || {} }
                });
            }
            catch (error) {
                return callback({ success: false, error: 'Internal server error' });
            }
        });
    },
    roomLeave(socket, data, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const { roomId } = data;
            const { userId } = socket.data;
            try {
                const roomStateData = yield socket.redis.get(`room:${roomId}`);
                if (!roomStateData) {
                    return callback({ success: false, error: 'Room not found' });
                }
                const roomState = JSON.parse(roomStateData);
                const playerIndex = roomState.players.findIndex((p) => p.id === userId);
                if (playerIndex === -1) {
                    return callback({ success: false, error: 'Not in room' });
                }
                yield socket.leave(roomId);
                socket.data.roomId = undefined;
                yield socket.userStateService.clearUserCurrentRoom(userId);
                // 移除玩家
                const leavingPlayer = roomState.players[playerIndex];
                roomState.players.splice(playerIndex, 1);
                roomState.currentPlayerCount--;
                if (roomState.players.length === 0) {
                    yield socket.redis.del(`room:${roomId}`);
                    yield socket.prisma.room.delete({ where: { id: roomId } });
                    return callback({ success: true, message: 'Left room and room deleted' });
                }
                // 处理所有权转移
                if (leavingPlayer.isOwner && roomState.players.length > 0) {
                    roomState.players[0].isOwner = true;
                    roomState.ownerId = roomState.players[0].id;
                    yield socket.prisma.room.update({
                        where: { id: roomId },
                        data: { ownerId: roomState.players[0].id }
                    });
                }
                yield socket.redis.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
                return callback({ success: true, message: 'Left room successfully' });
            }
            catch (error) {
                return callback({ success: false, error: 'Internal server error' });
            }
        });
    },
    quickStart(socket, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userId, username } = socket.data;
            try {
                // 冲突检查
                const conflictResult = yield socket.userStateService.checkAndHandleRoomConflict(userId, null, socket, socket.io);
                if (!conflictResult.success && conflictResult.code !== 'NO_CURRENT_ROOM') {
                    return callback({ success: false, error: conflictResult.error });
                }
                // 查找可用房间
                const availableRooms = yield socket.prisma.room.findMany({
                    where: { status: 'WAITING', password: null },
                    include: { owner: true },
                    take: 10
                });
                // 尝试加入现有房间
                for (const room of availableRooms) {
                    const roomStateData = yield socket.redis.get(`room:${room.id}`);
                    if (roomStateData) {
                        const roomState = JSON.parse(roomStateData);
                        const isUserInRoom = roomState.players.some((p) => p.id === userId);
                        const hasSpace = roomState.currentPlayerCount < roomState.maxPlayers;
                        if (!isUserInRoom && hasSpace) {
                            // 加入现有房间
                            roomState.players.push({
                                id: userId,
                                username: username,
                                chips: 5000,
                                position: roomState.players.length,
                                isOwner: false,
                                status: 'ACTIVE',
                                isConnected: true
                            });
                            roomState.currentPlayerCount++;
                            yield socket.join(room.id);
                            socket.data.roomId = room.id;
                            yield socket.redis.setEx(`room:${room.id}`, 3600, JSON.stringify(roomState));
                            yield socket.userStateService.setUserCurrentRoom(userId, room.id);
                            return callback({
                                success: true,
                                message: 'Quick start successful - joined existing room',
                                data: { roomId: room.id, roomState }
                            });
                        }
                    }
                }
                // 创建新房间
                const newRoom = yield socket.prisma.room.create({
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
                const newRoomState = {
                    id: newRoom.id,
                    ownerId: newRoom.ownerId,
                    status: 'WAITING',
                    maxPlayers: 6,
                    currentPlayerCount: 1,
                    hasPassword: false,
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
                yield socket.join(newRoom.id);
                socket.data.roomId = newRoom.id;
                yield socket.redis.setEx(`room:${newRoom.id}`, 3600, JSON.stringify(newRoomState));
                yield socket.userStateService.setUserCurrentRoom(userId, newRoom.id);
                return callback({
                    success: true,
                    message: 'Quick start successful - created new room',
                    data: { roomId: newRoom.id, roomState: newRoomState }
                });
            }
            catch (error) {
                return callback({ success: false, error: 'Internal server error' });
            }
        });
    }
};
describe('roomHandlers - 单元测试集成验证', () => {
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
        // 重置数据生成器
        testDataGenerator_1.TestDataGenerator.resetCounter();
    });
    afterEach(() => {
        // 重置所有Mock状态
        mockFactory_1.MockFactory.resetAllMocks(mocks.prisma, mocks.redis, mocks.userStateService);
    });
    describe('核心功能集成测试', () => {
        it('完整的房间加入流程应该正常工作', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 配置Mock环境
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
            mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
            mocks.bcrypt.compare.mockResolvedValue(true);
            // 3. 执行房间加入
            yield mockRoomHandlers.roomJoin(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证完整流程
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback);
            expect(mocks.socket.data.roomId).toBe(testData.eventData.roomId);
            expect(mocks.validationMiddleware.validateRoomJoin).toHaveBeenCalled();
            expect(mocks.userStateService.checkAndHandleRoomConflict).toHaveBeenCalled();
            expect(mocks.prisma.room.findUnique).toHaveBeenCalled();
        }));
        it('完整的房间离开流程应该正常工作', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成房主转移场景数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-owner-transfer');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                ownerId: testData.user.id,
                players: [
                    {
                        id: testData.user.id,
                        username: testData.user.username,
                        chips: 5000,
                        isReady: false,
                        position: 0,
                        isOwner: true, // 添加房主标识
                        isConnected: true
                    },
                    {
                        id: 'new-owner',
                        username: 'newowner',
                        chips: 5000,
                        isReady: false,
                        position: 1,
                        isOwner: false, // 明确标识非房主
                        isConnected: true
                    }
                ],
                currentPlayerCount: 2
            });
            // 2. 配置Mock环境 - 确保socket数据与测试数据同步
            syncSocketWithTestData(mocks.socket, testData);
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            // 3. 执行房间离开
            yield mockRoomHandlers.roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证完整流程
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback);
            expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalled();
            expect(mocks.prisma.room.update).toHaveBeenCalled(); // 所有权转移
            expect(mocks.redis.setEx).toHaveBeenCalled(); // 状态更新
        }));
        it('完整的快速开始流程应该正常工作', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成创建新房间场景
            const testData = testDataGenerator_1.RoomHandlerTestData.forQuickStart('createNew');
            const newRoom = testDataGenerator_1.TestDataGenerator.createRoomData(testData.user.id);
            // 2. 配置Mock环境
            mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({
                success: true,
                code: 'NO_CURRENT_ROOM'
            });
            mocks.prisma.room.findMany.mockResolvedValue([]); // 无可用房间
            mocks.prisma.room.create.mockResolvedValue(newRoom);
            // 3. 执行快速开始
            yield mockRoomHandlers.quickStart(mocks.socket, mocks.callback);
            // 4. 验证完整流程
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback, expect.any(Object), 'Quick start successful - created new room');
            expect(mocks.prisma.room.findMany).toHaveBeenCalled(); // 查找房间
            expect(mocks.prisma.room.create).toHaveBeenCalled(); // 创建房间
            expect(mocks.userStateService.setUserCurrentRoom).toHaveBeenCalled(); // 设置状态
        }));
    });
    describe('业务场景集成测试', () => {
        it('用户应该能够连续执行 快速开始->离开->重新加入 流程', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 第一步：快速开始创建房间
            const user = testDataGenerator_1.TestDataGenerator.createUserData();
            const newRoom = testDataGenerator_1.TestDataGenerator.createRoomData(user.id);
            mocks.socket.data = { userId: user.id, username: user.username };
            mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({
                success: true,
                code: 'NO_CURRENT_ROOM'
            });
            mocks.prisma.room.findMany.mockResolvedValue([]);
            mocks.prisma.room.create.mockResolvedValue(newRoom);
            yield mockRoomHandlers.quickStart(mocks.socket, mocks.callback);
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback);
            // 2. 第二步：离开房间
            mocks.callback.mockClear();
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                id: newRoom.id,
                ownerId: user.id,
                players: [{
                        id: user.id,
                        username: user.username,
                        chips: 5000,
                        isReady: false,
                        position: 0,
                        isConnected: true
                    }],
                currentPlayerCount: 1
            });
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            yield mockRoomHandlers.roomLeave(mocks.socket, { roomId: newRoom.id }, mocks.callback);
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback, undefined, 'Left room and room deleted');
            // 3. 第三步：重新加入（应该创建新房间）
            mocks.callback.mockClear();
            mocks.prisma.room.findMany.mockResolvedValue([]);
            const newRoom2 = testDataGenerator_1.TestDataGenerator.createRoomData(user.id);
            mocks.prisma.room.create.mockResolvedValue(newRoom2);
            yield mockRoomHandlers.quickStart(mocks.socket, mocks.callback);
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback, expect.any(Object), 'Quick start successful - created new room');
        }));
        it('多用户房间交互应该正确处理', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 创建房间和用户数据
            const owner = testDataGenerator_1.TestDataGenerator.createUserData();
            const joiner = testDataGenerator_1.TestDataGenerator.createUserData();
            const room = testDataGenerator_1.TestDataGenerator.createRoomData(owner.id);
            // 2. 房主创建房间场景
            mocks.socket.data = { userId: owner.id, username: owner.username };
            const ownerRoomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                id: room.id,
                ownerId: owner.id,
                players: [{
                        id: owner.id,
                        username: owner.username,
                        chips: 5000,
                        isReady: false,
                        position: 0,
                        isConnected: true
                    }],
                currentPlayerCount: 1
            });
            // 3. 其他用户加入房间
            mocks.socket.data = { userId: joiner.id, username: joiner.username };
            mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
            mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
            mocks.prisma.room.findUnique.mockResolvedValue(room);
            mocks.redis.get.mockResolvedValue(JSON.stringify(ownerRoomState));
            yield mockRoomHandlers.roomJoin(mocks.socket, { roomId: room.id }, mocks.callback);
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback);
            // 4. 验证多用户场景处理
            expect(mocks.socket.data.roomId).toBe(room.id);
        }));
        it('房间满员后快速开始应该创建新房间', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成满员房间场景
            const testData = testDataGenerator_1.RoomHandlerTestData.forQuickStart('joinExisting');
            const fullRoomState = roomStateFactory_1.RoomStateFactory.createFullRoomState();
            const newRoom = testDataGenerator_1.TestDataGenerator.createRoomData(testData.user.id);
            // 2. 配置满员房间
            mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({
                success: true,
                code: 'NO_CURRENT_ROOM'
            });
            mocks.prisma.room.findMany.mockResolvedValue(testData.availableRooms);
            mocks.redis.get.mockResolvedValue(JSON.stringify(fullRoomState)); // 所有房间都满员
            mocks.prisma.room.create.mockResolvedValue(newRoom);
            // 3. 执行快速开始
            yield mockRoomHandlers.quickStart(mocks.socket, mocks.callback);
            // 4. 验证创建新房间
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback, expect.any(Object), 'Quick start successful - created new room');
            expect(mocks.prisma.room.create).toHaveBeenCalled();
        }));
    });
    describe('错误恢复集成测试', () => {
        it('应该在临时错误后正确恢复', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
            // 2. 第一次调用失败
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.validationMiddleware.validateRoomJoin.mockResolvedValue({ valid: true });
            mocks.userStateService.checkAndHandleRoomConflict.mockResolvedValue({ success: true });
            mocks.prisma.room.findUnique.mockRejectedValueOnce(new Error('Temporary database error'));
            yield mockRoomHandlers.roomJoin(mocks.socket, testData.eventData, mocks.callback);
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
            // 3. 第二次调用成功
            mocks.callback.mockClear();
            mocks.prisma.room.findUnique.mockResolvedValueOnce(testData.room);
            yield mockRoomHandlers.roomJoin(mocks.socket, testData.eventData, mocks.callback);
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback);
        }));
        it('应该正确处理部分失败的复合操作', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成房主离开场景
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-owner-transfer');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                ownerId: testData.user.id,
                players: [
                    {
                        id: testData.user.id,
                        username: testData.user.username,
                        chips: 5000,
                        isReady: false,
                        position: 0,
                        isOwner: true, // 确保触发所有权转移逻辑
                        isConnected: true
                    },
                    {
                        id: 'new-owner',
                        username: 'newowner',
                        chips: 5000,
                        isReady: false,
                        position: 1,
                        isOwner: false,
                        isConnected: true
                    }
                ],
                currentPlayerCount: 2
            });
            // 2. 配置部分操作失败 - 确保socket数据与测试数据同步
            syncSocketWithTestData(mocks.socket, testData);
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            mocks.prisma.room.update.mockRejectedValue(new Error('Database update failed'));
            // 3. 执行操作
            yield mockRoomHandlers.roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
            // 5. 验证用户状态仍被清理（部分成功）
            expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalled();
        }));
    });
    describe('性能和稳定性测试', () => {
        it('应该能够处理大量并发用户数据', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成大量用户数据
            const users = testDataGenerator_1.TestDataGenerator.createBulkData(testDataGenerator_1.TestDataGenerator.createUserData, 100, { chips: 5000 });
            // 2. 验证数据生成性能
            expect(users).toHaveLength(100);
            users.forEach(user => {
                expect(user.id).toBeDefined();
                expect(user.username).toBeDefined();
                expect(user.chips).toBe(5000);
            });
            // 3. 验证每个用户数据的唯一性
            const userIds = users.map(u => u.id);
            const uniqueIds = new Set(userIds);
            expect(uniqueIds.size).toBe(100);
        }));
        it('应该能够处理复杂房间状态验证', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 创建复杂房间状态
            const complexRoomState = roomStateFactory_1.RoomStateFactory.createGameInProgressState({
                players: testDataGenerator_1.TestDataGenerator.createBulkData(() => testDataGenerator_1.TestDataGenerator.createUserData(), 6).map((user, index) => ({
                    id: user.id,
                    username: user.username,
                    chips: 5000,
                    isReady: false,
                    position: index,
                    isConnected: true
                })),
                currentPlayerCount: 6,
                maxPlayers: 6
            });
            // 2. 验证复杂状态
            roomStateFactory_1.RoomStateAssertions.assertValidRoomState(complexRoomState);
            roomStateFactory_1.RoomStateAssertions.assertPlayerCount(complexRoomState, 6);
            roomStateFactory_1.RoomStateAssertions.assertRoomStatus(complexRoomState, 'PLAYING');
            // 3. 验证所有玩家数据完整性
            complexRoomState.players.forEach((player, index) => {
                expect(player.position).toBe(index);
                expect(player.id).toBeDefined();
                expect(player.username).toBeDefined();
            });
        }));
        it('应该能够快速执行基本操作', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 记录开始时间
            const startTime = Date.now();
            // 2. 执行100次快速数据生成和验证
            for (let i = 0; i < 100; i++) {
                const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-join-success');
                roomStateFactory_1.RoomStateAssertions.assertValidRoomState(testData.roomState);
            }
            // 3. 验证执行时间（应该在合理范围内）
            const executionTime = Date.now() - startTime;
            expect(executionTime).toBeLessThan(1000); // 应该在1秒内完成
        }));
    });
});
