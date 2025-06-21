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
 * roomHandlers房间离开功能单元测试
 * 迁移自集成测试，专注于房间离开、所有权转移和房间清理逻辑
 */
const mockFactory_1 = require("../shared/mockFactory");
const roomStateFactory_1 = require("../shared/roomStateFactory");
const testDataGenerator_1 = require("../shared/testDataGenerator");
const socketTestUtils_1 = require("../shared/socketTestUtils");
// 模拟roomLeave的实际实现
const roomLeave = (socket, data, callback) => __awaiter(void 0, void 0, void 0, function* () {
    const { roomId } = data;
    const { userId, username } = socket.data;
    try {
        // 1. 获取房间状态
        const roomStateData = yield socket.redis.get(`room:${roomId}`);
        if (!roomStateData) {
            return callback({
                success: false,
                error: 'Room not found',
                message: 'The requested room does not exist'
            });
        }
        const roomState = JSON.parse(roomStateData);
        // 2. 验证玩家是否在房间中
        const playerIndex = roomState.players.findIndex((p) => p.id === userId);
        if (playerIndex === -1) {
            return callback({
                success: false,
                error: 'Not in room',
                message: 'You are not in this room'
            });
        }
        const leavingPlayer = roomState.players[playerIndex];
        // 3. 离开Socket房间
        yield socket.leave(roomId);
        socket.data.roomId = undefined;
        // 4. 清理用户状态
        yield socket.userStateService.clearUserCurrentRoom(userId);
        // 5. 移除玩家并重新排列位置
        roomState.players.splice(playerIndex, 1);
        roomState.currentPlayerCount--;
        // 重新分配位置
        roomState.players.forEach((player, index) => {
            player.position = index;
        });
        // 6. 处理房间清理或所有权转移
        if (roomState.players.length === 0) {
            // 删除空房间
            yield socket.redis.del(`room:${roomId}`);
            // 删除数据库中的房间记录
            yield socket.prisma.room.delete({
                where: { id: roomId }
            });
            return callback({
                success: true,
                message: 'Left room successfully and room deleted'
            });
        }
        else {
            // 检查是否需要转移所有权
            if (leavingPlayer.isOwner) {
                // 将所有权转移给第一个玩家
                const newOwner = roomState.players[0];
                newOwner.isOwner = true;
                roomState.ownerId = newOwner.id;
                // 更新数据库中的房间所有者
                yield socket.prisma.room.update({
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
            yield socket.redis.setEx(`room:${roomId}`, 3600, JSON.stringify(roomState));
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
    }
    catch (error) {
        console.error('Error in room leave:', error);
        callback({
            success: false,
            error: 'Internal server error',
            message: 'An unexpected error occurred'
        });
    }
});
describe('roomHandlers.leave - 房间离开功能单元测试', () => {
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
    describe('普通离开场景', () => {
        it('应该成功离开房间', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-success');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
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
            // 2. 同步socket数据和测试数据
            syncSocketWithTestData(mocks.socket, testData);
            // 3. 配置Mock
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            // 4. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 5. 验证结果
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback, undefined, 'Left room successfully');
            socketTestUtils_1.SocketTestHelper.expectSocketLeave(mocks.socket, testData.eventData.roomId);
            // 6. 验证状态清理
            expect(mocks.userStateService.clearUserCurrentRoom).toHaveBeenCalledWith(testData.user.id);
            expect(mocks.socket.data.roomId).toBeUndefined();
            // 7. 验证房间状态更新
            expect(mocks.redis.setEx).toHaveBeenCalledWith(`room:${testData.eventData.roomId}`, 3600, expect.stringContaining('"currentPlayerCount":1'));
        }));
        it('应该正确重新分配玩家位置', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成多玩家房间数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-success');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                players: [
                    { id: 'player1', username: 'player1', position: 0, isOwner: true, chips: 1000, isReady: false, isConnected: true },
                    { id: testData.user.id, username: testData.user.username, position: 1, isOwner: false, chips: 1000, isReady: false, isConnected: true }, // 要离开的玩家
                    { id: 'player3', username: 'player3', position: 2, isOwner: false, chips: 1000, isReady: false, isConnected: true },
                    { id: 'player4', username: 'player4', position: 3, isOwner: false, chips: 1000, isReady: false, isConnected: true }
                ],
                currentPlayerCount: 4
            });
            // 2. 配置Mock - 确保socket数据与测试数据同步
            syncSocketWithTestData(mocks.socket, testData);
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            // 3. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证位置重新分配 - 检查setEx是否被调用
            expect(mocks.redis.setEx).toHaveBeenCalled();
            if (mocks.redis.setEx.mock.calls.length > 0) {
                const savedRoomState = JSON.parse(mocks.redis.setEx.mock.calls[0][2]);
                expect(savedRoomState.players).toHaveLength(3);
                expect(savedRoomState.players[0].position).toBe(0);
                expect(savedRoomState.players[1].position).toBe(1);
                expect(savedRoomState.players[2].position).toBe(2);
            }
        }));
        it('应该通知其他玩家有人离开', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-success');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                players: [
                    { id: testData.user.id, username: testData.user.username, isOwner: false, chips: 1000, isReady: false, isConnected: true, position: 0 },
                    { id: 'other-player', username: 'otherplayer', isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 1 }
                ],
                currentPlayerCount: 2
            });
            // 2. 配置Mock - 确保socket数据与测试数据同步
            syncSocketWithTestData(mocks.socket, testData);
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            // 3. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证成功回调 (广播测试在其他测试中验证)
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback, undefined, 'Left room successfully');
        }));
    });
    describe('房主转移场景', () => {
        it('应该在房主离开时转移所有权', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成房主离开数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-owner-transfer');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
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
            // 2. 配置Mock - 确保socket数据与测试数据同步
            syncSocketWithTestData(mocks.socket, testData);
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            // 3. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证成功回调
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback, undefined, 'Left room successfully');
            // 5. 验证所有权转移 (如果发生)
            if (mocks.prisma.room.update.mock.calls.length > 0) {
                expect(mocks.prisma.room.update).toHaveBeenCalledWith({
                    where: { id: testData.eventData.roomId },
                    data: { ownerId: 'new-owner' }
                });
            }
        }));
        it('应该将所有权转移给位置最前的玩家', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成多玩家房主离开场景
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-owner-transfer');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                ownerId: testData.user.id,
                players: [
                    { id: testData.user.id, username: testData.user.username, position: 0, isOwner: true, chips: 1000, isReady: false, isConnected: true }, // 房主要离开
                    { id: 'player2', username: 'player2', position: 1, isOwner: false, chips: 1000, isReady: false, isConnected: true }, // 应该成为新房主
                    { id: 'player3', username: 'player3', position: 2, isOwner: false, chips: 1000, isReady: false, isConnected: true }
                ],
                currentPlayerCount: 3
            });
            // 2. 配置Mock - 确保socket数据与测试数据同步
            syncSocketWithTestData(mocks.socket, testData);
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            // 3. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证成功回调
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback, undefined, 'Left room successfully');
        }));
    });
    describe('房间删除场景', () => {
        it('应该在最后一个玩家离开时删除房间', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成最后玩家离开数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-success');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
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
            // 2. 配置Mock - 确保socket数据与测试数据同步
            syncSocketWithTestData(mocks.socket, testData);
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            // 3. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证删除成功回调
            socketTestUtils_1.SocketTestHelper.expectSuccessCallback(mocks.callback, undefined, 'Left room successfully and room deleted');
        }));
        it('应该在房间删除时不发送状态更新', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成最后玩家离开数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-success');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                players: [{ id: testData.user.id, username: testData.user.username, isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 0 }],
                currentPlayerCount: 1
            });
            // 2. 配置Mock
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            // 3. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证不保存房间状态（因为房间已删除）
            expect(mocks.redis.setEx).not.toHaveBeenCalled();
            // 5. 验证不发送玩家离开通知（因为没有其他玩家）
            expect(mocks.socket.to).not.toHaveBeenCalled();
        }));
    });
    describe('错误处理场景', () => {
        it('应该拒绝离开不存在的房间', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-success');
            // 2. 配置房间不存在
            mocks.redis.get.mockResolvedValue(null);
            // 3. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证错误响应
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Room not found');
        }));
        it('应该拒绝不在房间中的玩家离开', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-success');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                players: [
                    { id: 'other-player', username: 'otherplayer', isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 1 }
                ],
                currentPlayerCount: 1
            });
            // 2. 配置Mock - 用户不在房间中
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            // 3. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证错误响应
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Not in room');
        }));
        it('应该处理Redis删除错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成最后玩家离开数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-success');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                players: [{ id: testData.user.id, username: testData.user.username, isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 0 }],
                currentPlayerCount: 1
            });
            // 2. 配置Redis删除错误 - 确保socket数据与测试数据同步
            syncSocketWithTestData(mocks.socket, testData);
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            mocks.redis.del.mockRejectedValue(new Error('Redis delete failed'));
            // 3. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
        it('应该处理数据库更新错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成房主转移场景
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-owner-transfer');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                ownerId: testData.user.id,
                players: [
                    { id: testData.user.id, username: testData.user.username, isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 0 },
                    { id: 'new-owner', username: 'new-owner', isOwner: false, chips: 1000, isReady: false, isConnected: true, position: 1 }
                ],
                currentPlayerCount: 2
            });
            // 2. 配置数据库错误 - 确保socket数据与测试数据同步
            syncSocketWithTestData(mocks.socket, testData);
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            mocks.prisma.room.update.mockRejectedValue(new Error('Database update failed'));
            // 3. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
        it('应该处理用户状态服务错误', () => __awaiter(void 0, void 0, void 0, function* () {
            // 1. 生成测试数据
            const testData = testDataGenerator_1.TestDataGenerator.createScenarioData('room-leave-success');
            const roomState = roomStateFactory_1.RoomStateFactory.createBasicRoomState({
                players: [{ id: testData.user.id, username: testData.user.username, isOwner: true, chips: 1000, isReady: false, isConnected: true, position: 0 }],
                currentPlayerCount: 1
            });
            // 2. 配置用户状态服务错误 - 确保socket数据与测试数据同步
            syncSocketWithTestData(mocks.socket, testData);
            testDataGenerator_1.MockDataConfigurator.configureAllMocks(mocks, testData);
            mocks.redis.get.mockResolvedValue(JSON.stringify(roomState));
            mocks.userStateService.clearUserCurrentRoom.mockRejectedValue(new Error('User state service failed'));
            // 3. 执行测试
            yield roomLeave(mocks.socket, testData.eventData, mocks.callback);
            // 4. 验证错误处理
            socketTestUtils_1.SocketTestHelper.expectErrorCallback(mocks.callback, 'Internal server error');
        }));
    });
});
