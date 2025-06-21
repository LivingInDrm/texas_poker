"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockConfigurationHelper = exports.MockFactory = void 0;
const globals_1 = require("@jest/globals");
/**
 * 统一的Mock工厂类
 * 用于创建和管理测试中的所有Mock对象，避免重复定义
 */
class MockFactory {
    /**
     * 创建Prisma数据库客户端Mock
     * 覆盖常用的数据库操作方法
     */
    static createPrismaMock() {
        return {
            room: {
                create: globals_1.jest.fn(),
                findUnique: globals_1.jest.fn(),
                findMany: globals_1.jest.fn(),
                update: globals_1.jest.fn(),
                delete: globals_1.jest.fn(),
                count: globals_1.jest.fn()
            },
            user: {
                create: globals_1.jest.fn(),
                findUnique: globals_1.jest.fn(),
                findMany: globals_1.jest.fn(),
                update: globals_1.jest.fn(),
                delete: globals_1.jest.fn()
            },
            gameSession: {
                create: globals_1.jest.fn(),
                findMany: globals_1.jest.fn(),
                update: globals_1.jest.fn()
            },
            $disconnect: globals_1.jest.fn(),
            $connect: globals_1.jest.fn()
        };
    }
    /**
     * 创建Redis客户端Mock
     * 包含所有常用的Redis操作
     */
    static createRedisMock() {
        return {
            get: globals_1.jest.fn(),
            set: globals_1.jest.fn(),
            setEx: globals_1.jest.fn(),
            del: globals_1.jest.fn(),
            keys: globals_1.jest.fn(),
            exists: globals_1.jest.fn(),
            expire: globals_1.jest.fn(),
            ttl: globals_1.jest.fn(),
            lPush: globals_1.jest.fn(),
            lpush: globals_1.jest.fn(), // Keep both for compatibility
            rPush: globals_1.jest.fn(),
            rpush: globals_1.jest.fn(),
            lPop: globals_1.jest.fn(),
            lpop: globals_1.jest.fn(),
            rPop: globals_1.jest.fn(),
            rpop: globals_1.jest.fn(),
            lRange: globals_1.jest.fn(),
            lrange: globals_1.jest.fn(), // Keep both for compatibility
            lTrim: globals_1.jest.fn(),
            ltrim: globals_1.jest.fn(),
            connect: globals_1.jest.fn(),
            disconnect: globals_1.jest.fn(),
            quit: globals_1.jest.fn(),
            ping: globals_1.jest.fn()
        };
    }
    /**
     * 创建Socket对象Mock
     * 简单的Socket Mock，避免复杂的类型问题
     */
    static createSocketMock(userData = {}) {
        const defaultUserData = {
            userId: 'test-user-123',
            username: 'testuser',
            authenticated: true
        };
        return {
            data: Object.assign(Object.assign({}, defaultUserData), userData),
            id: 'mock-socket-id',
            connected: true,
            join: globals_1.jest.fn(),
            leave: globals_1.jest.fn(),
            emit: globals_1.jest.fn(),
            to: globals_1.jest.fn().mockReturnThis(),
            broadcast: globals_1.jest.fn().mockReturnThis(),
            on: globals_1.jest.fn(),
            once: globals_1.jest.fn(),
            off: globals_1.jest.fn(),
            disconnect: globals_1.jest.fn(),
            rooms: new Set(),
            // Add bcrypt support to socket
            bcrypt: null // Will be injected in createRoomHandlerMocks
        };
    }
    /**
     * 创建Socket.IO服务器Mock
     */
    static createIOMock() {
        // Create a broadcast object that will be returned by to() calls
        const broadcastObject = {
            emit: globals_1.jest.fn()
        };
        return {
            emit: globals_1.jest.fn(),
            to: globals_1.jest.fn().mockReturnValue(broadcastObject),
            in: globals_1.jest.fn().mockReturnThis(),
            use: globals_1.jest.fn(),
            on: globals_1.jest.fn(),
            engine: {
                generateId: globals_1.jest.fn(() => `socket-${Date.now()}`)
            }
        };
    }
    /**
     * 创建JWT库Mock
     * 标准化JWT验证行为
     */
    static createJWTMock() {
        const jwtMock = {
            verify: globals_1.jest.fn(),
            sign: globals_1.jest.fn(),
            decode: globals_1.jest.fn()
        };
        // 设置默认的验证行为
        jwtMock.verify.mockImplementation(globals_1.jest.fn());
        jwtMock.sign.mockReturnValue('mocked-jwt-token');
        return jwtMock;
    }
    /**
     * 创建UserStateService Mock
     * 统一用户状态服务的Mock行为
     */
    static createUserStateServiceMock() {
        return {
            getUserCurrentRoom: globals_1.jest.fn(),
            setUserCurrentRoom: globals_1.jest.fn(),
            clearUserCurrentRoom: globals_1.jest.fn(),
            forceLeaveCurrentRoom: globals_1.jest.fn(),
            cleanupOrphanedUserStates: globals_1.jest.fn(),
            isUserInRoom: globals_1.jest.fn(),
            getUsersInRoom: globals_1.jest.fn(),
            checkAndHandleRoomConflict: globals_1.jest.fn()
        };
    }
    /**
     * 创建ValidationMiddleware Mock
     */
    static createValidationMiddlewareMock() {
        return {
            validateRoomJoin: globals_1.jest.fn(),
            validatePlayerAction: globals_1.jest.fn(),
            validateMessageRate: globals_1.jest.fn(),
            cleanup: globals_1.jest.fn(),
            isRateLimited: globals_1.jest.fn()
        };
    }
    /**
     * 创建bcrypt加密库Mock
     */
    static createBcryptMock() {
        return {
            compare: globals_1.jest.fn(),
            hash: globals_1.jest.fn(),
            genSalt: globals_1.jest.fn()
        };
    }
    /**
     * 创建回调函数Mock
     * 用于测试Socket事件的回调
     */
    static createCallbackMock() {
        return globals_1.jest.fn();
    }
    /**
     * 重置所有Mock对象的调用历史
     * 用于测试间的清理
     */
    static resetAllMocks(...mocks) {
        mocks.forEach(mock => {
            if (mock && typeof mock === 'object') {
                Object.values(mock).forEach((method) => {
                    if (typeof (method === null || method === void 0 ? void 0 : method.mockReset) === 'function') {
                        method.mockReset();
                    }
                });
            }
        });
        globals_1.jest.clearAllMocks();
    }
    /**
     * 批量创建常用Mock对象的组合
     * 为单元测试提供完整的Mock环境
     */
    static createRoomHandlerMocks() {
        const mocks = {
            prisma: this.createPrismaMock(),
            redis: this.createRedisMock(),
            socket: this.createSocketMock(),
            io: this.createIOMock(),
            userStateService: this.createUserStateServiceMock(),
            validationMiddleware: this.createValidationMiddlewareMock(),
            bcrypt: this.createBcryptMock(),
            callback: this.createCallbackMock()
        };
        // Inject bcrypt into socket for compatibility
        mocks.socket.bcrypt = mocks.bcrypt;
        return mocks;
    }
    /**
     * 批量创建系统Handler测试所需的Mock对象
     */
    static createSystemHandlerMocks() {
        return {
            socket: this.createSocketMock(),
            io: this.createIOMock(),
            userStateService: this.createUserStateServiceMock(),
            redis: this.createRedisMock(),
            validationMiddleware: this.createValidationMiddlewareMock(),
            callback: this.createCallbackMock()
        };
    }
    /**
     * 创建Express应用Mock对象
     * 用于API路由测试
     */
    static createExpressMocks() {
        return {
            request: {
                body: {},
                params: {},
                query: {},
                headers: {},
                user: {
                    id: 'test-user-id',
                    username: 'testuser'
                }
            },
            response: {
                status: globals_1.jest.fn().mockReturnThis(),
                json: globals_1.jest.fn().mockReturnThis(),
                send: globals_1.jest.fn().mockReturnThis(),
                cookie: globals_1.jest.fn().mockReturnThis(),
                clearCookie: globals_1.jest.fn().mockReturnThis()
            },
            next: globals_1.jest.fn()
        };
    }
    /**
     * 创建Auth相关Mock对象
     * 包含JWT和bcrypt Mock
     */
    static createAuthMocks() {
        return {
            prisma: this.createPrismaMock(),
            jwt: this.createJWTMock(),
            bcrypt: this.createBcryptMock(),
            express: this.createExpressMocks()
        };
    }
    /**
     * 创建游戏Handler测试所需的Mock对象
     */
    static createGameHandlerMocks() {
        return {
            socket: this.createSocketMock(),
            io: this.createIOMock(),
            prisma: this.createPrismaMock(),
            redis: this.createRedisMock(),
            userStateService: this.createUserStateServiceMock(),
            validationMiddleware: this.createValidationMiddlewareMock(),
            callback: this.createCallbackMock()
        };
    }
    /**
     * 创建通用服务层Mock对象
     */
    static createServiceMocks() {
        return {
            redis: this.createRedisMock(),
            prisma: this.createPrismaMock(),
            logger: {
                info: globals_1.jest.fn(),
                error: globals_1.jest.fn(),
                warn: globals_1.jest.fn(),
                debug: globals_1.jest.fn()
            }
        };
    }
}
exports.MockFactory = MockFactory;
/**
 * Mock配置工具类
 * 提供常见的Mock配置模式
 */
