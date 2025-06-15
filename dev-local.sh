#!/bin/bash

# Texas Poker 本地开发环境管理脚本（不使用Docker）
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

# 检查依赖
check_dependencies() {
    # 检查Node.js
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    # 检查npm
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm 未安装"
        exit 1
    fi
    
    # 检查Docker服务（PostgreSQL和Redis）
    if ! docker ps | grep -q "texas_poker_postgres"; then
        log_error "PostgreSQL 容器未运行，请先运行: docker-compose up -d postgres redis"
        exit 1
    fi
    
    if ! docker ps | grep -q "texas_poker_redis"; then
        log_error "Redis 容器未运行，请先运行: docker-compose up -d postgres redis"
        exit 1
    fi
}

# 安装依赖
install_deps() {
    log_info "📦 安装项目依赖..."
    
    # 安装后端依赖
    if [ -f "backend/package.json" ]; then
        log_info "安装后端依赖..."
        cd backend && npm install && cd ..
        log_success "后端依赖安装完成"
    fi
    
    # 安装前端依赖
    if [ -f "frontend/package.json" ]; then
        log_info "安装前端依赖..."
        cd frontend && npm install && cd ..
        log_success "前端依赖安装完成"
    fi
}

# 启动数据库服务
start_db() {
    log_info "🗄️  启动数据库服务..."
    docker-compose up -d postgres redis
    
    # 等待数据库启动
    log_info "等待数据库启动..."
    sleep 5
    
    # 检查数据库连接
    if docker-compose exec postgres pg_isready -U postgres > /dev/null 2>&1; then
        log_success "PostgreSQL 启动成功"
    else
        log_error "PostgreSQL 启动失败"
        exit 1
    fi
    
    if docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
        log_success "Redis 启动成功"
    else
        log_error "Redis 启动失败"
        exit 1
    fi
}

# 停止本地进程
stop_local() {
    log_info "🛑 停止本地开发服务器..."
    
    # 停止后端进程
    BACKEND_PID=$(lsof -ti :3001 2>/dev/null || echo "")
    if [ ! -z "$BACKEND_PID" ]; then
        log_info "停止后端进程..."
        kill -TERM $BACKEND_PID 2>/dev/null || true
    fi
    
    # 停止前端进程
    FRONTEND_PID=$(lsof -ti :5173 2>/dev/null || echo "")
    if [ ! -z "$FRONTEND_PID" ]; then
        log_info "停止前端进程..."
        kill -TERM $FRONTEND_PID 2>/dev/null || true
    fi
    
    # 停止nodemon进程
    pkill -f "nodemon" 2>/dev/null || true
    pkill -f "ts-node" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    sleep 2
    log_success "本地服务已停止"
}

# 启动开发环境
start_local() {
    log_info "🚀 启动本地开发环境..."
    check_dependencies
    stop_local
    
    # 确保数据库运行
    start_db
    
    # 启动后端
    log_info "启动后端服务器..."
    cd backend
    npm run dev > ../backend_dev.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    echo $BACKEND_PID > .backend.pid
    
    # 启动前端
    log_info "启动前端服务器..."
    cd frontend
    npm run dev > ../frontend_dev.log 2>&1 &
    FRONTEND_PID=$!
    cd ..
    echo $FRONTEND_PID > .frontend.pid
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 5
    
    # 检查服务状态
    check_local_services
    
    log_success "本地开发环境启动完成"
    show_local_urls
}

# 检查本地服务状态
check_local_services() {
    log_info "检查服务状态..."
    
    # 检查后端
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        log_success "Backend: 运行正常 (PID: $(cat .backend.pid 2>/dev/null || echo 'Unknown'))"
    else
        log_warning "Backend: 启动中或连接失败"
    fi
    
    # 检查前端
    if curl -f http://localhost:5173 > /dev/null 2>&1; then
        log_success "Frontend: 运行正常 (PID: $(cat .frontend.pid 2>/dev/null || echo 'Unknown'))"
    else
        log_warning "Frontend: 启动中或连接失败"
    fi
    
    # 检查数据库
    if docker-compose exec postgres pg_isready -U postgres > /dev/null 2>&1; then
        log_success "PostgreSQL: 运行正常"
    else
        log_error "PostgreSQL: 连接失败"
    fi
    
    if docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
        log_success "Redis: 运行正常"
    else
        log_error "Redis: 连接失败"
    fi
}

