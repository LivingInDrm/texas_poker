// 健康检查脚本
import { createConnection } from './db';
import prisma from './prisma';

async function healthCheck() {
  try {
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`;
    
    // 检查Redis连接
    const redis = createConnection();
    await redis.ping();
    await redis.disconnect();
    
    console.log('Health check passed');
    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

healthCheck();