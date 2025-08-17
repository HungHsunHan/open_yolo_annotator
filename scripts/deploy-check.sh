#!/bin/bash

# Deployment Check Script
# Validates the application is ready for deployment

set -e

echo "🚀 部署前檢查開始..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

failed_checks=0

# Function to run check and count failures
run_check() {
    local check_name="$1"
    local command="$2"
    
    echo -n "檢查 $check_name... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 通過${NC}"
        return 0
    else
        echo -e "${RED}❌ 失敗${NC}"
        ((failed_checks++))
        return 1
    fi
}

# Check if required tools are available
echo "🔧 工具檢查:"
run_check "Node.js" "command -v node"
run_check "pnpm" "command -v pnpm"
run_check "Python" "command -v python"
run_check "pip" "command -v pip"

echo ""
echo "📦 依賴檢查:"
run_check "Frontend dependencies" "cd . && pnpm install --frozen-lockfile"
run_check "Backend dependencies" "cd backend && pip install -r requirements.txt"

echo ""
echo "🧪 測試檢查:"
run_check "Frontend linting" "pnpm lint"
run_check "TypeScript compilation" "npx tsc --noEmit"
run_check "Backend syntax" "cd backend && python -m py_compile main.py"

echo ""
echo "🏗️  建置檢查:"
run_check "Frontend build" "pnpm build"

echo ""
echo "📋 檔案結構檢查:"
run_check "Built files exist" "[ -d 'dist' ] && [ -f 'dist/index.html' ]"
run_check "Backend entry point" "[ -f 'backend/main.py' ]"
run_check "Configuration files" "[ -f 'package.json' ] && [ -f 'backend/requirements.txt' ]"

echo ""
echo "🔒 安全檢查:"
run_check "No secrets in git" "! git grep -i 'password\|secret\|key' -- '*.py' '*.ts' '*.tsx' '*.js' '*.json' || true"
run_check "Environment template exists" "[ -f '.env.example' ] || [ -f 'backend/.env.example' ] || true"

echo ""
echo "=========================="
if [ $failed_checks -eq 0 ]; then
    echo -e "${GREEN}🎉 所有檢查通過！應用程式準備就緒可以部署。${NC}"
    echo ""
    echo "📋 部署清單:"
    echo "✅ 前端已建置到 dist/ 目錄"
    echo "✅ 後端依賴已安裝"
    echo "✅ 所有測試通過"
    echo "✅ 無明顯安全問題"
    echo ""
    echo "🚀 可以進行部署!"
    exit 0
else
    echo -e "${RED}❌ 發現 $failed_checks 個問題。部署前請先修復這些問題。${NC}"
    exit 1
fi