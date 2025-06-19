#!/bin/bash

# Texas Poker 统一测试执行脚本 v2.4
# 基于新的测试目录架构: api/game/middleware/realtime/services/shared/legacy
# 遵循BACKEND_TESTING_GUIDE.md规范
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志目录配置
LOG_DIR="test-logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
CURRENT_LOG_DIR="$LOG_DIR/$TIMESTAMP"

# 创建日志目录
setup_logging() {
    mkdir -p "$CURRENT_LOG_DIR"
    log_info "📁 日志目录已创建: $CURRENT_LOG_DIR"
    
    # 创建符号链接指向最新的日志
    if [ -L "$LOG_DIR/latest" ]; then
        rm "$LOG_DIR/latest"
    fi
    ln -sf "$TIMESTAMP" "$LOG_DIR/latest"
}

# 清理旧日志（保留最近5次）
cleanup_old_logs() {
    if [ -d "$LOG_DIR" ]; then
        local log_count=$(ls -1 "$LOG_DIR" | grep -E "^[0-9]{8}_[0-9]{6}$" | wc -l)
        if [ "$log_count" -gt 5 ]; then
            log_info "🧹 清理旧日志文件（保留最近5次）..."
            ls -1t "$LOG_DIR" | grep -E "^[0-9]{8}_[0-9]{6}$" | tail -n +6 | while read old_dir; do
                rm -rf "$LOG_DIR/$old_dir"
                log_info "已删除旧日志: $old_dir"
            done
        fi
    fi
}

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

# 测试结果统计
TESTS_PASSED=0
TESTS_FAILED=0
TEST_SUMMARY=""

# 详细模块测试统计变量
# 后端统计变量 - 改进版：区分三种文件状态
# 游戏引擎测试
BACKEND_GAME_FILES=0
BACKEND_GAME_FILES_PASSED=0         # 文件中所有测试都通过
BACKEND_GAME_FILES_FAILED=0         # 文件中有测试失败（但能运行）
BACKEND_GAME_FILES_ERROR=0          # 文件无法运行（编译错误等）
BACKEND_GAME_TESTS=0
BACKEND_GAME_TESTS_PASSED=0
BACKEND_GAME_TESTS_FAILED=0
BACKEND_GAME_TESTS_SKIPPED=0

# API接口测试
BACKEND_API_FILES=0
BACKEND_API_FILES_PASSED=0
BACKEND_API_FILES_FAILED=0
BACKEND_API_FILES_ERROR=0
BACKEND_API_TESTS=0
BACKEND_API_TESTS_PASSED=0
BACKEND_API_TESTS_FAILED=0
BACKEND_API_TESTS_SKIPPED=0

# 实时通信测试
BACKEND_REALTIME_FILES=0
BACKEND_REALTIME_FILES_PASSED=0
BACKEND_REALTIME_FILES_FAILED=0
BACKEND_REALTIME_FILES_ERROR=0
BACKEND_REALTIME_TESTS=0
BACKEND_REALTIME_TESTS_PASSED=0
BACKEND_REALTIME_TESTS_FAILED=0
BACKEND_REALTIME_TESTS_SKIPPED=0

# 中间件测试
BACKEND_MIDDLEWARE_FILES=0
BACKEND_MIDDLEWARE_FILES_PASSED=0
BACKEND_MIDDLEWARE_FILES_FAILED=0
BACKEND_MIDDLEWARE_FILES_ERROR=0
BACKEND_MIDDLEWARE_TESTS=0
BACKEND_MIDDLEWARE_TESTS_PASSED=0
BACKEND_MIDDLEWARE_TESTS_FAILED=0
BACKEND_MIDDLEWARE_TESTS_SKIPPED=0

# 服务层测试
BACKEND_SERVICES_FILES=0
BACKEND_SERVICES_FILES_PASSED=0
BACKEND_SERVICES_FILES_FAILED=0
BACKEND_SERVICES_FILES_ERROR=0
BACKEND_SERVICES_TESTS=0
BACKEND_SERVICES_TESTS_PASSED=0
BACKEND_SERVICES_TESTS_FAILED=0
BACKEND_SERVICES_TESTS_SKIPPED=0

# 后端总计
BACKEND_TOTAL_FILES=0
BACKEND_TOTAL_FILES_PASSED=0
BACKEND_TOTAL_FILES_FAILED=0
BACKEND_TOTAL_FILES_ERROR=0
BACKEND_TOTAL_TESTS=0
BACKEND_TOTAL_PASSED=0
BACKEND_TOTAL_FAILED=0
BACKEND_TOTAL_SKIPPED=0

# 前端统计变量
FRONTEND_COMPONENTS_FILES=0
FRONTEND_COMPONENTS_TESTS=0
FRONTEND_COMPONENTS_TESTS_PASSED=0
FRONTEND_COMPONENTS_TESTS_FAILED=0
FRONTEND_COMPONENTS_PASSED=0
FRONTEND_COMPONENTS_FAILED=0
FRONTEND_PAGES_FILES=0
FRONTEND_PAGES_TESTS=0
FRONTEND_PAGES_TESTS_PASSED=0
FRONTEND_PAGES_TESTS_FAILED=0
FRONTEND_PAGES_PASSED=0
FRONTEND_PAGES_FAILED=0
FRONTEND_HOOKS_FILES=0
FRONTEND_HOOKS_TESTS=0
FRONTEND_HOOKS_TESTS_PASSED=0
FRONTEND_HOOKS_TESTS_FAILED=0
FRONTEND_HOOKS_PASSED=0
FRONTEND_HOOKS_FAILED=0
FRONTEND_SERVICES_FILES=0
FRONTEND_SERVICES_TESTS=0
FRONTEND_SERVICES_TESTS_PASSED=0
FRONTEND_SERVICES_TESTS_FAILED=0
FRONTEND_SERVICES_PASSED=0
FRONTEND_SERVICES_FAILED=0
FRONTEND_TOTAL_FILES=0
FRONTEND_TOTAL_TESTS=0
FRONTEND_TOTAL_PASSED=0
FRONTEND_TOTAL_FAILED=0

# E2E统计变量
E2E_FILES=0
E2E_TESTS=0

# 安全获取数字的辅助函数
safe_number() {
    local value="$1"
    # 移除空白字符并检查是否为数字
    value=$(echo "$value" | tr -d '\n\r\t ' | head -1)
    if [[ "$value" =~ ^[0-9]+$ ]]; then
        echo "$value"
    else
        echo "0"
    fi
}

# 检测无法运行的测试文件（编译错误等）
count_compilation_errors() {
    local log_file="$1"
    local error_count=0
    
    # 检测各种无法运行的模式
    if [ -f "$log_file" ]; then
        # 主要模式：Test suite failed to run
        local suite_failed=$(safe_number "$(grep -c "Test suite failed to run" "$log_file" 2>/dev/null || echo "0")")
        error_count=$((error_count + suite_failed))
        
        # 其他编译错误模式
        local module_errors=$(safe_number "$(grep -c "Cannot find module" "$log_file" 2>/dev/null || echo "0")")
        local syntax_errors=$(safe_number "$(grep -c "SyntaxError" "$log_file" 2>/dev/null || echo "0")")
        local import_errors=$(safe_number "$(grep -c "TypeError.*import" "$log_file" 2>/dev/null || echo "0")")
        local export_errors=$(safe_number "$(grep -c "has no default export" "$log_file" 2>/dev/null || echo "0")")
        
        # 如果有其他错误但没有suite failed，说明可能是其他类型的编译错误
        local other_errors=$((module_errors + syntax_errors + import_errors + export_errors))
        if [ $other_errors -gt 0 ] && [ $suite_failed -eq 0 ]; then
            # 检查这些错误是否导致了FAIL但没有测试用例统计
            local fail_files=$(safe_number "$(grep -c "^FAIL " "$log_file" 2>/dev/null || echo "0")")
            local test_stats=$(safe_number "$(grep -c "Tests:" "$log_file" 2>/dev/null || echo "0")")
            
            # 如果有FAIL文件但没有测试统计，可能是编译错误
            if [ $fail_files -gt 0 ] && [ $test_stats -eq 0 ]; then
                error_count=$fail_files
            fi
        fi
    fi
    
    echo $error_count
}

