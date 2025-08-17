# 貢獻指南

感謝您對 YOLO Object Detection Annotation Tool 的關注！

## 開發流程

### 1. 環境設置

**前端開發環境：**
```bash
# 安裝依賴
pnpm install

# 啟動開發服務器
pnpm dev

# 運行測試
pnpm test
```

**後端開發環境：**
```bash
cd backend

# 安裝依賴
pip install -r requirements.txt
pip install -r test-requirements.txt

# 啟動服務器
python start.py

# 運行測試
pytest --cov=. --cov-report=html
```

### 2. 代碼品質標準

**前端：**
- 使用 ESLint 進行代碼檢查：`pnpm lint`
- TypeScript 嚴格模式，無型別錯誤
- 重要功能建議添加適當的測試
- 遵循現有的 React + TypeScript 模式

**後端：**
- 使用 flake8 進行 Python 代碼檢查
- pytest 測試覆蓋率要求 > 80%
- 遵循 FastAPI + SQLAlchemy 模式
- 使用 Pydantic 進行數據驗證

### 3. 提交規範

**提交訊息格式：**
```
<type>: <description>

例如：
feat: 新增圖片批量上傳功能
fix: 修復標注儲存時的競態條件
docs: 更新 API 文檔
test: 增加使用者認證測試
```

**分支命名：**
- `feature/功能名稱` - 新功能
- `bugfix/問題描述` - 修復
- `hotfix/緊急修復` - 緊急修復

### 4. Pull Request 流程

1. **建立分支**：從 `main` 建立新分支
2. **開發**：按照代碼品質標準進行開發
3. **測試**：確保所有測試通過
4. **提交**：使用規範的提交訊息
5. **PR**：填寫完整的 PR 模板
6. **審查**：等待代碼審查和 CI 檢查

### 5. CI/CD 流程

**自動檢查項目：**
- ✅ ESLint 代碼風格檢查
- ✅ TypeScript 編譯檢查
- ✅ 前端建置驗證
- ✅ Python 語法檢查
- ✅ pytest 單元測試
- ✅ 測試覆蓋率報告

**PR 合併要求：**
- 所有 CI 檢查必須通過
- 至少一位維護者的代碼審查
- 無合併衝突

### 6. 發布流程

要建立新版本，在提交訊息中包含 `[release]`：

```bash
git commit -m "[release] v1.2.3: 新增重要功能"
git push origin main
```

系統會自動：
- 建立 Git tag
- 生成 GitHub Release
- 上傳建置產物

### 7. 開發建議

**學習既有模式：**
- 查看 `src/features/` 中的功能模組結構
- 參考 `src/components/ui/` 中的 UI 元件
- 遵循 `backend/services/` 中的服務層模式

**測試策略：**
- 前端：程式碼品質檢查和建置驗證
- 後端：API 端點和業務邏輯的單元測試
- 整合測試：資料庫操作和檔案處理

**性能考量：**
- 使用 React.memo 和 useMemo 優化渲染
- 實現適當的快取策略
- 注意大圖片檔案的記憶體使用

## 問題回報

如果發現 bug 或有功能建議，請：

1. 檢查是否已有相關 issue
2. 使用 issue 模板建立詳細報告
3. 提供重現步驟和環境資訊

## 聯絡方式

如有任何問題，歡迎通過 GitHub Issues 或 PR 進行討論。