# 显示状态
status_local() {
    log_info "📊 本地开发环境状态"
    echo
    
    # 显示进程状态
    echo "进程状态:"
    BACKEND_PID=$(cat .backend.pid 2>/dev/null || echo "")
    FRONTEND_PID=$(cat .frontend.pid 2>/dev/null || echo "")
    
    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        echo "  Backend:  运行中 (PID: $BACKEND_PID)"
    else
        echo "  Backend:  未运行"
    fi
    
    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "  Frontend: 运行中 (PID: $FRONTEND_PID)"
    else
        echo "  Frontend: 未运行"
    fi
    
    echo
    echo "Docker 服务:"
    docker-compose ps
    echo
    check_local_services
}

# 显示日志
logs_local() {
    case "${2:-all}" in
        backend)
            log_info "📜 显示后端日志..."
            tail -f backend_dev.log 2>/dev/null || echo "后端日志文件不存在"
            ;;
        frontend)
            log_info "📜 显示前端日志..."
            tail -f frontend_dev.log 2>/dev/null || echo "前端日志文件不存在"
            ;;
        all|*)
            log_info "📜 显示所有日志..."
            echo "=== 后端日志 ==="
            tail -n 20 backend_dev.log 2>/dev/null || echo "后端日志文件不存在"
            echo
            echo "=== 前端日志 ==="
            tail -n 20 frontend_dev.log 2>/dev/null || echo "前端日志文件不存在"
            ;;
    esac
}

# 显示访问URLs
show_local_urls() {
    echo
    log_success "🌐 本地开发环境已启动，访问地址："
    echo "  📱 前端应用: http://localhost:5173"
    echo "  🔧 后端API: http://localhost:3001"
    echo "  🗄️  数据库: postgresql://postgres:password@localhost:5432/texas_poker"
    echo "  🔴 Redis: redis://localhost:6379"
    echo
    log_info "📝 常用命令："
    echo "  查看状态: ./dev-local.sh status"
    echo "  查看日志: ./dev-local.sh logs [backend|frontend]"
    echo "  停止服务: ./dev-local.sh stop"
}

# 测试连接
test_local() {
    log_info "🧪 测试服务连接..."
    
    # 测试后端
    log_info "测试后端连接..."
    if curl -f http://localhost:3001/health; then
        log_success "后端连接正常"
    else
        log_error "后端连接失败"
    fi
    
    # 测试前端
    log_info "测试前端连接..."
    if curl -f http://localhost:5173 > /dev/null 2>&1; then
        log_success "前端连接正常"
    else
        log_error "前端连接失败"
    fi
    
    # 测试数据库
    log_info "测试数据库连接..."
    cd backend && npm run db:migrate > /dev/null 2>&1 && cd .. && log_success "数据库连接正常" || log_error "数据库连接失败"
}

# 显示帮助
show_help_local() {
    echo "Texas Poker 本地开发环境管理脚本"
    echo
    echo "用法: $0 <command>"
    echo
    echo "命令:"
    echo "  install    安装项目依赖"
    echo "  start      启动本地开发环境"
    echo "  stop       停止本地开发环境"
    echo "  restart    重启本地开发环境"
    echo "  status     显示服务状态"
    echo "  logs       显示日志 [backend|frontend|all]"
    echo "  test       测试服务连接"
    echo "  help       显示此帮助信息"
    echo
    echo "示例:"
    echo "  $0 start              # 启动本地开发环境"
    echo "  $0 logs backend       # 查看后端日志"
    echo "  $0 test               # 测试连接"
}

# 主函数
main() {
    case "${1:-help}" in
        install)
            install_deps
            ;;
        start)
            start_local
            ;;
        stop)
            stop_local
            ;;
        restart)
            stop_local
            start_local
            ;;
        status)
            status_local
            ;;
        logs)
            logs_local "$@"
            ;;
        test)
            test_local
            ;;
        help|--help|-h)
            show_help_local
            ;;
        *)
            log_error "未知命令: $1"
            show_help_local
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"