# 解析文件状态（改进版：区分三种状态）
parse_file_status() {
    local log_file="$1"
    
    if [ ! -f "$log_file" ]; then
        echo "0 0 0 0"
        return
    fi
    
    # 统计各种状态
    local files_all_passed=$(safe_number "$(grep -c "^PASS " "$log_file" 2>/dev/null || echo "0")")
    local total_failed=$(safe_number "$(grep -c "^FAIL " "$log_file" 2>/dev/null || echo "0")")
    local files_cannot_run=$(count_compilation_errors "$log_file")
    
    local files_some_failed=$((total_failed - files_cannot_run))
    local total_files=$((files_all_passed + files_some_failed + files_cannot_run))
    
    echo "$total_files $files_all_passed $files_some_failed $files_cannot_run"
}

# 解析Jest测试结果（后端）- 改进版
parse_jest_results() {
    local log_file="$1"
    local module_type="$2"
    
    if [ ! -f "$log_file" ]; then
        return
    fi
    
    # 使用新的文件状态解析
    local file_status=$(parse_file_status "$log_file")
    local total_files=$(echo $file_status | cut -d' ' -f1)
    local files_all_passed=$(echo $file_status | cut -d' ' -f2)
    local files_some_failed=$(echo $file_status | cut -d' ' -f3)
    local files_cannot_run=$(echo $file_status | cut -d' ' -f4)
    
    # 解析测试用例统计
    local tests_line=$(grep "Tests:" "$log_file" | tail -1)
    
    if [ -n "$tests_line" ]; then
        # 提取测试统计: "Tests: 1 skipped, 25 passed, 26 total"
        local total_tests=$(safe_number "$(echo "$tests_line" | grep -o '[0-9]\+ total' | grep -o '[0-9]\+')")
        local passed_tests=$(safe_number "$(echo "$tests_line" | grep -o '[0-9]\+ passed' | grep -o '[0-9]\+')")
        local failed_tests=$(safe_number "$(echo "$tests_line" | grep -o '[0-9]\+ failed' | grep -o '[0-9]\+')")
        local skipped_tests=$(safe_number "$(echo "$tests_line" | grep -o '[0-9]\+ skipped' | grep -o '[0-9]\+')")
        
        case "$module_type" in
            "game")
                BACKEND_GAME_FILES=$total_files
                BACKEND_GAME_FILES_PASSED=$files_all_passed
                BACKEND_GAME_FILES_FAILED=$files_some_failed
                BACKEND_GAME_FILES_ERROR=$files_cannot_run
                BACKEND_GAME_TESTS=$total_tests
                BACKEND_GAME_TESTS_PASSED=$passed_tests
                BACKEND_GAME_TESTS_FAILED=$failed_tests
                BACKEND_GAME_TESTS_SKIPPED=$skipped_tests
                ;;
            "api")
                BACKEND_API_FILES=$total_files
                BACKEND_API_FILES_PASSED=$files_all_passed
                BACKEND_API_FILES_FAILED=$files_some_failed
                BACKEND_API_FILES_ERROR=$files_cannot_run
                BACKEND_API_TESTS=$total_tests
                BACKEND_API_TESTS_PASSED=$passed_tests
                BACKEND_API_TESTS_FAILED=$failed_tests
                BACKEND_API_TESTS_SKIPPED=$skipped_tests
                ;;
            "realtime")
                BACKEND_REALTIME_FILES=$total_files
                BACKEND_REALTIME_FILES_PASSED=$files_all_passed
                BACKEND_REALTIME_FILES_FAILED=$files_some_failed
                BACKEND_REALTIME_FILES_ERROR=$files_cannot_run
                BACKEND_REALTIME_TESTS=$total_tests
                BACKEND_REALTIME_TESTS_PASSED=$passed_tests
                BACKEND_REALTIME_TESTS_FAILED=$failed_tests
                BACKEND_REALTIME_TESTS_SKIPPED=$skipped_tests
                ;;
            "middleware")
                BACKEND_MIDDLEWARE_FILES=$total_files
                BACKEND_MIDDLEWARE_FILES_PASSED=$files_all_passed
                BACKEND_MIDDLEWARE_FILES_FAILED=$files_some_failed
                BACKEND_MIDDLEWARE_FILES_ERROR=$files_cannot_run
                BACKEND_MIDDLEWARE_TESTS=$total_tests
                BACKEND_MIDDLEWARE_TESTS_PASSED=$passed_tests
                BACKEND_MIDDLEWARE_TESTS_FAILED=$failed_tests
                BACKEND_MIDDLEWARE_TESTS_SKIPPED=$skipped_tests
                ;;
            "services")
                BACKEND_SERVICES_FILES=$total_files
                BACKEND_SERVICES_FILES_PASSED=$files_all_passed
                BACKEND_SERVICES_FILES_FAILED=$files_some_failed
                BACKEND_SERVICES_FILES_ERROR=$files_cannot_run
                BACKEND_SERVICES_TESTS=$total_tests
                BACKEND_SERVICES_TESTS_PASSED=$passed_tests
                BACKEND_SERVICES_TESTS_FAILED=$failed_tests
                BACKEND_SERVICES_TESTS_SKIPPED=$skipped_tests
                ;;
        esac
    fi
}

