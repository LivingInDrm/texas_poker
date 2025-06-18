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
// 测试环境设置文件
const db_1 = require("../src/db");
// 设置全局测试超时
jest.setTimeout(30000);
// 全局测试前设置
beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
    // 确保Redis连接正常
    try {
        if (!db_1.redisClient.isOpen) {
            yield db_1.redisClient.connect();
        }
    }
    catch (error) {
        console.warn('Redis connection failed in test setup:', error);
    }
}));
// 全局测试后清理
afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
    // 清理所有测试数据
    try {
        if (db_1.redisClient.isOpen) {
            const keys = yield db_1.redisClient.keys('test:*');
            if (keys.length > 0) {
                yield db_1.redisClient.del(keys);
            }
            yield db_1.redisClient.disconnect();
        }
    }
    catch (error) {
        console.warn('Failed to cleanup Redis in global teardown:', error);
    }
}));
// 捕获未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
    console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});
// 捕获未处理的异常
process.on('uncaughtException', (error) => {
    console.warn('Uncaught Exception:', error);
});
