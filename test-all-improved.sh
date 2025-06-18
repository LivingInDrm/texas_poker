#!/bin/bash

# Texas Poker 统一测试执行脚本 v2.4 - 改进版本
# 基于重构后的功能域测试架构和TEST_STANDARDS.md规范
# 改进：准确区分测试文件状态（通过/失败/无法运行）

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

# 测试结果统计
TESTS_PASSED=0
TESTS_FAILED=0
TEST_SUMMARY=""

# 改进的后端统计变量：区分通过/失败/无法运行
# 游戏引擎测试
BACKEND_GAME_FILES=0
BACKEND_GAME_FILES_PASSED=0     # 文件中所有测试都通过
BACKEND_GAME_FILES_FAILED=0     # 文件中有测试失败（但能运行）
BACKEND_GAME_FILES_ERROR=0      # 文件无法运行（编译错误等）
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

# 数据存储测试
BACKEND_STORAGE_FILES=0
BACKEND_STORAGE_FILES_PASSED=0
BACKEND_STORAGE_FILES_FAILED=0
BACKEND_STORAGE_FILES_ERROR=0
BACKEND_STORAGE_TESTS=0
BACKEND_STORAGE_TESTS_PASSED=0
BACKEND_STORAGE_TESTS_FAILED=0
BACKEND_STORAGE_TESTS_SKIPPED=0

# 后端总计
BACKEND_TOTAL_FILES=0
BACKEND_TOTAL_FILES_PASSED=0
BACKEND_TOTAL_FILES_FAILED=0
BACKEND_TOTAL_FILES_ERROR=0
BACKEND_TOTAL_TESTS=0
BACKEND_TOTAL_TESTS_PASSED=0
BACKEND_TOTAL_TESTS_FAILED=0
BACKEND_TOTAL_TESTS_SKIPPED=0

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

