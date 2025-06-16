// 健康检查脚本
import { redisClient } from './db';
import prisma from './prisma';

async function healthCheck() {
  try {
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`;
    
    // 检查Redis连接
    await redisClient.ping();
    
    console.log('Health check passed');
    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

healthCheck();