# 解析Vitest测试结果（前端）
parse_vitest_results() {
    local log_file="$1"
    local module_type="$2"
    
    if [ ! -f "$log_file" ]; then
        return
    fi
    
    # 解析总体统计
    local test_files_line=$(grep "Test Files" "$log_file" | tail -1)
    local tests_line=$(grep "Tests" "$log_file" | tail -1)
    
    if [ -n "$test_files_line" ]; then
        # 提取文件统计: "Test Files  4 failed | 13 passed (17)"
        local total_files=$(echo "$test_files_line" | grep -o '([0-9]\+)' | grep -o '[0-9]\+')
        local passed_files=$(echo "$test_files_line" | grep -o '[0-9]\+ passed' | grep -o '[0-9]\+')
        local failed_files=$(echo "$test_files_line" | grep -o '[0-9]\+ failed' | grep -o '[0-9]\+')
        
        case "$module_type" in
            "frontend_components")
                FRONTEND_COMPONENTS_FILES=${total_files:-0}
                FRONTEND_COMPONENTS_PASSED=${passed_files:-0}
                FRONTEND_COMPONENTS_FAILED=${failed_files:-0}
                ;;
            "frontend_pages")
                FRONTEND_PAGES_FILES=${total_files:-0}
                FRONTEND_PAGES_PASSED=${passed_files:-0}
                FRONTEND_PAGES_FAILED=${failed_files:-0}
                ;;
            "frontend_hooks")
                FRONTEND_HOOKS_FILES=${total_files:-0}
                FRONTEND_HOOKS_PASSED=${passed_files:-0}
                FRONTEND_HOOKS_FAILED=${failed_files:-0}
                ;;
            "frontend_services")
                FRONTEND_SERVICES_FILES=${total_files:-0}
                FRONTEND_SERVICES_PASSED=${passed_files:-0}
                FRONTEND_SERVICES_FAILED=${failed_files:-0}
                ;;
            "frontend_total")
                FRONTEND_TOTAL_FILES=${total_files:-0}
                ;;
        esac
    fi
    
    if [ -n "$tests_line" ]; then
        # 提取测试统计: "Tests  34 failed | 302 passed (336)"
        local total_tests=$(echo "$tests_line" | grep -o '([0-9]\+)' | grep -o '[0-9]\+')
        local passed_tests=$(echo "$tests_line" | grep -o '[0-9]\+ passed' | grep -o '[0-9]\+')
        local failed_tests=$(echo "$tests_line" | grep -o '[0-9]\+ failed' | grep -o '[0-9]\+')
        
        case "$module_type" in
            "frontend_components")
                FRONTEND_COMPONENTS_TESTS=${total_tests:-0}
                FRONTEND_COMPONENTS_TESTS_PASSED=${passed_tests:-0}
                FRONTEND_COMPONENTS_TESTS_FAILED=${failed_tests:-0}
                ;;
            "frontend_pages")
                FRONTEND_PAGES_TESTS=${total_tests:-0}
                FRONTEND_PAGES_TESTS_PASSED=${passed_tests:-0}
                FRONTEND_PAGES_TESTS_FAILED=${failed_tests:-0}
                ;;
            "frontend_hooks")
                FRONTEND_HOOKS_TESTS=${total_tests:-0}
                FRONTEND_HOOKS_TESTS_PASSED=${passed_tests:-0}
                FRONTEND_HOOKS_TESTS_FAILED=${failed_tests:-0}
                ;;
            "frontend_services")
                FRONTEND_SERVICES_TESTS=${total_tests:-0}
                FRONTEND_SERVICES_TESTS_PASSED=${passed_tests:-0}
                FRONTEND_SERVICES_TESTS_FAILED=${failed_tests:-0}
                ;;
            "frontend_total")
                FRONTEND_TOTAL_TESTS=${total_tests:-0}
                FRONTEND_TOTAL_PASSED=${passed_tests:-0}
                FRONTEND_TOTAL_FAILED=${failed_tests:-0}
                ;;
        esac
    fi
}

# 记录测试结果
record_test_result() {
    local test_name="$1"
    local result="$2"
    local log_file="$3"
    
    if [ "$result" = "pass" ]; then
        TESTS_PASSED=$((TESTS_PASSED + 1))
        TEST_SUMMARY="${TEST_SUMMARY}✅ ${test_name}\n"
        log_success "$test_name - 通过"
    else
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TEST_SUMMARY="${TEST_SUMMARY}❌ ${test_name}\n"
        log_error "$test_name - 失败"
        if [ -n "$log_file" ]; then
            log_warning "日志文件: $log_file"
        fi
    fi
}

# 检查环境是否就绪
check_environment() {
    log_info "🔍 检查测试环境..."
    
    # 检查后端服务
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        log_success "后端服务运行正常"
    else
        log_warning "后端服务未运行，尝试启动..."
        ./dev-local.sh start
        sleep 10
        
        if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
            log_success "后端服务启动成功"
        else
            log_error "后端服务启动失败，请手动检查"
            exit 1
        fi
    fi
    
    # 检查前端服务
    if curl -f http://localhost:5173 > /dev/null 2>&1; then
        log_success "前端服务运行正常"
    else
        log_warning "前端服务状态异常，但可以继续测试"
    fi
    
    # 检查数据库
    if docker ps | grep -q "texas_poker_postgres"; then
        log_success "PostgreSQL 运行正常"
    else
        log_error "PostgreSQL 未运行，请启动数据库服务"
        exit 1
    fi
}

# 运行后端测试
run_backend_tests() {
    log_info "🔧 运行后端测试..."
    echo "========================================"
    
    cd backend
    
    # 运行所有后端测试 (基于新的__tests__目录结构, 排除legacy目录)
    log_info "执行所有后端测试套件..."
    local backend_all_log="$CURRENT_LOG_DIR/backend_all_tests.log"
    if npm test -- --testPathIgnorePatterns="__tests__/legacy" > "../$backend_all_log" 2>&1; then
        record_test_result "Backend All Tests" "pass"
    else
        record_test_result "Backend All Tests" "fail" "$backend_all_log"
    fi
    # 解析总体测试结果
    parse_jest_results "../$backend_all_log" "backend_total"
    
    # 按功能域运行测试
    log_info "检查游戏引擎测试..."
    local backend_game_log="$CURRENT_LOG_DIR/backend_game_tests.log"
    if npm test -- --testPathPattern="__tests__/game" > "../$backend_game_log" 2>&1; then
        record_test_result "Backend Game Tests" "pass"
    else
        record_test_result "Backend Game Tests" "fail" "$backend_game_log"
    fi
    # 解析游戏测试结果（复用unit结构）
    parse_jest_results "../$backend_game_log" "game"
    
    # 运行API接口测试
    log_info "检查API接口测试..."
    local backend_api_log="$CURRENT_LOG_DIR/backend_api_tests.log"
    if npm test -- --testPathPattern="__tests__/api" > "../$backend_api_log" 2>&1; then
        record_test_result "Backend API Tests" "pass"
    else
        record_test_result "Backend API Tests" "fail" "$backend_api_log"
    fi
    # 解析API测试结果（复用integration结构）
    parse_jest_results "../$backend_api_log" "api"
    
    # 运行实时通信测试
    log_info "检查实时通信测试..."
    local backend_realtime_log="$CURRENT_LOG_DIR/backend_realtime_tests.log"
    if npm test -- --testPathPattern="__tests__/realtime" > "../$backend_realtime_log" 2>&1; then
        record_test_result "Backend Realtime Tests" "pass"
    else
        record_test_result "Backend Realtime Tests" "fail" "$backend_realtime_log"
    fi
    # 解析实时通信测试结果
    parse_jest_results "../$backend_realtime_log" "realtime"
    
    # 运行中间件测试
    log_info "检查中间件测试..."
    local backend_middleware_log="$CURRENT_LOG_DIR/backend_middleware_tests.log"
    if npm test -- --testPathPattern="__tests__/middleware" > "../$backend_middleware_log" 2>&1; then
        record_test_result "Backend Middleware Tests" "pass"
    else
        record_test_result "Backend Middleware Tests" "fail" "$backend_middleware_log"
    fi
    # 解析中间件测试结果
    parse_jest_results "../$backend_middleware_log" "middleware"
    
    # 运行服务层测试
    log_info "检查服务层测试..."
    local backend_services_log="$CURRENT_LOG_DIR/backend_services_tests.log"
    if npm test -- --testPathPattern="__tests__/services" > "../$backend_services_log" 2>&1; then
        record_test_result "Backend Services Tests" "pass"
    else
        record_test_result "Backend Services Tests" "fail" "$backend_services_log"
    fi
    # 解析服务层测试结果
    parse_jest_results "../$backend_services_log" "services"
    
    # 计算后端总计统计
    BACKEND_TOTAL_FILES=$((BACKEND_GAME_FILES + BACKEND_API_FILES + BACKEND_REALTIME_FILES + BACKEND_MIDDLEWARE_FILES + BACKEND_SERVICES_FILES))
    BACKEND_TOTAL_FILES_PASSED=$((BACKEND_GAME_FILES_PASSED + BACKEND_API_FILES_PASSED + BACKEND_REALTIME_FILES_PASSED + BACKEND_MIDDLEWARE_FILES_PASSED + BACKEND_SERVICES_FILES_PASSED))
    BACKEND_TOTAL_FILES_FAILED=$((BACKEND_GAME_FILES_FAILED + BACKEND_API_FILES_FAILED + BACKEND_REALTIME_FILES_FAILED + BACKEND_MIDDLEWARE_FILES_FAILED + BACKEND_SERVICES_FILES_FAILED))
    BACKEND_TOTAL_FILES_ERROR=$((BACKEND_GAME_FILES_ERROR + BACKEND_API_FILES_ERROR + BACKEND_REALTIME_FILES_ERROR + BACKEND_MIDDLEWARE_FILES_ERROR + BACKEND_SERVICES_FILES_ERROR))
    BACKEND_TOTAL_TESTS=$((BACKEND_GAME_TESTS + BACKEND_API_TESTS + BACKEND_REALTIME_TESTS + BACKEND_MIDDLEWARE_TESTS + BACKEND_SERVICES_TESTS))
    BACKEND_TOTAL_PASSED=$((BACKEND_GAME_TESTS_PASSED + BACKEND_API_TESTS_PASSED + BACKEND_REALTIME_TESTS_PASSED + BACKEND_MIDDLEWARE_TESTS_PASSED + BACKEND_SERVICES_TESTS_PASSED))
    BACKEND_TOTAL_FAILED=$((BACKEND_GAME_TESTS_FAILED + BACKEND_API_TESTS_FAILED + BACKEND_REALTIME_TESTS_FAILED + BACKEND_MIDDLEWARE_TESTS_FAILED + BACKEND_SERVICES_TESTS_FAILED))
    BACKEND_TOTAL_SKIPPED=$((BACKEND_GAME_TESTS_SKIPPED + BACKEND_API_TESTS_SKIPPED + BACKEND_REALTIME_TESTS_SKIPPED + BACKEND_MIDDLEWARE_TESTS_SKIPPED + BACKEND_SERVICES_TESTS_SKIPPED))
    
    # 运行测试覆盖率
    log_info "生成测试覆盖率报告..."
    local backend_coverage_log="$CURRENT_LOG_DIR/backend_coverage.log"
    if npm run test:coverage > "../$backend_coverage_log" 2>&1; then
        record_test_result "Backend Coverage Report" "pass"
    else
        record_test_result "Backend Coverage Report" "fail" "$backend_coverage_log"
    fi
    
    cd ..
}

