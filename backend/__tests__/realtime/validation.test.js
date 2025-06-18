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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const validation_1 = require("../../src/socket/middleware/validation");
const db_1 = require("../../src/db");
const prisma_1 = __importDefault(require("../../src/prisma"));
describe('ValidationMiddleware', () => {
    let validationMiddleware;
    let mockSocket;
    let testUser;
    let testRoom;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        validationMiddleware = new validation_1.ValidationMiddleware();
        // 创建测试用户
        testUser = yield prisma_1.default.user.create({
            data: {
                username: `test_validation_user_${Date.now()}`,
                passwordHash: 'test_hash',
                chips: 5000
            }
        });
        // 创建测试房间
        testRoom = yield prisma_1.default.room.create({
            data: {
                ownerId: testUser.id,
                playerLimit: 6,
                status: 'WAITING',
                bigBlind: 20,
                smallBlind: 10
            }
        });
        // 模拟socket
        mockSocket = {
            data: {
                userId: testUser.id,
                username: testUser.username,
                authenticated: true
            }
        };
    }));
    afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
        // 清理测试数据
        yield prisma_1.default.room.delete({ where: { id: testRoom.id } });
        yield prisma_1.default.user.delete({ where: { id: testUser.id } });
        // 清理Redis数据
        const keys = yield db_1.redisClient.keys('room:*');
        if (keys.length > 0) {
            yield db_1.redisClient.del(keys);
        }
        const actionKeys = yield db_1.redisClient.keys('action_history:*');
        if (actionKeys.length > 0) {
            yield db_1.redisClient.del(actionKeys);
        }
        const lastActionKeys = yield db_1.redisClient.keys('last_action:*');
        if (lastActionKeys.length > 0) {
            yield db_1.redisClient.del(lastActionKeys);
        }
    }));
    describe('validateRoomJoin', () => {
        test('should validate valid room join request', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield validationMiddleware.validateRoomJoin(mockSocket, testRoom.id, undefined);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        }));
        test('should reject invalid room ID format', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield validationMiddleware.validateRoomJoin(mockSocket, 'invalid-room-id', undefined);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid room ID format');
        }));
        test('should reject invalid password format', () => __awaiter(void 0, void 0, void 0, function* () {
            const longPassword = 'a'.repeat(51); // 超过50字符
            const result = yield validationMiddleware.validateRoomJoin(mockSocket, testRoom.id, longPassword);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid password format');
        }));
        test('should enforce join rate limiting', () => __awaiter(void 0, void 0, void 0, function* () {
            // 快速连续尝试加入房间
            const promises = [];
            for (let i = 0; i < 15; i++) {
                promises.push(validationMiddleware.validateRoomJoin(mockSocket, testRoom.id, undefined));
            }
            const results = yield Promise.all(promises);
            // 前10个应该通过，后面的应该被限制
            const validResults = results.filter(r => r.valid);
            const invalidResults = results.filter(r => !r.valid);
            expect(validResults.length).toBe(10);
            expect(invalidResults.length).toBe(5);
            expect(invalidResults[0].error).toContain('Too many join attempts');
        }));
    });
    describe('validatePlayerAction', () => {
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            // 设置房间状态，包含正在进行的游戏
            const roomState = {
                id: testRoom.id,
                ownerId: testUser.id,
                players: [{
                        id: testUser.id,
                        username: testUser.username,
                        chips: 5000,
                        isReady: true,
                        position: 0,
                        isConnected: true
                    }],
                status: 'playing',
                gameStarted: true,
                gameState: {
                    phase: 'preflop',
                    players: [{
                            id: testUser.id,
                            username: testUser.username,
                            chips: 5000,
                            cards: ['AH', 'AS'],
                            status: 'active',
                            position: 0,
                            totalBet: 0,
                            isConnected: true
                        }],
                    currentPlayerIndex: 0,
                    currentBet: 20,
                    roundBets: {},
                    pot: 30
                }
            };
            yield db_1.redisClient.set(`room:${testRoom.id}`, JSON.stringify(roomState));
        }));
        test('should validate valid player action', () => __awaiter(void 0, void 0, void 0, function* () {
            const action = {
                type: 'call',
                timestamp: new Date()
            };
            const result = yield validationMiddleware.validatePlayerAction(mockSocket, testRoom.id, action);
            expect(result.valid).toBe(true);
        }));
        test('should reject action when not player turn', () => __awaiter(void 0, void 0, void 0, function* () {
            // 修改游戏状态，使当前玩家不是测试用户
            const roomData = yield db_1.redisClient.get(`room:${testRoom.id}`);
            const roomState = JSON.parse(roomData);
            roomState.gameState.currentPlayerIndex = 1; // 不是测试用户的索引
            yield db_1.redisClient.set(`room:${testRoom.id}`, JSON.stringify(roomState));
            const action = {
                type: 'call',
                timestamp: new Date()
            };
            const result = yield validationMiddleware.validatePlayerAction(mockSocket, testRoom.id, action);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('NOT_PLAYER_TURN');
        }));
        test('should reject invalid action type', () => __awaiter(void 0, void 0, void 0, function* () {
            const action = {
                type: 'invalid_action',
                timestamp: new Date()
            };
            const result = yield validationMiddleware.validatePlayerAction(mockSocket, testRoom.id, action);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid action type');
        }));
        test('should reject raise with invalid amount', () => __awaiter(void 0, void 0, void 0, function* () {
            const action = {
                type: 'raise',
                amount: -100, // 负数金额
                timestamp: new Date()
            };
            const result = yield validationMiddleware.validatePlayerAction(mockSocket, testRoom.id, action);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid raise amount');
        }));
        test('should enforce action rate limiting', () => __awaiter(void 0, void 0, void 0, function* () {
            const action = {
                type: 'call',
                timestamp: new Date()
            };
            // 快速连续发送动作
            const promises = [];
            for (let i = 0; i < 65; i++) {
                promises.push(validationMiddleware.validatePlayerAction(mockSocket, testRoom.id, action));
            }
            const results = yield Promise.all(promises);
            // 前60个应该通过，后面的应该被限制
            const validResults = results.filter(r => r.valid);
            const invalidResults = results.filter(r => !r.valid);
            expect(validResults.length).toBeLessThanOrEqual(60);
            expect(invalidResults.length).toBeGreaterThan(0);
        }));
        test('should detect suspicious action patterns', () => __awaiter(void 0, void 0, void 0, function* () {
            const action = {
                type: 'call',
                timestamp: new Date()
            };
            // 设置行动历史，模拟重复模式
            const actionHistory = ['call:0', 'raise:100', 'call:0', 'raise:100'];
            yield db_1.redisClient.lpush(`action_history:${testUser.id}:${testRoom.id}`, ...actionHistory);
            const result = yield validationMiddleware.validatePlayerAction(mockSocket, testRoom.id, action);
            // 注意：当前实现只是记录警告，不会拒绝行动
            expect(result.valid).toBe(true);
        }));
        test('should prevent too fast actions', () => __awaiter(void 0, void 0, void 0, function* () {
            const action = {
                type: 'call',
                timestamp: new Date()
            };
            // 设置最后行动时间为刚刚
            yield db_1.redisClient.set(`last_action:${testUser.id}`, Date.now().toString());
            const result = yield validationMiddleware.validatePlayerAction(mockSocket, testRoom.id, action);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Actions too fast');
        }));
    });
    describe('validateMessageRate', () => {
        test('should allow messages within rate limit', () => {
            // 前100条消息应该通过
            for (let i = 0; i < 100; i++) {
                const result = validationMiddleware.validateMessageRate(testUser.id);
                expect(result).toBe(true);
            }
        });
        test('should block messages exceeding rate limit', () => {
            // 发送100条消息（达到限制）
            for (let i = 0; i < 100; i++) {
                validationMiddleware.validateMessageRate(testUser.id);
            }
            // 第101条消息应该被阻止
            const result = validationMiddleware.validateMessageRate(testUser.id);
            expect(result).toBe(false);
        });
    });
    describe('cleanup', () => {
        test('should clean up expired counters', () => {
            // 手动设置过期的计数器
            const expiredTime = Date.now() - 120000; // 2分钟前
            validationMiddleware['actionCounts'].set(testUser.id, {
                count: 10,
                resetTime: expiredTime
            });
            expect(validationMiddleware['actionCounts'].has(testUser.id)).toBe(true);
            // 执行清理
            validationMiddleware.cleanup();
            expect(validationMiddleware['actionCounts'].has(testUser.id)).toBe(false);
        });
        test('should keep valid counters', () => {
            // 设置未过期的计数器
            const futureTime = Date.now() + 60000; // 1分钟后
            validationMiddleware['actionCounts'].set(testUser.id, {
                count: 10,
                resetTime: futureTime
            });
            expect(validationMiddleware['actionCounts'].has(testUser.id)).toBe(true);
            // 执行清理
            validationMiddleware.cleanup();
            expect(validationMiddleware['actionCounts'].has(testUser.id)).toBe(true);
        });
    });
});
