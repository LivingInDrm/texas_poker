#!/bin/bash

# Texas Poker 生产环境部署脚本
set -e

echo "🚀 开始部署 Texas Poker 应用..."

# 检查必需的文件
if [ ! -f ".env.prod" ]; then
    echo "❌ 错误：.env.prod 文件不存在"
    echo "请复制 .env.prod.example 为 .env.prod 并配置相应的环境变量"
    exit 1
fi

# 加载环境变量
source .env.prod

# 验证必需的环境变量
required_vars=("POSTGRES_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ 错误：环境变量 $var 未设置"
        exit 1
    fi
done

echo "✅ 环境变量验证通过"

# 停止现有容器
echo "🛑 停止现有容器..."
docker-compose -f docker-compose.prod.yml down || true

# 清理旧镜像（可选）
read -p "是否清理旧的Docker镜像？(y/N): " cleanup
if [[ $cleanup =~ ^[Yy]$ ]]; then
    echo "🧹 清理旧镜像..."
    docker system prune -f
fi

# 构建新镜像
echo "🔨 构建应用镜像..."
docker-compose -f docker-compose.prod.yml build --no-cache

# 运行数据库迁移
echo "📊 运行数据库迁移..."
docker-compose -f docker-compose.prod.yml run --rm backend npm run db:migrate

# 启动服务
echo "🚀 启动生产环境服务..."
docker-compose -f docker-compose.prod.yml up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 健康检查
echo "🏥 执行健康检查..."
if docker-compose -f docker-compose.prod.yml exec backend node dist/healthcheck.js; then
    echo "✅ 后端健康检查通过"
else
    echo "❌ 后端健康检查失败"
    exit 1
fi

if curl -f http://localhost:${FRONTEND_PORT:-80}/health; then
    echo "✅ 前端健康检查通过"
else
    echo "❌ 前端健康检查失败"
    exit 1
fi

# 显示服务状态
echo "📊 服务状态："
docker-compose -f docker-compose.prod.yml ps

echo "🎉 部署完成！"
echo "🌐 应用访问地址: http://localhost:${FRONTEND_PORT:-80}"
echo "📊 服务监控: docker-compose -f docker-compose.prod.yml logs -f"

# 可选：设置自动备份
read -p "是否设置数据库自动备份？(y/N): " backup
if [[ $backup =~ ^[Yy]$ ]]; then
    echo "设置数据库备份..."
    # 这里可以添加备份脚本的设置
    echo "请手动配置 crontab 以定期备份数据库"
fi