# 运行前端测试
run_frontend_tests() {
    log_info "🎨 运行前端测试..."
    echo "========================================"
    
    cd frontend
    
    # 分类测试执行 (无需运行整体测试，通过模块测试加总得到统计)
    log_info "执行组件测试..."
    local frontend_components_log="$CURRENT_LOG_DIR/frontend_components.log"
    if npm test -- __tests__/components --run > "../$frontend_components_log" 2>&1; then
        record_test_result "Frontend Component Tests" "pass"
    else
        record_test_result "Frontend Component Tests" "fail" "$frontend_components_log"
    fi
    # 解析组件测试结果
    parse_vitest_results "../$frontend_components_log" "frontend_components"
    
    log_info "执行页面测试..."
    local frontend_pages_log="$CURRENT_LOG_DIR/frontend_pages.log"
    if npm test -- __tests__/pages --run > "../$frontend_pages_log" 2>&1; then
        record_test_result "Frontend Page Tests" "pass"
    else
        record_test_result "Frontend Page Tests" "fail" "$frontend_pages_log"
    fi
    # 解析页面测试结果
    parse_vitest_results "../$frontend_pages_log" "frontend_pages"
    
    log_info "执行Hook测试..."
    local frontend_hooks_log="$CURRENT_LOG_DIR/frontend_hooks.log"
    if npm test -- __tests__/hooks --run > "../$frontend_hooks_log" 2>&1; then
        record_test_result "Frontend Hook Tests" "pass"
    else
        record_test_result "Frontend Hook Tests" "fail" "$frontend_hooks_log"
    fi
    # 解析Hook测试结果
    parse_vitest_results "../$frontend_hooks_log" "frontend_hooks"
    
    log_info "执行服务测试..."
    local frontend_services_log="$CURRENT_LOG_DIR/frontend_services.log"
    if npm test -- __tests__/services --run > "../$frontend_services_log" 2>&1; then
        record_test_result "Frontend Service Tests" "pass"
    else
        record_test_result "Frontend Service Tests" "fail" "$frontend_services_log"
    fi
    # 解析服务测试结果
    parse_vitest_results "../$frontend_services_log" "frontend_services"
    
    # 计算前端总体统计数据（通过各模块加总）
    log_info "计算前端总体统计数据..."
    FRONTEND_TOTAL_FILES=$((FRONTEND_COMPONENTS_FILES + FRONTEND_PAGES_FILES + FRONTEND_HOOKS_FILES + FRONTEND_SERVICES_FILES))
    FRONTEND_TOTAL_TESTS=$((FRONTEND_COMPONENTS_TESTS + FRONTEND_PAGES_TESTS + FRONTEND_HOOKS_TESTS + FRONTEND_SERVICES_TESTS))
    FRONTEND_TOTAL_PASSED=$((FRONTEND_COMPONENTS_TESTS_PASSED + FRONTEND_PAGES_TESTS_PASSED + FRONTEND_HOOKS_TESTS_PASSED + FRONTEND_SERVICES_TESTS_PASSED))
    FRONTEND_TOTAL_FAILED=$((FRONTEND_COMPONENTS_TESTS_FAILED + FRONTEND_PAGES_TESTS_FAILED + FRONTEND_HOOKS_TESTS_FAILED + FRONTEND_SERVICES_TESTS_FAILED))
    
    log_info "前端总体统计: 文件 $FRONTEND_TOTAL_FILES, 测试 $FRONTEND_TOTAL_TESTS (通过: $FRONTEND_TOTAL_PASSED, 失败: $FRONTEND_TOTAL_FAILED)"
    
    # 运行测试覆盖率（如果配置了的话）
    log_info "生成前端测试覆盖率报告..."
    local frontend_coverage_log="$CURRENT_LOG_DIR/frontend_coverage.log"
    if npm run test:coverage 2>/dev/null || npm run test:run --coverage > "../$frontend_coverage_log" 2>&1; then
        record_test_result "Frontend Coverage Report" "pass"
    else
        record_test_result "Frontend Coverage Report" "fail" "$frontend_coverage_log"
    fi
    
    cd ..
}

# 运行E2E测试
run_e2e_tests() {
    log_info "🎭 运行端到端测试..."
    echo "========================================"
    
    if [ -d "e2e-tests" ]; then
        cd e2e-tests
        
        # 确保Playwright浏览器已安装
        if ! npx playwright --version > /dev/null 2>&1; then
            log_info "安装Playwright浏览器..."
            npm run install
        fi
        
        # 运行E2E测试
        local e2e_log="$CURRENT_LOG_DIR/e2e_tests.log"
        if npm test > "../$e2e_log" 2>&1; then
            record_test_result "E2E Tests" "pass"
        else
            record_test_result "E2E Tests" "fail" "$e2e_log"
        fi
        
        cd ..
    else
        log_warning "E2E测试目录不存在，跳过E2E测试"
    fi
}

