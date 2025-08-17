#!/bin/bash

# Health Check Script for YOLO Annotation Tool
# This script checks if the application components are running properly

set -e

echo "🔍 開始健康檢查..."

# Configuration
FRONTEND_URL="http://localhost:8080"
BACKEND_URL="http://localhost:8000"
TIMEOUT=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if URL is accessible
check_url() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    echo -n "檢查 $name ($url)... "
    
    if command -v curl > /dev/null; then
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
        if [ "$response" = "$expected_status" ]; then
            echo -e "${GREEN}✅ OK${NC}"
            return 0
        else
            echo -e "${RED}❌ Failed (HTTP $response)${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  curl not available, skipping${NC}"
        return 0
    fi
}

# Function to check if port is listening
check_port() {
    local port=$1
    local name=$2
    
    echo -n "檢查 $name (port $port)... "
    
    if command -v netstat > /dev/null; then
        if netstat -ln | grep -q ":$port "; then
            echo -e "${GREEN}✅ Listening${NC}"
            return 0
        else
            echo -e "${RED}❌ Not listening${NC}"
            return 1
        fi
    elif command -v lsof > /dev/null; then
        if lsof -i ":$port" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Listening${NC}"
            return 0
        else
            echo -e "${RED}❌ Not listening${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  No port checking tool available${NC}"
        return 0
    fi
}

# Function to check file/directory existence
check_file() {
    local path=$1
    local name=$2
    
    echo -n "檢查 $name ($path)... "
    
    if [ -e "$path" ]; then
        echo -e "${GREEN}✅ Exists${NC}"
        return 0
    else
        echo -e "${RED}❌ Missing${NC}"
        return 1
    fi
}

# Start health checks
failed_checks=0

echo "📋 基礎檔案檢查:"
check_file "package.json" "Frontend package.json" || ((failed_checks++))
check_file "backend/requirements.txt" "Backend requirements.txt" || ((failed_checks++))
check_file "backend/main.py" "Backend main.py" || ((failed_checks++))

echo ""
echo "🌐 網路服務檢查:"
check_port 8080 "Frontend Port" || ((failed_checks++))
check_port 8000 "Backend Port" || ((failed_checks++))

echo ""
echo "🚀 HTTP 端點檢查:"
check_url "$FRONTEND_URL" "Frontend" || ((failed_checks++))
check_url "$BACKEND_URL/docs" "Backend API Docs" || ((failed_checks++))
check_url "$BACKEND_URL/health" "Backend Health Endpoint" || ((failed_checks++))

echo ""
echo "💾 儲存目錄檢查:"
check_file "backend/storage" "Storage Directory" || ((failed_checks++))
check_file "backend/storage/images" "Images Directory" || ((failed_checks++))
check_file "backend/storage/annotations" "Annotations Directory" || ((failed_checks++))

echo ""
echo "🗄️  資料庫檢查:"
if [ -f "backend/yolo_annotation.db" ]; then
    echo -e "檢查 SQLite 資料庫... ${GREEN}✅ Found${NC}"
    
    # Check if we can connect to the database
    if command -v sqlite3 > /dev/null; then
        if sqlite3 backend/yolo_annotation.db "SELECT 1;" > /dev/null 2>&1; then
            echo -e "檢查資料庫連接... ${GREEN}✅ Connected${NC}"
        else
            echo -e "檢查資料庫連接... ${RED}❌ Connection failed${NC}"
            ((failed_checks++))
        fi
    else
        echo -e "檢查資料庫連接... ${YELLOW}⚠️  sqlite3 not available${NC}"
    fi
else
    echo -e "檢查 SQLite 資料庫... ${YELLOW}⚠️  Not found (may be using PostgreSQL)${NC}"
fi

echo ""
echo "=========================="
if [ $failed_checks -eq 0 ]; then
    echo -e "${GREEN}🎉 所有檢查通過！應用程式狀態良好。${NC}"
    exit 0
else
    echo -e "${RED}❌ 發現 $failed_checks 個問題。請檢查上述失敗項目。${NC}"
    exit 1
fi