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
exports.AsyncEventTestUtils = exports.HandlerTestUtils = exports.SocketTestHelper = void 0;
exports.createMockAuthenticatedSocket = createMockAuthenticatedSocket;
exports.createSocketResponse = createSocketResponse;
exports.createTestJWTToken = createTestJWTToken;
exports.createMockCallback = createMockCallback;
exports.expectValidSocketResponse = expectValidSocketResponse;
/**
 * 创建用于测试的AuthenticatedSocket Mock对象
 */
function createMockAuthenticatedSocket(userData = {}) {
    const defaultData = Object.assign({ userId: 'test-user-id', username: 'test-user', authenticated: true, roomId: undefined }, userData);
    // Create an event emitter-like mock
    const eventHandlers = new Map();
    const clientEmitSpy = jest.fn(); // Spy for client-bound emissions
    const mockSocket = {
        data: defaultData,
        id: 'mock-socket-id',
        connected: true,
        recovered: false,
        handshake: {
            auth: {},
            headers: {},
            query: {},
            address: 'localhost',
            time: new Date().toISOString(),
            secure: false,
            url: '/',
            xdomain: false,
            issued: Date.now()
        },
        emit: jest.fn().mockImplementation((event, ...args) => __awaiter(this, void 0, void 0, function* () {
            // Check if this is a client-to-server event (has handlers registered)
            if (eventHandlers.has(event)) {
                // Trigger the registered handlers for this event
                const handlers = eventHandlers.get(event);
                for (const handler of handlers) {
                    try {
                        yield handler(...args);
                    }
                    catch (error) {
                        // Log minimal error to avoid console.error recursion
                        if (process.env.NODE_ENV !== 'test') {
                            console.error(`Handler error for ${event}:`, error instanceof Error ? error.message : 'Unknown error');
                        }
                    }
                }
            }
            else {
                // Server-to-client emission - use client spy
                clientEmitSpy(event, ...args);
            }
            return true;
        })),
        _clientEmitSpy: clientEmitSpy, // Expose for testing
        _eventHandlers: eventHandlers, // Expose for testing
        emitWithAck: jest.fn(),
        on: jest.fn().mockImplementation((event, handler) => {
            if (!eventHandlers.has(event)) {
                eventHandlers.set(event, []);
            }
            eventHandlers.get(event).push(handler);
        }),
        once: jest.fn(),
        off: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        to: jest.fn().mockReturnValue({
            emit: jest.fn()
        }),
        in: jest.fn().mockReturnThis(),
        except: jest.fn().mockReturnThis(),
        broadcast: jest.fn().mockReturnValue({
            emit: jest.fn()
        }),
        disconnect: jest.fn(),
        send: jest.fn(),
        write: jest.fn(),
        timeout: jest.fn().mockReturnThis(),
        compress: jest.fn().mockReturnThis(),
        volatile: jest.fn().mockReturnThis(),
        binary: jest.fn().mockReturnThis(),
        local: jest.fn().mockReturnThis(),
        rooms: new Set(),
        request: {},
        conn: {},
        client: {},
        nsp: {},
        adapter: {},
        server: {},
        listeners: jest.fn(),
        removeAllListeners: jest.fn(),
        eventNames: jest.fn(),
        listenerCount: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        prependListener: jest.fn(),
        prependOnceListener: jest.fn(),
        setMaxListeners: jest.fn(),
        getMaxListeners: jest.fn(),
        rawListeners: jest.fn(),
        // 添加缺失的属性和方法
        disconnected: false,
        use: jest.fn(),
        flags: {},
        acks: new Map(),
        fns: [],
        // Mock外部注入的服务
        prisma: {},
        redis: {},
        userStateService: {},
        validationMiddleware: {},
        io: {}
    };
    return mockSocket;
}
/**
 * 创建标准的Socket响应对象
 */
function createSocketResponse(success = true, data, message, error) {
    return {
        success,
        data,
        message,
        error
    };
}
/**
 * 创建测试用的JWT Token
 */
function createTestJWTToken(userId = 'test-user', username = 'testuser') {
    // 这里返回一个模拟的token，在测试中jwt.verify会被mock
    return `test-token-${userId}`;
}
/**
 * 模拟Socket事件回调函数
 */
function createMockCallback() {
    return jest.fn();
}
/**
 * 验证Socket响应格式是否正确
 */
function expectValidSocketResponse(response, expectedSuccess = true) {
    expect(response).toHaveProperty('success');
    expect(response.success).toBe(expectedSuccess);
    if (expectedSuccess) {
        expect(response).toHaveProperty('data');
    }
    else {
        expect(response).toHaveProperty('error');
    }
}
/**
 * Socket事件测试辅助工具类
 * 扩展原有功能，添加更多测试工具
 */