# 运行构建测试
run_build_tests() {
    log_info "🏗️  运行构建测试..."
    echo "========================================"
    
    # 后端构建测试
    cd backend
    local backend_build_log="$CURRENT_LOG_DIR/backend_build.log"
    if npm run build > "../$backend_build_log" 2>&1; then
        record_test_result "Backend Build" "pass"
    else
        record_test_result "Backend Build" "fail" "$backend_build_log"
    fi
    cd ..
    
    # 前端构建测试
    cd frontend
    local frontend_build_log="$CURRENT_LOG_DIR/frontend_build.log"
    if npm run build > "../$frontend_build_log" 2>&1; then
        record_test_result "Frontend Build" "pass"
    else
        record_test_result "Frontend Build" "fail" "$frontend_build_log"
    fi
    cd ..
}

# 生成详细模块统计报告
generate_detailed_stats() {
    echo -e "${BLUE}📊 详细模块测试统计${NC}"
    echo "========================================"
    
    # 后端统计
    echo -e "${YELLOW}🔧 后端测试统计${NC}"
    echo "----------------------------------------"
    if [ "$BACKEND_TOTAL_FILES" -gt 0 ]; then
        echo "总体统计:"
        echo "  📁 测试文件: $BACKEND_TOTAL_FILES"
        echo "  🧪 测试用例: $BACKEND_TOTAL_TESTS (通过: $BACKEND_TOTAL_PASSED, 失败: $BACKEND_TOTAL_FAILED, 跳过: $BACKEND_TOTAL_SKIPPED)"
    fi
    
    if [ "$BACKEND_GAME_FILES" -gt 0 ]; then
        echo "游戏引擎测试:"
        echo "  📁 测试文件: $BACKEND_GAME_FILES (🟢通过: $BACKEND_GAME_FILES_PASSED, 🟡失败: $BACKEND_GAME_FILES_FAILED, 🔴无法运行: $BACKEND_GAME_FILES_ERROR)"
        echo "  🧪 测试用例: $BACKEND_GAME_TESTS (通过: $BACKEND_GAME_TESTS_PASSED, 失败: $BACKEND_GAME_TESTS_FAILED, 跳过: $BACKEND_GAME_TESTS_SKIPPED)"
    fi
    
    if [ "$BACKEND_API_FILES" -gt 0 ]; then
        echo "API接口测试:"
        echo "  📁 测试文件: $BACKEND_API_FILES (🟢通过: $BACKEND_API_FILES_PASSED, 🟡失败: $BACKEND_API_FILES_FAILED, 🔴无法运行: $BACKEND_API_FILES_ERROR)"
        echo "  🧪 测试用例: $BACKEND_API_TESTS (通过: $BACKEND_API_TESTS_PASSED, 失败: $BACKEND_API_TESTS_FAILED, 跳过: $BACKEND_API_TESTS_SKIPPED)"
    fi
    
    if [ "$BACKEND_REALTIME_FILES" -gt 0 ]; then
        echo "实时通信测试:"
        echo "  📁 测试文件: $BACKEND_REALTIME_FILES (🟢通过: $BACKEND_REALTIME_FILES_PASSED, 🟡失败: $BACKEND_REALTIME_FILES_FAILED, 🔴无法运行: $BACKEND_REALTIME_FILES_ERROR)"
        echo "  🧪 测试用例: $BACKEND_REALTIME_TESTS (通过: $BACKEND_REALTIME_TESTS_PASSED, 失败: $BACKEND_REALTIME_TESTS_FAILED, 跳过: $BACKEND_REALTIME_TESTS_SKIPPED)"
    fi
    
    if [ "$BACKEND_MIDDLEWARE_FILES" -gt 0 ]; then
        echo "中间件测试:"
        echo "  📁 测试文件: $BACKEND_MIDDLEWARE_FILES (🟢通过: $BACKEND_MIDDLEWARE_FILES_PASSED, 🟡失败: $BACKEND_MIDDLEWARE_FILES_FAILED, 🔴无法运行: $BACKEND_MIDDLEWARE_FILES_ERROR)"
        echo "  🧪 测试用例: $BACKEND_MIDDLEWARE_TESTS (通过: $BACKEND_MIDDLEWARE_TESTS_PASSED, 失败: $BACKEND_MIDDLEWARE_TESTS_FAILED, 跳过: $BACKEND_MIDDLEWARE_TESTS_SKIPPED)"
    fi
    
    if [ "$BACKEND_SERVICES_FILES" -gt 0 ]; then
        echo "服务层测试:"
        echo "  📁 测试文件: $BACKEND_SERVICES_FILES (🟢通过: $BACKEND_SERVICES_FILES_PASSED, 🟡失败: $BACKEND_SERVICES_FILES_FAILED, 🔴无法运行: $BACKEND_SERVICES_FILES_ERROR)"
        echo "  🧪 测试用例: $BACKEND_SERVICES_TESTS (通过: $BACKEND_SERVICES_TESTS_PASSED, 失败: $BACKEND_SERVICES_TESTS_FAILED, 跳过: $BACKEND_SERVICES_TESTS_SKIPPED)"
    fi
    
    # 验证数学一致性
    local calculated_files=$((BACKEND_GAME_FILES + BACKEND_API_FILES + BACKEND_REALTIME_FILES + BACKEND_MIDDLEWARE_FILES + BACKEND_SERVICES_FILES))
    local calculated_tests=$((BACKEND_GAME_TESTS + BACKEND_API_TESTS + BACKEND_REALTIME_TESTS + BACKEND_MIDDLEWARE_TESTS + BACKEND_SERVICES_TESTS))
    
    if [ "$calculated_files" -ne "$BACKEND_TOTAL_FILES" ] || [ "$calculated_tests" -ne "$BACKEND_TOTAL_TESTS" ]; then
        echo "⚠️  统计验证:"
        echo "  计算值: 文件 $calculated_files, 测试 $calculated_tests"
        echo "  实际值: 文件 $BACKEND_TOTAL_FILES, 测试 $BACKEND_TOTAL_TESTS"
    fi
    echo
    
    # 前端统计
    echo -e "${YELLOW}🎨 前端测试统计${NC}"
    echo "----------------------------------------"
    if [ "$FRONTEND_TOTAL_FILES" -gt 0 ]; then
        echo "总体统计:"
        echo "  📁 测试文件: $FRONTEND_TOTAL_FILES"
        echo "  🧪 测试用例: $FRONTEND_TOTAL_TESTS (通过: $FRONTEND_TOTAL_PASSED, 失败: $FRONTEND_TOTAL_FAILED)"
    fi
    
    if [ "$FRONTEND_COMPONENTS_FILES" -gt 0 ]; then
        echo "组件测试:"
        echo "  📁 测试文件: $FRONTEND_COMPONENTS_FILES (通过: $FRONTEND_COMPONENTS_PASSED, 失败: $FRONTEND_COMPONENTS_FAILED)"
        echo "  🧪 测试用例: $FRONTEND_COMPONENTS_TESTS (通过: $FRONTEND_COMPONENTS_TESTS_PASSED, 失败: $FRONTEND_COMPONENTS_TESTS_FAILED)"
    fi
    
    if [ "$FRONTEND_PAGES_FILES" -gt 0 ]; then
        echo "页面测试:"
        echo "  📁 测试文件: $FRONTEND_PAGES_FILES (通过: $FRONTEND_PAGES_PASSED, 失败: $FRONTEND_PAGES_FAILED)"
        echo "  🧪 测试用例: $FRONTEND_PAGES_TESTS (通过: $FRONTEND_PAGES_TESTS_PASSED, 失败: $FRONTEND_PAGES_TESTS_FAILED)"
    fi
    
    if [ "$FRONTEND_HOOKS_FILES" -gt 0 ]; then
        echo "Hook测试:"
        echo "  📁 测试文件: $FRONTEND_HOOKS_FILES (通过: $FRONTEND_HOOKS_PASSED, 失败: $FRONTEND_HOOKS_FAILED)"
        echo "  🧪 测试用例: $FRONTEND_HOOKS_TESTS (通过: $FRONTEND_HOOKS_TESTS_PASSED, 失败: $FRONTEND_HOOKS_TESTS_FAILED)"
    fi
    
    if [ "$FRONTEND_SERVICES_FILES" -gt 0 ]; then
        echo "服务测试:"
        echo "  📁 测试文件: $FRONTEND_SERVICES_FILES (通过: $FRONTEND_SERVICES_PASSED, 失败: $FRONTEND_SERVICES_FAILED)"
        echo "  🧪 测试用例: $FRONTEND_SERVICES_TESTS (通过: $FRONTEND_SERVICES_TESTS_PASSED, 失败: $FRONTEND_SERVICES_TESTS_FAILED)"
    fi
    echo
    
    # E2E统计（如果有的话）
    if [ "$E2E_FILES" -gt 0 ]; then
        echo -e "${YELLOW}🎭 E2E测试统计${NC}"
        echo "----------------------------------------"
        echo "  📁 测试文件: $E2E_FILES"
        echo "  🧪 测试用例: $E2E_TESTS"
        echo
    fi
}

