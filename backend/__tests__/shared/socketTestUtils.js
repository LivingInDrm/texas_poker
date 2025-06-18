"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    return {
        data: defaultData,
        id: 'mock-socket-id',
        connected: true,
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
        emit: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        off: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        to: jest.fn().mockReturnThis(),
        broadcast: jest.fn().mockReturnThis(),
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
        rawListeners: jest.fn()
    };
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
