// 测试环境设置文件
import { redisClient } from '../../src/db';

// 设置全局测试超时
jest.setTimeout(30000);

// 全局测试前设置
beforeAll(async () => {
  // 确保Redis连接正常
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.warn('Redis connection failed in test setup:', error);
  }
});

// 全局测试后清理
afterAll(async () => {
  // 清理所有测试数据
  try {
    if (redisClient.isOpen) {
      const keys = await redisClient.keys('test:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      await redisClient.disconnect();
    }
  } catch (error) {
    console.warn('Failed to cleanup Redis in global teardown:', error);
  }
});

// 捕获未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  console.warn('Uncaught Exception:', error);
});