# 改进的Jest结果解析函数
parse_jest_results_enhanced() {
    local log_file="$1"
    local module_type="$2"
    
    if [ ! -f "$log_file" ]; then
        return
    fi
    
    log_info "解析测试结果: $log_file (模块: $module_type)"
    
    # 分析每个测试文件的状态
    local files_passed=0
    local files_failed=0
    local files_error=0
    local total_files=0
    
    # 检查是否有编译错误（无法运行的文件）
    local compilation_errors=$(grep -c "Test suite failed to run" "$log_file" 2>/dev/null || echo "0")
    files_error=$compilation_errors
    
    # 计算能运行的文件数量
    local pass_lines=$(grep -c "^PASS " "$log_file" 2>/dev/null || echo "0")
    local fail_lines=$(grep -c "^FAIL " "$log_file" 2>/dev/null || echo "0")
    
    files_passed=$pass_lines
    
    # 从FAIL中减去编译错误数量，得到运行失败的数量
    files_failed=$((fail_lines - files_error))
    
    total_files=$((files_passed + files_failed + files_error))
    
    # 解析测试用例统计
    local test_suites_line=$(grep "Test Suites:" "$log_file" | tail -1)
    local tests_line=$(grep "Tests:" "$log_file" | tail -1)
    
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local skipped_tests=0
    
    if [ -n "$tests_line" ]; then
        total_tests=$(echo "$tests_line" | grep -o '[0-9]\+ total' | grep -o '[0-9]\+' || echo "0")
        passed_tests=$(echo "$tests_line" | grep -o '[0-9]\+ passed' | grep -o '[0-9]\+' || echo "0")
        failed_tests=$(echo "$tests_line" | grep -o '[0-9]\+ failed' | grep -o '[0-9]\+' || echo "0")
        skipped_tests=$(echo "$tests_line" | grep -o '[0-9]\+ skipped' | grep -o '[0-9]\+' || echo "0")
    fi
    
    # 输出调试信息
    log_info "文件统计: 总计=$total_files, 通过=$files_passed, 失败=$files_failed, 错误=$files_error"
    log_info "测试统计: 总计=$total_tests, 通过=$passed_tests, 失败=$failed_tests, 跳过=$skipped_tests"
    
    # 根据模块类型设置对应变量
    case "$module_type" in
        "game")
            BACKEND_GAME_FILES=$total_files
            BACKEND_GAME_FILES_PASSED=$files_passed
            BACKEND_GAME_FILES_FAILED=$files_failed
            BACKEND_GAME_FILES_ERROR=$files_error
            BACKEND_GAME_TESTS=$total_tests
            BACKEND_GAME_TESTS_PASSED=$passed_tests
            BACKEND_GAME_TESTS_FAILED=$failed_tests
            BACKEND_GAME_TESTS_SKIPPED=$skipped_tests
            ;;
        "api")
            BACKEND_API_FILES=$total_files
            BACKEND_API_FILES_PASSED=$files_passed
            BACKEND_API_FILES_FAILED=$files_failed
            BACKEND_API_FILES_ERROR=$files_error
            BACKEND_API_TESTS=$total_tests
            BACKEND_API_TESTS_PASSED=$passed_tests
            BACKEND_API_TESTS_FAILED=$failed_tests
            BACKEND_API_TESTS_SKIPPED=$skipped_tests
            ;;
        "realtime")
            BACKEND_REALTIME_FILES=$total_files
            BACKEND_REALTIME_FILES_PASSED=$files_passed
            BACKEND_REALTIME_FILES_FAILED=$files_failed
            BACKEND_REALTIME_FILES_ERROR=$files_error
            BACKEND_REALTIME_TESTS=$total_tests
            BACKEND_REALTIME_TESTS_PASSED=$passed_tests
            BACKEND_REALTIME_TESTS_FAILED=$failed_tests
            BACKEND_REALTIME_TESTS_SKIPPED=$skipped_tests
            ;;
        "storage")
            BACKEND_STORAGE_FILES=$total_files
            BACKEND_STORAGE_FILES_PASSED=$files_passed
            BACKEND_STORAGE_FILES_FAILED=$files_failed
            BACKEND_STORAGE_FILES_ERROR=$files_error
            BACKEND_STORAGE_TESTS=$total_tests
            BACKEND_STORAGE_TESTS_PASSED=$passed_tests
            BACKEND_STORAGE_TESTS_FAILED=$failed_tests
            BACKEND_STORAGE_TESTS_SKIPPED=$skipped_tests
            ;;
        "total")
            BACKEND_TOTAL_FILES=$total_files
            BACKEND_TOTAL_FILES_PASSED=$files_passed
            BACKEND_TOTAL_FILES_FAILED=$files_failed
            BACKEND_TOTAL_FILES_ERROR=$files_error
            BACKEND_TOTAL_TESTS=$total_tests
            BACKEND_TOTAL_TESTS_PASSED=$passed_tests
            BACKEND_TOTAL_TESTS_FAILED=$failed_tests
            BACKEND_TOTAL_TESTS_SKIPPED=$skipped_tests
            ;;
    esac
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