class MockConfigurationHelper {
    /**
     * 配置Prisma Mock返回特定的用户数据
     */
    static configurePrismaUserMock(prismaMock, userData) {
        prismaMock.user.findUnique.mockResolvedValue(userData);
        prismaMock.user.create.mockResolvedValue(userData);
        return prismaMock;
    }
    /**
     * 配置Prisma Mock返回特定的房间数据
     */
    static configurePrismaRoomMock(prismaMock, roomData) {
        prismaMock.room.findUnique.mockResolvedValue(roomData);
        prismaMock.room.create.mockResolvedValue(roomData);
        prismaMock.room.findMany.mockResolvedValue([roomData]);
        return prismaMock;
    }
    /**
     * 配置Redis Mock返回特定的房间状态
     */
    static configureRedisRoomStateMock(redisMock, roomState) {
        redisMock.get.mockResolvedValue(roomState);
        redisMock.setEx.mockResolvedValue('OK');
        return redisMock;
    }
    /**
     * 配置UserStateService Mock的用户状态
     */
    static configureUserStateMock(userStateServiceMock, currentRoom) {
        userStateServiceMock.getUserCurrentRoom.mockResolvedValue(currentRoom);
        return userStateServiceMock;
    }
}
exports.MockConfigurationHelper = MockConfigurationHelper;
