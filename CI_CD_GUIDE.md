# CI/CD 使用指南

本專案已設置簡單但完整的 CI/CD 流水線，使用 GitHub Actions 進行自動化測試、建置和部署。

## 🚀 CI/CD 概覽

### 自動化流程
- ✅ **程式碼品質檢查** - ESLint、TypeScript、Python語法
- ✅ **自動化測試** - pytest 單元測試（後端）
- ✅ **建置驗證** - 確保程式碼可以正確建置
- ✅ **測試覆蓋率** - 自動生成和上傳覆蓋率報告
- ✅ **版本發布** - 自動標籤和 GitHub Release
- ✅ **品質控制** - PR 檢查和保護規則

## 📋 CI 流水線詳情

### 前端 CI 流程
```yaml
前端檢查 → ESLint → TypeScript 編譯 → 建置驗證
```

**包含步驟:**
1. **程式碼檢查**: ESLint 檢查程式碼風格和潛在問題
2. **型別檢查**: TypeScript 編譯器檢查型別正確性
3. **建置驗證**: 使用 Vite 建置前端應用確保無錯誤

### 後端 CI 流程
```yaml
後端檢查 → Python 語法 → pytest 測試 → 覆蓋率報告
```

**包含步驟:**
1. **語法檢查**: flake8 檢查 Python 代碼規範
2. **單元測試**: pytest 執行所有測試案例
3. **覆蓋率**: 生成測試覆蓋率報告
4. **報告上傳**: 上傳到 Codecov 和產生 HTML 報告

## 🔄 開發工作流程

### 1. 功能開發
```bash
# 建立功能分支
git checkout -b feature/新功能名稱

# 開發和測試
pnpm dev  # 前端開發
python backend/start.py  # 後端開發

# 本地測試
pnpm lint  # 前端檢查
pnpm build  # 建置測試
cd backend && pytest  # 後端測試
```

### 2. 提交和 PR
```bash
# 提交變更
git add .
git commit -m "feat: 新增某某功能"
git push origin feature/新功能名稱

# 建立 Pull Request
# GitHub 會自動觸發 CI 檢查
```

### 3. CI 自動檢查
當建立 PR 或推送到主分支時，CI 會自動執行：

- ✅ 前端檢查 (ESLint + TypeScript + 建置驗證)
- ✅ 後端檢查 (flake8 + pytest + 覆蓋率)
- ✅ 建置產物生成 (僅主分支)

### 4. 程式碼審查
- 所有 CI 檢查必須通過 ✅
- 至少需要一位維護者審查
- 無合併衝突

## 📦 版本發布

### 自動發布
在提交訊息中包含 `[release]` 即可觸發自動發布：

```bash
# 指定版本號
git commit -m "[release] v1.2.3: 新增重要功能"

# 自動版本遞增 (patch)
git commit -m "[release] 修復重要 bug"

git push origin main
```

系統會自動：
1. 建立 Git 標籤
2. 生成 changelog
3. 建立 GitHub Release
4. 上傳建置產物

## 🛠️ 本地工具

### 健康檢查腳本
```bash
# 檢查應用程式狀態
./scripts/health-check.sh
```

### 部署前檢查
```bash
# 驗證部署準備就緒
./scripts/deploy-check.sh
```

## 📊 報告和監控

### 測試報告
- **覆蓋率報告**: 上傳到 Codecov，HTML 報告存在 `backend/htmlcov/`

### 建置產物
- **前端建置**: 成功建置的 `dist/` 目錄上傳到 Artifacts
- **保留期限**: 30 天

## 🔧 常見問題

### CI 失敗怎麼辦？

1. **ESLint 錯誤**:
   ```bash
   pnpm lint  # 檢查具體錯誤
   ```

2. **TypeScript 錯誤**:
   ```bash
   npx tsc --noEmit  # 檢查型別錯誤
   ```

3. **建置失敗**:
   ```bash
   pnpm build  # 本地執行建置
   ```

4. **後端測試失敗**:
   ```bash
   cd backend
   pytest -v  # 詳細輸出
   pytest --lf  # 只執行上次失敗的測試
   ```

### 如何跳過某些檢查？

一般不建議跳過，但緊急情況下：

```bash
# 只針對特定提交跳過 CI (不推薦)
git commit -m "feat: 緊急修復 [skip ci]"
```

### 如何在本地模擬 CI？

```bash
# 執行所有檢查
pnpm lint && npx tsc --noEmit && pnpm build
cd backend && flake8 . && pytest --cov=.

# 或使用部署檢查腳本
./scripts/deploy-check.sh
```

## 🚀 部署準備

當您準備部署時：

1. 確保所有 CI 檢查通過
2. 執行 `./scripts/deploy-check.sh`
3. 建立 release 提交觸發自動版本發布
4. 下載建置產物進行部署

## 📚 進階配置

### 自定義 CI 行為

修改 `.github/workflows/ci.yml` 來：
- 調整測試逾時時間
- 添加額外的檢查步驟
- 修改快取策略

### 分支保護規則

建議在 GitHub 設定中啟用：
- 要求通過狀態檢查
- 要求程式碼審查
- 限制推送權限

這樣確保所有變更都經過 CI 驗證和人工審查。