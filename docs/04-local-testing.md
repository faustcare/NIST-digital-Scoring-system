# 本機測試環境（supabase start）— 完整流程

在**你自己的機器**（需 Docker）一鍵啟動本地 Supabase＋Edge Functions，並跑完整 E2E 測試。

> 註：本開發沙箱無 Docker/CLI，無法代跑；下列設定與腳本已就緒於 repo。

## 前置需求

- Docker Desktop（或 Linux docker，記憶體建議 ≥4GB）
- Node.js 18+

## 1. 一鍵啟動

```bash
bash scripts/setup-local.sh
```

自動完成：檢查 Docker → 安裝 supabase CLI → `supabase start`（首次下載映像約數分鐘）→ 套用 `supabase/schema.sql`（含 RLS/Auth trigger/Storage）→ 部署 3 個 Edge Functions 到本地。

輸出參數（本機環境）：
| 項目 | 值 |
|---|---|
| API 端點 | http://localhost:54321 |
| Studio | http://localhost:54323 |
| Functions | http://localhost:54321/functions/v1/{sessions,report,media-upload} |

## 2. 設定測試環境

```bash
cp supabase/test.env.example test.env
# 編輯 test.env：貼上 `supabase status` 輸出的 anon key
```

## 3. 跑完整 E2E 測試

```bash
node scripts/e2e-test.js
```

流程（自動）：
1. 登入測試帳號（`proctor@test.local`，不存在則自動註冊）
2. `POST /functions/v1/sessions` 建立場次 → 驗證回傳 id
3. `GET /functions/v1/sessions` 查詢列表 → 驗證含該筆
4. `PATCH /functions/v1/sessions/:id` 更新 notes → 驗證生效
5. `GET /functions/v1/report?status=done` → 驗證 stats（count/avg/max）
6. `POST /functions/v1/media-upload` 上傳照片 → 驗證 public URL

每一項顯示 ✅/❌，任一失敗 exit 1。

## 存取本機 Studio

瀏覽器開 http://localhost:54323 → 可視覺化檢視 sessions 表、Storage、Auth users。

## 在本機 App 使用

開啟 `app/index.html` → 表單管理 → 填：
- Project URL：`http://localhost:54321`
- anon key：同上
- Edge Functions URL：`http://localhost:54321/functions/v1`
→ 啟用 → 帳號登入（test.env 的帳密）→ 同步（走 API）

## 停止

```bash
bash scripts/teardown-local.sh     # supabase stop
```

## 常見問題

- `supabase db execute` 不存在 → 改 `supabase db reset`（需將 schema.sql 移入 supabase/migrations/）或用 `psql` 手動執行
- Functions 403 → 確認用 `supabase functions deploy`（本地 CLI 自動注入 JWT config），並已在 `config.toml` 設 `[functions] verify_jwt = true`
- 信箱驗證卡住 → 本機預設不需驗證；若需請在 Auth settings 關閉 confirm email