# 运行后端测试的演示函数
run_backend_tests_demo() {
    log_info "🔧 运行后端测试（演示改进的统计）..."
    echo "========================================"
    
    setup_logging
    
    # 为了演示，我们分析现有的日志文件
    local existing_logs_dir="/Users/xiaochunliu/texas_poker/test-logs/20250618_102645"
    
    if [ -d "$existing_logs_dir" ]; then
        log_info "分析现有的测试日志..."
        
        # 分析游戏引擎测试
        if [ -f "$existing_logs_dir/backend_game_tests.log" ]; then
            log_info "分析游戏引擎测试..."
            parse_jest_results_enhanced "$existing_logs_dir/backend_game_tests.log" "game"
        fi
        
        # 分析API接口测试
        if [ -f "$existing_logs_dir/backend_api_tests.log" ]; then
            log_info "分析API接口测试..."
            parse_jest_results_enhanced "$existing_logs_dir/backend_api_tests.log" "api"
        fi
        
        # 分析实时通信测试
        if [ -f "$existing_logs_dir/backend_realtime_tests.log" ]; then
            log_info "分析实时通信测试..."
            parse_jest_results_enhanced "$existing_logs_dir/backend_realtime_tests.log" "realtime"
        fi
        
        # 分析数据存储测试
        if [ -f "$existing_logs_dir/backend_storage_tests.log" ]; then
            log_info "分析数据存储测试..."
            parse_jest_results_enhanced "$existing_logs_dir/backend_storage_tests.log" "storage"
        fi
        
        # 计算总计
        BACKEND_TOTAL_FILES=$((BACKEND_GAME_FILES + BACKEND_API_FILES + BACKEND_REALTIME_FILES + BACKEND_STORAGE_FILES))
        BACKEND_TOTAL_FILES_PASSED=$((BACKEND_GAME_FILES_PASSED + BACKEND_API_FILES_PASSED + BACKEND_REALTIME_FILES_PASSED + BACKEND_STORAGE_FILES_PASSED))
        BACKEND_TOTAL_FILES_FAILED=$((BACKEND_GAME_FILES_FAILED + BACKEND_API_FILES_FAILED + BACKEND_REALTIME_FILES_FAILED + BACKEND_STORAGE_FILES_FAILED))
        BACKEND_TOTAL_FILES_ERROR=$((BACKEND_GAME_FILES_ERROR + BACKEND_API_FILES_ERROR + BACKEND_REALTIME_FILES_ERROR + BACKEND_STORAGE_FILES_ERROR))
        
        BACKEND_TOTAL_TESTS=$((BACKEND_GAME_TESTS + BACKEND_API_TESTS + BACKEND_REALTIME_TESTS + BACKEND_STORAGE_TESTS))
        BACKEND_TOTAL_TESTS_PASSED=$((BACKEND_GAME_TESTS_PASSED + BACKEND_API_TESTS_PASSED + BACKEND_REALTIME_TESTS_PASSED + BACKEND_STORAGE_TESTS_PASSED))
        BACKEND_TOTAL_TESTS_FAILED=$((BACKEND_GAME_TESTS_FAILED + BACKEND_API_TESTS_FAILED + BACKEND_REALTIME_TESTS_FAILED + BACKEND_STORAGE_TESTS_FAILED))
        BACKEND_TOTAL_TESTS_SKIPPED=$((BACKEND_GAME_TESTS_SKIPPED + BACKEND_API_TESTS_SKIPPED + BACKEND_REALTIME_TESTS_SKIPPED + BACKEND_STORAGE_TESTS_SKIPPED))
        
    else
        log_warning "没有找到现有的测试日志目录"
    fi
}