# 生成测试报告
generate_report() {
    echo
    log_info "📊 测试执行完成，生成报告..."
    echo "========================================"
    echo
    
    echo -e "${BLUE}🏁 测试结果汇总${NC}"
    echo "========================================"
    echo -e "$TEST_SUMMARY"
    echo
    
    # 显示详细模块统计
    generate_detailed_stats
    
    echo -e "${BLUE}📈 总体统计信息${NC}"
    echo "通过: $TESTS_PASSED"
    echo "失败: $TESTS_FAILED"
    echo "总计: $((TESTS_PASSED + TESTS_FAILED))"
    echo
    
    if [ $TESTS_FAILED -eq 0 ]; then
        log_success "🎉 所有测试都通过了！"
        echo
        echo "✨ 代码质量良好，可以安全提交"
    else
        log_warning "⚠️  有 $TESTS_FAILED 个测试失败"
        echo
        echo "📝 请查看以下日志文件："
        echo "  - 📁 日志目录: $CURRENT_LOG_DIR"
        echo "  - 🔗 最新日志: $LOG_DIR/latest -> $TIMESTAMP"
        echo "  - 📄 可查看具体的 *.log 文件了解详细错误信息"
        echo
        echo "🔧 修复建议："
        echo "  1. 查看具体的日志文件了解错误详情"
        echo "  2. 运行 ./test-all.sh check 检查环境"
        echo "  3. 使用 ./test-all.sh quick 进行快速调试"
        echo "  4. 单独运行失败的测试模块进行调试"
        echo "  5. 参考 TEST_STANDARDS.md 了解测试规范"
    fi
    
    # 保存报告到日志目录
    local report_file="$CURRENT_LOG_DIR/test_report.md"
    cat > "$report_file" << EOF
# Texas Poker 测试执行报告 v2.4

**执行时间**: $(date)  
**日志目录**: $CURRENT_LOG_DIR  
**测试架构**: 基于新的测试目录结构 api/game/middleware/realtime/services/shared/legacy  
**规范文档**: BACKEND_TESTING_GUIDE.md

## 测试结果汇总

$TEST_SUMMARY

## 详细模块测试统计

### 🔧 后端测试统计

$(if [ "$BACKEND_TOTAL_FILES" -gt 0 ]; then
echo "**总体统计:**
- 📁 测试文件: $BACKEND_TOTAL_FILES (🟢通过: $BACKEND_TOTAL_FILES_PASSED, 🟡失败: $BACKEND_TOTAL_FILES_FAILED, 🔴无法运行: $BACKEND_TOTAL_FILES_ERROR)
- 🧪 测试用例: $BACKEND_TOTAL_TESTS (通过: $BACKEND_TOTAL_PASSED, 失败: $BACKEND_TOTAL_FAILED, 跳过: $BACKEND_TOTAL_SKIPPED)"
fi)

$(if [ "$BACKEND_GAME_FILES" -gt 0 ]; then
echo "**游戏引擎测试:**
- 📁 测试文件: $BACKEND_GAME_FILES (🟢通过: $BACKEND_GAME_FILES_PASSED, 🟡失败: $BACKEND_GAME_FILES_FAILED, 🔴无法运行: $BACKEND_GAME_FILES_ERROR)
- 🧪 测试用例: $BACKEND_GAME_TESTS (通过: $BACKEND_GAME_TESTS_PASSED, 失败: $BACKEND_GAME_TESTS_FAILED, 跳过: $BACKEND_GAME_TESTS_SKIPPED)"
fi)

$(if [ "$BACKEND_API_FILES" -gt 0 ]; then
echo "**API接口测试:**
- 📁 测试文件: $BACKEND_API_FILES (🟢通过: $BACKEND_API_FILES_PASSED, 🟡失败: $BACKEND_API_FILES_FAILED, 🔴无法运行: $BACKEND_API_FILES_ERROR)
- 🧪 测试用例: $BACKEND_API_TESTS (通过: $BACKEND_API_TESTS_PASSED, 失败: $BACKEND_API_TESTS_FAILED, 跳过: $BACKEND_API_TESTS_SKIPPED)"
fi)

$(if [ "$BACKEND_REALTIME_FILES" -gt 0 ]; then
echo "**实时通信测试:**
- 📁 测试文件: $BACKEND_REALTIME_FILES (🟢通过: $BACKEND_REALTIME_FILES_PASSED, 🟡失败: $BACKEND_REALTIME_FILES_FAILED, 🔴无法运行: $BACKEND_REALTIME_FILES_ERROR)
- 🧪 测试用例: $BACKEND_REALTIME_TESTS (通过: $BACKEND_REALTIME_TESTS_PASSED, 失败: $BACKEND_REALTIME_TESTS_FAILED, 跳过: $BACKEND_REALTIME_TESTS_SKIPPED)"
fi)

$(if [ "$BACKEND_MIDDLEWARE_FILES" -gt 0 ]; then
echo "**中间件测试:**
- 📁 测试文件: $BACKEND_MIDDLEWARE_FILES (🟢通过: $BACKEND_MIDDLEWARE_FILES_PASSED, 🟡失败: $BACKEND_MIDDLEWARE_FILES_FAILED, 🔴无法运行: $BACKEND_MIDDLEWARE_FILES_ERROR)
- 🧪 测试用例: $BACKEND_MIDDLEWARE_TESTS (通过: $BACKEND_MIDDLEWARE_TESTS_PASSED, 失败: $BACKEND_MIDDLEWARE_TESTS_FAILED, 跳过: $BACKEND_MIDDLEWARE_TESTS_SKIPPED)"
fi)

$(if [ "$BACKEND_SERVICES_FILES" -gt 0 ]; then
echo "**服务层测试:**
- 📁 测试文件: $BACKEND_SERVICES_FILES (🟢通过: $BACKEND_SERVICES_FILES_PASSED, 🟡失败: $BACKEND_SERVICES_FILES_FAILED, 🔴无法运行: $BACKEND_SERVICES_FILES_ERROR)
- 🧪 测试用例: $BACKEND_SERVICES_TESTS (通过: $BACKEND_SERVICES_TESTS_PASSED, 失败: $BACKEND_SERVICES_TESTS_FAILED, 跳过: $BACKEND_SERVICES_TESTS_SKIPPED)"
fi)

### 🎨 前端测试统计

$(if [ "$FRONTEND_TOTAL_FILES" -gt 0 ]; then
echo "**总体统计:**
- 📁 测试文件: $FRONTEND_TOTAL_FILES
- 🧪 测试用例: $FRONTEND_TOTAL_TESTS (通过: $FRONTEND_TOTAL_PASSED, 失败: $FRONTEND_TOTAL_FAILED)"
fi)

$(if [ "$FRONTEND_COMPONENTS_FILES" -gt 0 ]; then
echo "**组件测试:**
- 📁 测试文件: $FRONTEND_COMPONENTS_FILES (通过: $FRONTEND_COMPONENTS_PASSED, 失败: $FRONTEND_COMPONENTS_FAILED)
- 🧪 测试用例: $FRONTEND_COMPONENTS_TESTS (通过: $FRONTEND_COMPONENTS_TESTS_PASSED, 失败: $FRONTEND_COMPONENTS_TESTS_FAILED)"
fi)

$(if [ "$FRONTEND_PAGES_FILES" -gt 0 ]; then
echo "**页面测试:**
- 📁 测试文件: $FRONTEND_PAGES_FILES (通过: $FRONTEND_PAGES_PASSED, 失败: $FRONTEND_PAGES_FAILED)
- 🧪 测试用例: $FRONTEND_PAGES_TESTS (通过: $FRONTEND_PAGES_TESTS_PASSED, 失败: $FRONTEND_PAGES_TESTS_FAILED)"
fi)

$(if [ "$FRONTEND_HOOKS_FILES" -gt 0 ]; then
echo "**Hook测试:**
- 📁 测试文件: $FRONTEND_HOOKS_FILES (通过: $FRONTEND_HOOKS_PASSED, 失败: $FRONTEND_HOOKS_FAILED)
- 🧪 测试用例: $FRONTEND_HOOKS_TESTS (通过: $FRONTEND_HOOKS_TESTS_PASSED, 失败: $FRONTEND_HOOKS_TESTS_FAILED)"
fi)

$(if [ "$FRONTEND_SERVICES_FILES" -gt 0 ]; then
echo "**服务测试:**
- 📁 测试文件: $FRONTEND_SERVICES_FILES (通过: $FRONTEND_SERVICES_PASSED, 失败: $FRONTEND_SERVICES_FAILED)
- 🧪 测试用例: $FRONTEND_SERVICES_TESTS (通过: $FRONTEND_SERVICES_TESTS_PASSED, 失败: $FRONTEND_SERVICES_TESTS_FAILED)"
fi)

$(if [ "$E2E_FILES" -gt 0 ]; then
echo "### 🎭 E2E测试统计
- 📁 测试文件: $E2E_FILES
- 🧪 测试用例: $E2E_TESTS"
fi)

## 总体统计信息
- ✅ 通过: $TESTS_PASSED
- ❌ 失败: $TESTS_FAILED  
- 📊 总计: $((TESTS_PASSED + TESTS_FAILED))
- 📈 通过率: $(( TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED) ))%

