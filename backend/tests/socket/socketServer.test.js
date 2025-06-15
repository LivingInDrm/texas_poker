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
const http_1 = require("http");
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const socketServer_1 = require("../../src/socket/socketServer");
const socket_1 = require("../../src/types/socket");
const prisma_1 = __importDefault(require("../../src/prisma"));
const db_1 = require("../../src/db");
describe('Socket.IO Server', () => {
    let httpServer;
    let io;
    let serverPort;
    let testUser;
    let validToken;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // 创建测试用户
        testUser = yield prisma_1.default.user.create({
            data: {
                username: `test_socket_user_${Date.now()}`,
                passwordHash: 'test_hash',
                chips: 5000
            }
        });
        // 生成有效的JWT token
        validToken = jsonwebtoken_1.default.sign({ userId: testUser.id }, process.env.JWT_SECRET || 'test_secret');
        // 创建HTTP服务器
        httpServer = (0, http_1.createServer)();
        io = (0, socketServer_1.createSocketServer)(httpServer);
        // 启动服务器
        yield new Promise((resolve) => {
            httpServer.listen(() => {
                serverPort = httpServer.address().port;
                resolve();
            });
        });
    }));
    afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
        // 清理测试数据
        yield prisma_1.default.user.delete({ where: { id: testUser.id } });
        // 关闭服务器
        io.close();
        httpServer.close();
    }));
    afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
        // 清理Redis中的测试数据
        const keys = yield db_1.redisClient.keys('room:*');
        if (keys.length > 0) {
            yield db_1.redisClient.del(keys);
        }
    }));
    describe('Authentication', () => {
        test('should accept connection with valid token', (done) => {
            const client = (0, socket_io_client_1.default)(`http://localhost:${serverPort}`, {
                auth: { token: validToken }
            });
            client.on('connect', () => {
                expect(client.connected).toBe(true);
                client.disconnect();
                done();
            });
            client.on('connect_error', (error) => {
                done(error);
            });
        });
        test('should reject connection without token', (done) => {
            const client = (0, socket_io_client_1.default)(`http://localhost:${serverPort}`);
            client.on('connect_error', (error) => {
                expect(error.message).toContain('AUTHENTICATION_FAILED');
                client.disconnect();
                done();
            });
            client.on('connect', () => {
                done(new Error('Should not connect without token'));
            });
        });
        test('should reject connection with invalid token', (done) => {
            const client = (0, socket_io_client_1.default)(`http://localhost:${serverPort}`, {
                auth: { token: 'invalid_token' }
            });
            client.on('connect_error', (error) => {
                expect(error.message).toContain('AUTHENTICATION_FAILED');
                client.disconnect();
                done();
            });
            client.on('connect', () => {
                done(new Error('Should not connect with invalid token'));
            });
        });
    });
    describe('System Events', () => {
        let client;
        beforeEach((done) => {
            client = (0, socket_io_client_1.default)(`http://localhost:${serverPort}`, {
                auth: { token: validToken }
            });
            client.on('connect', done);
        });
        afterEach(() => {
            if (client.connected) {
                client.disconnect();
            }
        });
        test('should receive welcome message on connection', (done) => {
            client.on(socket_1.SOCKET_EVENTS.CONNECTED, (data) => {
                expect(data.message).toContain('Welcome');
                expect(data.message).toContain(testUser.username);
                done();
            });
        });
        test('should handle ping-pong', (done) => {
            client.emit(socket_1.SOCKET_EVENTS.PING, (timestamp) => {
                expect(typeof timestamp).toBe('number');
                expect(timestamp).toBeGreaterThan(0);
                done();
            });
        });
        test('should handle heartbeat', (done) => {
            client.on('heartbeat', (timestamp) => {
                expect(typeof timestamp).toBe('number');
                client.emit('heartbeat_response', timestamp);
                done();
            });
        });
    });
    describe('Room Events', () => {
        let client;
        let testRoom;
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
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
            client = (0, socket_io_client_1.default)(`http://localhost:${serverPort}`, {
                auth: { token: validToken }
            });
            yield new Promise((resolve) => {
                client.on('connect', resolve);
            });
        }));
        afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
            if (client.connected) {
                client.disconnect();
            }
            // 清理测试房间
            try {
                yield prisma_1.default.room.delete({ where: { id: testRoom.id } });
            }
            catch (error) {
                // 房间可能已被删除
            }
        }));
        test('should join room successfully', (done) => {
            client.emit(socket_1.SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, (response) => {
                expect(response.success).toBe(true);
                expect(response.data.roomState).toBeDefined();
                expect(response.data.roomState.players).toHaveLength(1);
                expect(response.data.roomState.players[0].id).toBe(testUser.id);
                done();
            });
        });
        test('should fail to join non-existent room', (done) => {
            const fakeRoomId = '00000000-0000-0000-0000-000000000000';
            client.emit(socket_1.SOCKET_EVENTS.ROOM_JOIN, { roomId: fakeRoomId }, (response) => {
                expect(response.success).toBe(false);
                expect(response.error).toContain('Room not found');
                done();
            });
        });
        test('should leave room successfully', (done) => {
            // 先加入房间
            client.emit(socket_1.SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, (joinResponse) => {
                expect(joinResponse.success).toBe(true);
                // 然后离开房间
                client.emit(socket_1.SOCKET_EVENTS.ROOM_LEAVE, { roomId: testRoom.id }, (leaveResponse) => {
                    expect(leaveResponse.success).toBe(true);
                    done();
                });
            });
        });
        test('should handle quick start', (done) => {
            client.emit(socket_1.SOCKET_EVENTS.ROOM_QUICK_START, (response) => {
                expect(response.success).toBe(true);
                expect(response.data.roomState).toBeDefined();
                expect(response.data.roomId).toBeDefined();
                done();
            });
        });
    });
    describe('Game Events', () => {
        let client1;
        let client2;
        let testRoom;
        let testUser2;
        let validToken2;
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            // 创建第二个测试用户
            testUser2 = yield prisma_1.default.user.create({
                data: {
                    username: `test_socket_user2_${Date.now()}`,
                    passwordHash: 'test_hash',
                    chips: 5000
                }
            });
            validToken2 = jsonwebtoken_1.default.sign({ userId: testUser2.id }, process.env.JWT_SECRET || 'test_secret');
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
            // 连接两个客户端
            client1 = (0, socket_io_client_1.default)(`http://localhost:${serverPort}`, {
                auth: { token: validToken }
            });
            client2 = (0, socket_io_client_1.default)(`http://localhost:${serverPort}`, {
                auth: { token: validToken2 }
            });
            yield Promise.all([
                new Promise((resolve) => client1.on('connect', resolve)),
                new Promise((resolve) => client2.on('connect', resolve))
            ]);
        }));
        afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
            if (client1.connected)
                client1.disconnect();
            if (client2.connected)
                client2.disconnect();
            try {
                yield prisma_1.default.user.delete({ where: { id: testUser2.id } });
                yield prisma_1.default.room.delete({ where: { id: testRoom.id } });
            }
            catch (error) {
                // 可能已被删除
            }
        }));
        test('should handle player ready state', (done) => {
            // 两个玩家都加入房间
            Promise.all([
                new Promise((resolve) => {
                    client1.emit(socket_1.SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, () => resolve());
                }),
                new Promise((resolve) => {
                    client2.emit(socket_1.SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, () => resolve());
                })
            ]).then(() => {
                // 第一个玩家准备
                client1.emit(socket_1.SOCKET_EVENTS.GAME_READY, { roomId: testRoom.id }, (response) => {
                    expect(response.success).toBe(true);
                    expect(response.data.isReady).toBe(true);
                    done();
                });
            });
        });
        test('should start game when all players ready', (done) => {
            let gameStartedReceived = false;
            // 监听游戏开始事件
            client1.on(socket_1.SOCKET_EVENTS.GAME_STARTED, (data) => {
                expect(data.gameState).toBeDefined();
                expect(data.gameState.players).toHaveLength(2);
                gameStartedReceived = true;
            });
            client2.on(socket_1.SOCKET_EVENTS.GAME_STARTED, (data) => {
                expect(data.gameState).toBeDefined();
                if (gameStartedReceived) {
                    done();
                }
            });
            // 两个玩家都加入房间并准备
            Promise.all([
                new Promise((resolve) => {
                    client1.emit(socket_1.SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, () => resolve());
                }),
                new Promise((resolve) => {
                    client2.emit(socket_1.SOCKET_EVENTS.ROOM_JOIN, { roomId: testRoom.id }, () => resolve());
                })
            ]).then(() => {
                // 两个玩家都准备
                client1.emit(socket_1.SOCKET_EVENTS.GAME_READY, { roomId: testRoom.id }, () => {
                    client2.emit(socket_1.SOCKET_EVENTS.GAME_READY, { roomId: testRoom.id }, () => {
                        // 游戏应该自动开始
                    });
                });
            });
        });
    });
    describe('Rate Limiting', () => {
        let client;
        beforeEach((done) => {
            client = (0, socket_io_client_1.default)(`http://localhost:${serverPort}`, {
                auth: { token: validToken }
            });
            client.on('connect', done);
        });
        afterEach(() => {
            if (client.connected) {
                client.disconnect();
            }
        });
        test('should rate limit rapid ping requests', (done) => {
            let successCount = 0;
            let attempts = 0;
            const sendPing = () => {
                attempts++;
                client.emit(socket_1.SOCKET_EVENTS.PING, (timestamp) => {
                    successCount++;
                    if (attempts < 10) {
                        // 立即发送下一个ping（无延迟）
                        setImmediate(sendPing);
                    }
                    else {
                        // 检查是否有一些请求被限制
                        expect(successCount).toBeLessThan(attempts);
                        done();
                    }
                });
            };
            sendPing();
        }, 10000);
    });
});
