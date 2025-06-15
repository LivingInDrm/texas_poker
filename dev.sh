#!/bin/bash

# Texas Poker 开发环境管理脚本
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查Docker是否运行
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker 未运行，请先启动 Docker"
        exit 1
    fi
}

# 停止本地进程
stop_local_processes() {
    log_info "停止本地运行的前后端进程..."
    
    # 停止后端进程 (端口3001)
    BACKEND_PID=$(lsof -ti :3001 2>/dev/null || echo "")
    if [ ! -z "$BACKEND_PID" ]; then
        log_info "停止后端进程 (PID: $BACKEND_PID)"
        kill -TERM $BACKEND_PID 2>/dev/null || true
        sleep 2
        # 如果进程仍在运行，强制杀死
        if kill -0 $BACKEND_PID 2>/dev/null; then
            kill -KILL $BACKEND_PID 2>/dev/null || true
        fi
    fi
    
    # 停止前端进程 (端口5173)
    FRONTEND_PID=$(lsof -ti :5173 2>/dev/null || echo "")
    if [ ! -z "$FRONTEND_PID" ]; then
        log_info "停止前端进程 (PID: $FRONTEND_PID)"
        kill -TERM $FRONTEND_PID 2>/dev/null || true
        sleep 2
        # 如果进程仍在运行，强制杀死
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            kill -KILL $FRONTEND_PID 2>/dev/null || true
        fi
    fi
    
    # 停止可能的nodemon进程
    pkill -f "nodemon" 2>/dev/null || true
    pkill -f "ts-node" 2>/dev/null || true
    
    log_success "本地进程已停止"
}

# 构建开发环境
build_dev() {
    log_info "🔨 构建开发环境..."
    check_docker
    stop_local_processes
    
    log_info "构建Docker镜像..."
    docker-compose build --no-cache
    
    log_success "开发环境构建完成"
}

# 启动开发环境
start_dev() {
    log_info "🚀 启动开发环境..."
    check_docker
    stop_local_processes
    
    # 启动所有服务
    log_info "启动 Docker 服务..."
    docker-compose up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 10
    
    # 检查服务状态
    check_services
    
    log_success "开发环境启动完成"
    show_urls
}

# 停止开发环境
stop_dev() {
    log_info "🛑 停止开发环境..."
    
    # 停止Docker服务
    docker-compose down
    
    # 停止本地进程
    stop_local_processes
    
    log_success "开发环境已停止"
}

# 重启开发环境
restart_dev() {
    log_info "🔄 重启开发环境..."
    stop_dev
    start_dev
}

# 重建并重启
rebuild_dev() {
    log_info "🔄 重建并重启开发环境..."
    stop_dev
    build_dev
    start_dev
}

# 检查服务状态
check_services() {
    log_info "检查服务状态..."
    
    # 检查PostgreSQL
    if docker-compose exec postgres pg_isready -U postgres > /dev/null 2>&1; then
        log_success "PostgreSQL: 运行正常"
    else
        log_error "PostgreSQL: 连接失败"
    fi
    
    # 检查Redis
    if docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
        log_success "Redis: 运行正常"
    else
        log_error "Redis: 连接失败"
    fi
    
    # 检查后端
    sleep 5
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        log_success "Backend: 运行正常"
    else
        log_warning "Backend: 启动中或连接失败"
    fi
    
    # 检查前端
    if curl -f http://localhost:5173 > /dev/null 2>&1; then
        log_success "Frontend: 运行正常"
    else
        log_warning "Frontend: 启动中或连接失败"
    fi
}

# 显示状态
status_dev() {
    log_info "📊 开发环境状态"
    echo
    docker-compose ps
    echo
    check_services
}

# 显示日志
logs_dev() {
    if [ -z "$2" ]; then
        log_info "📜 显示所有服务日志..."
        docker-compose logs -f
    else
        log_info "📜 显示 $2 服务日志..."
        docker-compose logs -f "$2"
    fi
}

# 显示访问URLs
show_urls() {
    echo
    log_success "🌐 开发环境已启动，访问地址："
    echo "  📱 前端应用: http://localhost:5173"
    echo "  🔧 后端API: http://localhost:3001"
    echo "  🗄️  数据库: postgresql://postgres:password@localhost:5432/texas_poker"
    echo "  🔴 Redis: redis://localhost:6379"
    echo
    log_info "📝 常用命令："
    echo "  查看状态: ./dev.sh status"
    echo "  查看日志: ./dev.sh logs [service]"
    echo "  重启服务: ./dev.sh restart"
    echo "  停止服务: ./dev.sh stop"
}

# 进入容器
shell_dev() {
    if [ -z "$2" ]; then
        log_error "请指定服务名称: backend, frontend, postgres, redis"
        exit 1
    fi
    
    service="$2"
    case $service in
        backend|frontend)
            log_info "进入 $service 容器..."
            docker-compose exec "$service" /bin/sh
            ;;
        postgres)
            log_info "进入 PostgreSQL 容器..."
            docker-compose exec postgres psql -U postgres -d texas_poker
            ;;
        redis)
            log_info "进入 Redis 容器..."
            docker-compose exec redis redis-cli
            ;;
        *)
            log_error "未知服务: $service"
            exit 1
            ;;
    esac
}

# 清理开发环境
clean_dev() {
    log_warning "⚠️  这将删除所有容器、镜像和数据卷"
    read -p "确认继续？(y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        log_info "🧹 清理开发环境..."
        docker-compose down -v --rmi all
        docker system prune -f
        log_success "清理完成"
    else
        log_info "取消清理"
    fi
}

# 显示帮助
show_help() {
    echo "Texas Poker 开发环境管理脚本"
    echo
    echo "用法: $0 <command> [options]"
    echo
    echo "命令:"
    echo "  build      构建开发环境"
    echo "  start      启动开发环境"
    echo "  stop       停止开发环境"
    echo "  restart    重启开发环境"
    echo "  rebuild    重建并重启开发环境"
    echo "  status     显示服务状态"
    echo "  logs       显示日志 [service]"
    echo "  shell      进入容器 <service>"
    echo "  clean      清理开发环境"
    echo "  help       显示此帮助信息"
    echo
    echo "示例:"
    echo "  $0 start              # 启动开发环境"
    echo "  $0 logs backend       # 查看后端日志"
    echo "  $0 shell postgres     # 进入数据库"
    echo "  $0 rebuild            # 重建并重启"
}

# 主函数
main() {
    case "${1:-help}" in
        build)
            build_dev
            ;;
        start|up)
            start_dev
            ;;
        stop|down)
            stop_dev
            ;;
        restart)
            restart_dev
            ;;
        rebuild)
            rebuild_dev
            ;;
        status|ps)
            status_dev
            ;;
        logs)
            logs_dev "$@"
            ;;
        shell|exec)
            shell_dev "$@"
            ;;
        clean)
            clean_dev
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"