## 测试架构
- 🔧 后端: \`__tests__/{api,game,middleware,realtime,services,shared,legacy}\` + Jest
- 🎨 前端: \`__tests__/{components,pages,hooks,services}\` + Vitest + React Testing Library  
- 🎭 E2E: \`e2e-tests/\` + Playwright

## 可用命令
\`\`\`bash
./test-all.sh           # 运行所有测试
./test-all.sh quick     # 快速测试（开发用）
./test-all.sh coverage  # 生成覆盖率报告
./test-all.sh backend   # 只运行后端测试
./test-all.sh frontend  # 只运行前端测试
\`\`\`

## 日志文件结构
\`\`\`
$CURRENT_LOG_DIR/
├── backend_all_tests.log      # 后端所有测试
├── backend_game_tests.log     # 后端游戏引擎测试
├── backend_api_tests.log      # 后端API接口测试
├── backend_realtime_tests.log # 后端实时通信测试
├── backend_storage_tests.log  # 后端数据存储测试
├── backend_coverage.log       # 后端覆盖率
├── frontend_components.log    # 前端组件测试
├── frontend_pages.log         # 前端页面测试
├── frontend_hooks.log         # 前端Hook测试
├── frontend_services.log      # 前端服务测试
├── frontend_coverage.log      # 前端覆盖率
├── e2e_tests.log              # E2E测试
├── backend_build.log          # 后端构建
├── frontend_build.log         # 前端构建
└── test_report.md             # 测试报告
\`\`\`

## 参考文档
- [TEST_STANDARDS.md](../TEST_STANDARDS.md) - 测试编写规范
- [DEV_GUIDE.md](../DEV_GUIDE.md) - 开发指南

EOF

    # 同时在根目录创建一个简化的报告链接
    cat > test_report.md << EOF
# Texas Poker 最新测试报告

**最后执行时间**: $(date)  
**详细报告**: [\`$CURRENT_LOG_DIR/test_report.md\`](./$CURRENT_LOG_DIR/test_report.md)  
**日志目录**: [\`$CURRENT_LOG_DIR\`](./$CURRENT_LOG_DIR/)

## 快速查看
- 📊 通过: $TESTS_PASSED | 失败: $TESTS_FAILED | 总计: $((TESTS_PASSED + TESTS_FAILED))
- 📈 通过率: $(( TESTS_PASSED * 100 / (TESTS_PASSED + TESTS_FAILED) ))%

## 日志管理
- 🔗 最新日志: [\`$LOG_DIR/latest\`](./$LOG_DIR/latest) -> $TIMESTAMP
- 📁 所有历史日志: [\`$LOG_DIR/\`](./$LOG_DIR/)

查看详细日志和完整报告请访问上述链接。
EOF

    log_info "📄 详细报告已保存到 $report_file"
    log_info "📄 简化报告已保存到 test_report.md"
}

# 显示帮助信息
show_help() {
    echo "Texas Poker 测试执行脚本"
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  all          运行所有测试（默认）"
    echo "  backend      只运行后端测试"
    echo "  frontend     只运行前端测试"
    echo "  e2e          只运行E2E测试"
    echo "  build        只运行构建测试"
    echo "  new          只运行新增功能测试"
    echo "  check        只检查环境"
    echo "  coverage     生成测试覆盖率报告"
    echo "  quick        快速测试（跳过E2E和构建）"
    echo "  help         显示此帮助信息"
    echo "  logs         查看最新测试日志"
    echo "  clean        清理根目录下的旧日志文件"
    echo
    echo "示例:"
    echo "  $0           # 运行所有测试"
    echo "  $0 backend   # 只运行后端测试"
    echo "  $0 frontend  # 只运行前端测试"
    echo "  $0 quick     # 快速测试（开发时使用）"
    echo "  $0 coverage  # 生成覆盖率报告"
    echo "  $0 new       # 只测试新增功能"
    echo "  $0 logs      # 查看最新测试日志"
    echo "  $0 clean     # 清理根目录旧日志文件"
    echo
    echo "📁 日志管理:"
    echo "  - 日志存储在 test-logs/ 目录下"
    echo "  - 每次执行创建时间戳目录"
    echo "  - test-logs/latest 指向最新日志"
    echo "  - 自动保留最近5次测试日志"
}

# 只运行新增功能测试
run_new_features_only() {
    log_info "🆕 运行新增功能测试..."
    
    # 检查后端新增功能
    log_info "检查后端新增功能..."
    cd backend
    local backend_new_log="$CURRENT_LOG_DIR/backend_new_features.log"
    if npm test -- --testPathPattern="systemHandlers.enhanced.test.ts" > "../$backend_new_log" 2>&1; then
        record_test_result "Backend New Features" "pass"
    else
        record_test_result "Backend New Features" "fail" "$backend_new_log"
    fi
    cd ..
    
    # 检查前端新增组件
    log_info "检查前端新增组件..."
    cd frontend
    
    # 测试新增的组件
    for component in "RoomSwitchConfirmModal" "UserCurrentRoomStatus" "ReconnectionIndicator"; do
        log_info "测试组件: $component"
        local component_log="$CURRENT_LOG_DIR/frontend_${component,,}.log"
        if npm test -- ${component}.test.tsx --run > "../$component_log" 2>&1; then
            record_test_result "$component" "pass"
        else
            record_test_result "$component" "fail" "$component_log"
        fi
    done
    
    # 测试增强的服务
    log_info "测试增强的服务..."
    local socketservice_log="$CURRENT_LOG_DIR/frontend_socketservice_enhanced.log"
    if npm test -- socketService.enhanced.test.ts --run > "../$socketservice_log" 2>&1; then
        record_test_result "SocketService Enhanced" "pass"
    else
        record_test_result "SocketService Enhanced" "fail" "$socketservice_log"
    fi
    
    cd ..
}

# 只运行覆盖率测试
run_coverage_only() {
    log_info "📊 生成测试覆盖率报告..."
    
    # 后端覆盖率
    cd backend
    log_info "生成后端覆盖率报告..."
    local backend_coverage_full_log="$CURRENT_LOG_DIR/backend_coverage_full.log"
    if npm run test:coverage > "../$backend_coverage_full_log" 2>&1; then
        record_test_result "Backend Coverage" "pass"
    else
        record_test_result "Backend Coverage" "fail" "$backend_coverage_full_log"
    fi
    cd ..
    
    # 前端覆盖率
    cd frontend  
    log_info "生成前端覆盖率报告..."
    local frontend_coverage_full_log="$CURRENT_LOG_DIR/frontend_coverage_full.log"
    if npm run test:run -- --coverage > "../$frontend_coverage_full_log" 2>&1; then
        record_test_result "Frontend Coverage" "pass"
    else
        record_test_result "Frontend Coverage" "fail" "$frontend_coverage_full_log"
    fi
    cd ..
}

# 快速测试（开发时使用）
run_quick_tests() {
    log_info "⚡ 运行快速测试套件..."
    
    # 只运行游戏引擎测试，跳过复杂的集成测试和E2E
    cd backend
    log_info "后端核心测试（游戏引擎）..."
    local backend_quick_log="$CURRENT_LOG_DIR/backend_quick.log"
    if npm test -- --testPathPattern="__tests__/game" > "../$backend_quick_log" 2>&1; then
        record_test_result "Backend Quick Tests" "pass"
    else
        record_test_result "Backend Quick Tests" "fail" "$backend_quick_log"
    fi
    cd ..
    
    cd frontend
    log_info "前端组件和Hook测试..."
    local frontend_quick_log="$CURRENT_LOG_DIR/frontend_quick.log"
    if npm test -- __tests__/components __tests__/hooks --run > "../$frontend_quick_log" 2>&1; then
        record_test_result "Frontend Quick Tests" "pass"
    else
        record_test_result "Frontend Quick Tests" "fail" "$frontend_quick_log"
    fi
    cd ..
}

# 查看最新测试日志
show_logs() {
    log_info "📁 查看最新测试日志..."
    
    if [ -L "$LOG_DIR/latest" ]; then
        local latest_dir=$(readlink "$LOG_DIR/latest")
        local latest_path="$LOG_DIR/$latest_dir"
        
        log_info "最新日志目录: $latest_path"
        echo
        
        if [ -d "$latest_path" ]; then
            echo -e "${BLUE}📋 可用日志文件:${NC}"
            ls -la "$latest_path" | grep "\.log$" | while read -r line; do
                local file=$(echo "$line" | awk '{print $9}')
                local size=$(echo "$line" | awk '{print $5}')
                echo "  📄 $file (大小: $size bytes)"
            done
            
            echo
            echo -e "${BLUE}🔗 快速访问:${NC}"
            echo "  查看详细报告: cat $latest_path/test_report.md"
            echo "  查看所有日志: ls -la $latest_path/"
            echo "  查看特定日志: cat $latest_path/<文件名>.log"
            
            if [ -f "$latest_path/test_report.md" ]; then
                echo
                echo -e "${BLUE}📊 最新测试报告摘要:${NC}"
                echo "----------------------------------------"
                head -20 "$latest_path/test_report.md"
                echo "----------------------------------------"
                echo "完整报告: cat $latest_path/test_report.md"
            fi
        else
            log_error "最新日志目录不存在: $latest_path"
        fi
    else
        log_warning "没有找到最新的测试日志"
        if [ -d "$LOG_DIR" ]; then
            echo "可用的历史日志:"
            ls -1t "$LOG_DIR" | grep -E "^[0-9]{8}_[0-9]{6}$" | head -5
        fi
    fi
}

# 清理根目录旧日志文件
clean_root_logs() {
    log_info "🧹 清理根目录下的旧日志文件..."
    
    # 查找根目录中的.log文件
    local log_files=$(ls -1 *.log 2>/dev/null || true)
    
    if [ -n "$log_files" ]; then
        echo -e "${YELLOW}发现以下旧日志文件:${NC}"
        ls -la *.log
        echo
        
        read -p "确认删除这些文件吗? (y/N): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            rm -f *.log
            log_success "已清理根目录下的旧日志文件"
        else
            log_info "已取消清理操作"
        fi
    else
        log_success "根目录很干净，没有找到旧的.log文件"
    fi
    
    echo
    log_info "💡 提示：新的测试日志现在统一存储在 test-logs/ 目录下"
}

# 主函数
main() {
    echo -e "${BLUE}🧪 Texas Poker 统一测试执行脚本 v2.3${NC}"
    echo -e "${BLUE}基于重构后的功能域测试架构和TEST_STANDARDS.md规范${NC}"
    echo "========================================"
    echo
    
    # 设置日志目录（除了help、logs和clean命令）
    if [ "${1:-all}" != "help" ] && [ "${1:-all}" != "--help" ] && [ "${1:-all}" != "-h" ] && [ "${1:-all}" != "logs" ] && [ "${1:-all}" != "clean" ]; then
        setup_logging
        cleanup_old_logs
    fi
    
    case "${1:-all}" in
        all)
            check_environment
            run_backend_tests
            run_frontend_tests
            run_build_tests
            run_e2e_tests
            generate_report
            ;;
        backend)
            check_environment
            run_backend_tests
            generate_report
            ;;
        frontend)
            check_environment
            run_frontend_tests
            generate_report
            ;;
        e2e)
            check_environment
            run_e2e_tests
            generate_report
            ;;
        build)
            run_build_tests
            generate_report
            ;;
        new)
            check_environment
            run_new_features_only
            generate_report
            ;;
        coverage)
            check_environment
            run_coverage_only
            generate_report
            ;;
        quick)
            run_quick_tests
            generate_report
            ;;
        check)
            check_environment
            ;;
        logs)
            show_logs
            ;;
        clean)
            clean_root_logs
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"