# 生成改进的统计报告
generate_enhanced_report() {
    echo
    log_info "📊 生成改进的测试统计报告..."
    echo "========================================"
    echo
    
    echo -e "${BLUE}🔧 后端测试统计（改进版）${NC}"
    echo "========================================"
    
    if [ "$BACKEND_TOTAL_FILES" -gt 0 ]; then
        echo "📊 总体统计:"
        echo "  📁 测试文件: $BACKEND_TOTAL_FILES"
        echo "     🟢 完全通过: $BACKEND_TOTAL_FILES_PASSED"
        echo "     🟡 有失败用例: $BACKEND_TOTAL_FILES_FAILED"  
        echo "     🔴 无法运行: $BACKEND_TOTAL_FILES_ERROR"
        echo "  🧪 测试用例: $BACKEND_TOTAL_TESTS (通过: $BACKEND_TOTAL_TESTS_PASSED, 失败: $BACKEND_TOTAL_TESTS_FAILED, 跳过: $BACKEND_TOTAL_TESTS_SKIPPED)"
        echo
    fi
    
    if [ "$BACKEND_GAME_FILES" -gt 0 ]; then
        echo "🎯 游戏引擎测试:"
        echo "  📁 测试文件: $BACKEND_GAME_FILES (🟢通过: $BACKEND_GAME_FILES_PASSED, 🟡失败: $BACKEND_GAME_FILES_FAILED, 🔴错误: $BACKEND_GAME_FILES_ERROR)"
        echo "  🧪 测试用例: $BACKEND_GAME_TESTS (通过: $BACKEND_GAME_TESTS_PASSED, 失败: $BACKEND_GAME_TESTS_FAILED, 跳过: $BACKEND_GAME_TESTS_SKIPPED)"
        echo
    fi
    
    if [ "$BACKEND_API_FILES" -gt 0 ]; then
        echo "🌐 API接口测试:"
        echo "  📁 测试文件: $BACKEND_API_FILES (🟢通过: $BACKEND_API_FILES_PASSED, 🟡失败: $BACKEND_API_FILES_FAILED, 🔴错误: $BACKEND_API_FILES_ERROR)"
        echo "  🧪 测试用例: $BACKEND_API_TESTS (通过: $BACKEND_API_TESTS_PASSED, 失败: $BACKEND_API_TESTS_FAILED, 跳过: $BACKEND_API_TESTS_SKIPPED)"
        echo
    fi
    
    if [ "$BACKEND_REALTIME_FILES" -gt 0 ]; then
        echo "⚡ 实时通信测试:"
        echo "  📁 测试文件: $BACKEND_REALTIME_FILES (🟢通过: $BACKEND_REALTIME_FILES_PASSED, 🟡失败: $BACKEND_REALTIME_FILES_FAILED, 🔴错误: $BACKEND_REALTIME_FILES_ERROR)"
        echo "  🧪 测试用例: $BACKEND_REALTIME_TESTS (通过: $BACKEND_REALTIME_TESTS_PASSED, 失败: $BACKEND_REALTIME_TESTS_FAILED, 跳过: $BACKEND_REALTIME_TESTS_SKIPPED)"
        echo
    fi
    
    if [ "$BACKEND_STORAGE_FILES" -gt 0 ]; then
        echo "💾 数据存储测试:"
        echo "  📁 测试文件: $BACKEND_STORAGE_FILES (🟢通过: $BACKEND_STORAGE_FILES_PASSED, 🟡失败: $BACKEND_STORAGE_FILES_FAILED, 🔴错误: $BACKEND_STORAGE_FILES_ERROR)"
        echo "  🧪 测试用例: $BACKEND_STORAGE_TESTS (通过: $BACKEND_STORAGE_TESTS_PASSED, 失败: $BACKEND_STORAGE_TESTS_FAILED, 跳过: $BACKEND_STORAGE_TESTS_SKIPPED)"
        echo
    fi
    
    echo -e "${BLUE}📈 状态说明${NC}"
    echo "🟢 完全通过: 文件中所有测试用例都通过"
    echo "🟡 有失败用例: 文件能运行，但有测试用例失败"
    echo "🔴 无法运行: 文件无法运行（编译错误、导入错误等）"
    echo
    
    echo -e "${BLUE}🎯 改进效果对比${NC}"
    echo "========================================"
    echo "原版本描述 API接口测试: 📁 测试文件: 2 (可运行: 1, 编译错误: 1)"
    echo "改进版本描述 API接口测试: 📁 测试文件: $BACKEND_API_FILES (🟢通过: $BACKEND_API_FILES_PASSED, 🟡失败: $BACKEND_API_FILES_FAILED, 🔴错误: $BACKEND_API_FILES_ERROR)"
    echo
    echo "更加准确地区分了三种状态，避免了'编译错误'的误用！"
}

# 显示帮助信息
show_help() {
    echo "Texas Poker 测试执行脚本 v2.4 (改进版)"
    echo
    echo "改进内容:"
    echo "  - 准确区分测试文件状态：完全通过/有失败用例/无法运行"
    echo "  - 避免将运行时错误误报为编译错误"
    echo "  - 提供更详细和准确的测试统计信息"
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  demo         运行改进版本的演示"
    echo "  help         显示此帮助信息"
    echo
}

# 主函数
main() {
    echo -e "${BLUE}🧪 Texas Poker 测试脚本 v2.4 (改进版)${NC}"
    echo -e "${BLUE}改进：准确区分测试文件状态${NC}"
    echo "========================================"
    echo
    
    case "${1:-demo}" in
        demo)
            run_backend_tests_demo
            generate_enhanced_report
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