class SocketTestHelper {
    /**
     * 验证Socket.emit被调用
     */
    static expectSocketEmit(socket, event, data) {
        // Use the client emit spy to check server-to-client emissions
        const clientEmitSpy = socket._clientEmitSpy;
        if (data !== undefined) {
            expect(clientEmitSpy).toHaveBeenCalledWith(event, data);
        }
        else {
            expect(clientEmitSpy).toHaveBeenCalledWith(expect.stringMatching(event), expect.anything());
        }
    }
    /**
     * 验证Socket.join被调用
     */
    static expectSocketJoin(socket, roomId) {
        expect(socket.join).toHaveBeenCalledWith(roomId);
    }
    /**
     * 验证Socket.leave被调用
     */
    static expectSocketLeave(socket, roomId) {
        expect(socket.leave).toHaveBeenCalledWith(roomId);
    }
    /**
     * 验证Socket.to().emit被调用
     */
    static expectSocketBroadcast(socket, roomId, event, data) {
        var _a;
        expect(socket.to).toHaveBeenCalledWith(roomId);
        // Get the broadcast mock that was returned by socket.to()
        const toMock = socket.to;
        // The broadcast object should have had emit called on it
        const broadcastMock = (_a = toMock.mock.results[toMock.mock.results.length - 1]) === null || _a === void 0 ? void 0 : _a.value;
        if (broadcastMock && typeof broadcastMock.emit === 'function') {
            // Convert to jest mock if it isn't already
            const emitSpy = broadcastMock.emit;
            if (data !== undefined) {
                expect(emitSpy).toHaveBeenCalledWith(event, data);
            }
            else {
                expect(emitSpy).toHaveBeenCalledWith(event, expect.anything());
            }
        }
        else {
            // Fallback: just check that socket.to was called with correct room
            expect(socket.to).toHaveBeenCalledWith(roomId);
        }
    }
    /**
     * 验证回调函数被正确调用
     */
    static expectCallbackCalledWith(callback, expectedResponse) {
        expect(callback).toHaveBeenCalledWith(expect.objectContaining(expectedResponse));
    }
    /**
     * 验证成功的回调响应
     */
    static expectSuccessCallback(callback, expectedData, expectedMessage) {
        const expectedResponse = {
            success: true
        };
        if (expectedData !== undefined) {
            expectedResponse.data = expectedData;
        }
        if (expectedMessage) {
            expectedResponse.message = expectedMessage;
        }
        this.expectCallbackCalledWith(callback, expectedResponse);
    }
    /**
     * 验证失败的回调响应
     */
    static expectErrorCallback(callback, expectedError, expectedMessage) {
        const expectedResponse = {
            success: false
        };
        if (expectedError) {
            expectedResponse.error = expectedError;
        }
        if (expectedMessage) {
            expectedResponse.message = expectedMessage;
        }
        this.expectCallbackCalledWith(callback, expectedResponse);
    }
    /**
     * 重置Socket Mock的调用历史
     */
    static resetSocketMock(socket) {
        socket.emit.mockClear();
        socket.join.mockClear();
        socket.leave.mockClear();
        socket.to.mockClear();
        socket.on.mockClear();
    }
    /**
     * 配置Socket Mock的房间状态
     */
    static setSocketRoomId(socket, roomId) {
        socket.data.roomId = roomId;
        if (roomId) {
            socket.rooms.add(roomId);
        }
    }
    /**
     * 模拟Socket连接状态
     */
    static setSocketConnected(socket, connected = true) {
        socket.connected = connected;
    }
}
exports.SocketTestHelper = SocketTestHelper;
/**
 * Socket事件处理器测试工具
 * 专门用于测试Socket事件处理器函数
 */
class HandlerTestUtils {
    /**
     * 测试处理器函数的标准模式
     */
    static testHandler(handler_1, socket_1, eventData_1, callback_1) {
        return __awaiter(this, arguments, void 0, function* (handler, socket, eventData, callback, expectSuccess = true) {
            yield handler(socket, eventData, callback);
            expect(callback).toHaveBeenCalledTimes(1);
            const callResponse = callback.mock.calls[0][0];
            expect(callResponse).toHaveProperty('success', expectSuccess);
            if (expectSuccess) {
                expect(callResponse).toHaveProperty('data');
            }
            else {
                expect(callResponse).toHaveProperty('error');
            }
        });
    }
    /**
     * 批量测试错误场景
     */
    static testErrorScenarios(handler, socket, errorScenarios) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const scenario of errorScenarios) {
                const callback = createMockCallback();
                if (scenario.setup) {
                    scenario.setup();
                }
                yield handler(socket, scenario.eventData, callback);
                expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                    success: false,
                    error: scenario.expectedError ?
                        expect.stringContaining(scenario.expectedError) :
                        expect.any(String)
                }));
            }
        });
    }
}
exports.HandlerTestUtils = HandlerTestUtils;
/**
 * 异步事件测试工具
 */
class AsyncEventTestUtils {
    /**
     * 等待异步Socket事件完成
     */
    static waitForSocketEvent(socket_1, eventName_1) {
        return __awaiter(this, arguments, void 0, function* (socket, eventName, timeout = 1000) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error(`Socket event ${eventName} not emitted within ${timeout}ms`));
                }, timeout);
                const originalEmit = socket.emit;
                socket.emit.mockImplementation((event, ...args) => {
                    if (event === eventName) {
                        clearTimeout(timer);
                        resolve(args);
                    }
                    return originalEmit.call(socket, event, ...args);
                });
            });
        });
    }
    /**
     * 等待回调函数被调用
     */
    static waitForCallback(callback_1) {
        return __awaiter(this, arguments, void 0, function* (callback, timeout = 1000) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error(`Callback not called within ${timeout}ms`));
                }, timeout);
                const checkCallback = () => {
                    if (callback.mock.calls.length > 0) {
                        clearTimeout(timer);
                        resolve(callback.mock.calls[0][0]);
                    }
                    else {
                        setTimeout(checkCallback, 10);
                    }
                };
                checkCallback();
            });
        });
    }
}
exports.AsyncEventTestUtils = AsyncEventTestUtils;
