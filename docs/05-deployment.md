# NIST 數位評分系統 — 部署文件（本機測試 → Supabase Cloud 正式上線）

本文涵蓋從**本機開發／驗證（supabase start）**到**正式上線 Supabase Cloud** 的完整路徑，依 Supabase 官方建議的 CLI migration 工作流：本機開發 → 以 migration 管理 schema → 建立雲端專案 → `supabase link` → `db push` → `functions deploy` → 生產檢查清單上線。

> 相關文件：本機測試環境細節見 `docs/04-local-testing.md`；資料模型見 `docs/02-data-model.md`。

## 0. 部署總覽

| 階段 | 環境 | 說明 |
|---|---|---|
| 0 | 本機 | `supabase start` ＋ `e2e-test.js` 完整驗證（**上線前的必要驗證關**） |
| 1 | 雲端 | Supabase Dashboard 建立專案，取得 Project Ref |
| 2 | 雲端 | `supabase login` ＋ `supabase link --project-ref <ref>` |
| 3 | 雲端 | `supabase db push`（套用 `supabase/migrations/`） |
| 4 | 雲端 | `supabase functions deploy`（3 個 Edge Functions） |
| 5 | 雲端 | Auth 正式設定（確認 Email、Site URL、Admin 帳號、SMTP） |
| 6 | 雲端 | Storage（bucket 由 migration 建立，只需確認） |
| 7 | 雲端 | App 端填入正式 URL／key，登入驗證 |
| 8 | 雲端 | 對雲端跑 `e2e-test.js` 驗收（預期 5/5 ✅） |
| 9 | 雲端（選） | 表單資料初始化（目前非必要） |
| 10 | 雲端 | 正式上線檢查清單（安全／效能／可用性）＋ CI/CD ＋ 回滾 |

## 1. 前置需求

- Docker Desktop（或 Linux docker）— 僅本機階段需要
- Node.js 18+ — 跑 E2E 測試
- `supabase` CLI — `scripts/setup-local.sh` 會自動安裝；或手動 `npm i -g supabase`
- GitHub 帳號（放 repo）＋ Supabase 帳號（雲端）

## 2. 階段 0 — 本機測試（必要驗證關）

正式部署前，先用本機 stack 驗證全部功能（詳見 `docs/04-local-testing.md`）：

```bash
bash scripts/setup-local.sh     # 啟動本機 Supabase＋套用 migration＋部署 functions
cp supabase/test.env.example test.env   # 填 anon key（supabase status 輸出）
node scripts/e2e-test.js        # 預期 5/5 ✅（登入/建場次/查詢/更新/報表/上傳）
```

> 本機測試通過（5/5 ✅）才進行雲端步驟。任何 ❌ 先回本機修好再上雲端。

## 3. 階段 1 — 建立 Supabase Cloud 專案

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard) → **New project**
2. 填寫：
   - **Name**：例如 `nist-digital-scoring-system`
   - **Database Password**：產生強密碼並**保存**（`supabase link` 需要）
   - **Region**：選離使用者最近的區域（台灣建議東京 `ap-northeast-1` 或新加坡 `ap-southeast-1`）
3. Create project，等待初始化（約 2 分鐘）
4. 記下 **Project Ref**：Dashboard URL 中 `<ref>.supabase.co` 的 `<ref>` 部分（形如 `abcdefghijklmnopqrst`）

## 4. 階段 2 — CLI 登入並連結專案

```bash
supabase login                    # 跳瀏覽器授權（token 存 ~/.supabase/access-token）
supabase projects list            # 確認能看到剛建的專案
supabase link --project-ref <ref> # 輸入該專案的 DB password
```

- `link` 會把雲端 project ref 寫入 `supabase/config.toml` 的 `project_id`
- 確認已連結：`supabase projects list` 或看 config.toml
- 若 CLI 版本過舊無法 link，先 `supabase --version` 並升級

## 5. 階段 3 — 部署資料庫（migrations）

repo 已將 schema 固化為 migration：`supabase/migrations/0001_init.sql`（內容＝`supabase/schema.sql`：6 張表＋RLS＋Auth trigger＋Storage bucket＋索引）。

```bash
supabase db push
```

- **驗證**：Dashboard → **Table Editor** 應看到 `forms`、`form_items`、`profiles`、`sessions`、`session_items`、`session_exports`；**Storage** 有 `media` bucket；**SQL Editor** 可查 `select count(*) from sessions;`
- 替代做法（不推薦）：SQL Editor 手動貼 `supabase/schema.sql` 執行
- 之後每次 schema 變更：**新增** migration 檔（`supabase migration new <name>`）→ 本機測試 → `supabase db push`（不要直接改線上表）

## 6. 階段 4 — 部署 Edge Functions

```bash
supabase functions deploy sessions
supabase functions deploy report
supabase functions deploy media-upload
# 或一次全部部署：supabase functions deploy
```

- `config.toml` 已設 `[functions] verify_jwt = true`，部署時自動對雲端生效（未帶有效 JWT 的請求回 403）
- 三個函數在雲端**自動注入** `SUPABASE_URL`／`SUPABASE_ANON_KEY` 環境變數，**不需**手動 `supabase secrets set`
- **驗證**：瀏覽器開 `https://<ref>.supabase.co/functions/v1/sessions`（未登入應回 401/403，代表函數已上線並驗 JWT）

## 7. 階段 5 — Auth 正式設定（Dashboard）

| 項目 | 設定 |
|---|---|
| Email provider | 開啟（預設） |
| **Email confirmations** | **正式上線建議開**（本機的 `enable_confirmations = false` 只在本地 config.toml 生效，不影響雲端） |
| Site URL / Redirect | Authentication → URL Configuration：`Site URL` 填 App 實際所在位置（例如 GitHub Pages 的 `https://<user>.github.io/nist-scoresheet/`）；另把測試時用的 `http://localhost:3000` 加入 Additional Redirect URLs |
| 自訂 SMTP（選） | Authentication → Emails → SMTP：接自有信箱（若開 confirmations，驗證信預設由 Supabase 代發，會有服務商名稱） |

**建立 Admin 帳號**（schema 的 trigger 會自動為每個註冊者建 `profiles.role='proctor'`）：

```bash
# 1) 先到 App 用你的信箱註冊一個帳號（或用 SQL 直接 insert auth.users 較複雜，建議 App 註冊）
# 2) 在 Dashboard → SQL Editor 執行：
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = '你的管理員信箱');
```

> 注意官方 rate limit：email 型 endpoint（signup／recover）預設 **2 封/小時**（未接自訂 SMTP 時）；驗證信被大量測試拖住可等限制解除，或接自訂 SMTP（可到 30 新用戶/小時）。

## 8. 階段 6 — Storage 確認

`media` bucket 與讀寫 RLS 已在 migration 內（`db push` 已建立）：

- Dashboard → **Storage** → 應有 `media` bucket（Public）
- 不必另行建 bucket 或設 policy

## 9. 階段 7 — App 端正式設定

開啟 `app/index.html` → 雲端同步設定，填入：

| 欄位 | 值 |
|---|---|
| Project URL | `https://<ref>.supabase.co` |
| anon key | Dashboard → **Settings → API** 的 `anon public`（僅填 anon，**勿填 service_role**） |
| Edge Functions URL | `https://<ref>.supabase.co/functions/v1` |

→ 啟用 → 用（已確認信箱的）帳號登入 → 同步。之後現場打點、存檔皆走雲端 API。

## 10. 階段 8 — 對雲端跑驗收 E2E

E2E 腳本支援環境變數覆蓋，可直接對雲端跑：

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
TEST_EMAIL=<你已註冊的測試信箱> \
TEST_PASSWORD=<該帳號密碼> \
node scripts/e2e-test.js
```

- 若雲端已開 Email confirmations：腳本「自動註冊」會卡 — 請先用 App 手動註冊並確認信箱，再以該帳密執行腳本（或暫時關 confirmations 測完再開）
- 預期 **5/5 ✅**；任何 ❌ 依輸出 body 排查（見「雲端排錯」）

## 11. 階段 9（可選）— 表單資料初始化

目前 App **離線優先、內建 20 張表單**（與 `app/forms.open-lane.json` 同份），雲端 `forms`／`form_items` 表是為日後「跨版本表單管理」預留，**現階段可留空**。

若要預先 seed（以 SQL Editor 或 scripts 執行，從 `app/forms.open-lane.json` 產生 INSERT）即先填入；不做也不影響現有功能。

## 12. 階段 10 — 正式上線檢查清單（出自 Supabase going-into-prod）

**安全**
- [x] RLS：全部資料表已啟用（migration 內含）— 上線後到 Database → Tables 逐一確認
- [ ] **SSL Enforcement**：Database → Settings → SSL Configuration → 開啟
- [ ] **Network Restrictions**（可選）：限定只允許現場／辦公室 IP 存取資料庫
- [ ] Supabase 帳號開 **MFA**；組織加第二 Owner
- [ ] Email confirmations 開啟（見階段 5）
- [ ] 使用自訂 SMTP（見階段 5）

**效能**
- [x] 索引已建（`sessions(proctor_id / form_id / status)`）
- [ ] 若預期大量使用者，先做負載測試（k6 等）；一般現場場次規模（數台平板）可跳過

**可用性／備份**
- [ ] **Free plan 限制**：低活動 7 天會被暫停；**備份無法下載** — 試營運可接受，正式改用 **Pro**（$25/月起，每日備份、不暫停）
- [ ] 資料庫 >4 GB 時加購 **PITR**（時間點還原）
- [ ] 帳號級 MFA＋多 Owner（同上）

> 完整官方清單：https://supabase.com/docs/guides/deployment/going-into-prod

## 13. CI/CD（可選，建議）

兩個官方路線擇一：

**A. Dashboard 整合（最簡單）**：Project → Settings → Integrations → 連 GitHub repo → 開啟 **Deploy to production** → 之後 merge 到 `main` 自動跑 migration＋函數部署。

**B. GitHub Actions**（官方 [supabase/setup-cli](https://github.com/marketplace/actions/supabase-cli-action)）：在 repo 建 `.github/workflows/deploy.yaml`：

```yaml
name: Deploy Supabase
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
      - run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
      - run: supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

需在 repo Settings → Secrets 設 `SUPABASE_ACCESS_TOKEN`（`supabase access-tokens` 產生）與 `SUPABASE_DB_PASSWORD`。

## 14. 更新與回滾

| 變更 | 做法 |
|---|---|
| Edge Functions 更新 | 改 `supabase/functions/*/index.ts` → `supabase functions deploy <name>` |
| Edge Functions 回滾 | Dashboard → Edge Functions → 選函數 → Manage versions 回滾；或 `supabase functions rollback <slug> <version>` |
| DB schema | 一律**新增 migration**（`supabase migration new`）→ 本機測試 → `supabase db push`；**不要**直接改線上表 |
| DB 回滾 | 精準回滾：寫反向 migration；災難還原：用備份／PITR |
| App 更新 | 更新 `app/index.html` 後重新發布／部署到 App 所在位置（離線 App 可重新載入頁面即取新版本） |

## 15. 雲端排錯

| 症狀 | 可能原因 | 解法 |
|---|---|---|
| Functions 回 403 | anon key 錯誤／JWT 過期/缺失／`verify_jwt` | 檢查 App 設定 key；重新登入；確認請求帶 `Authorization: Bearer` |
| Functions 回 404 | 尚未部署，或 link 到錯專案 | `supabase functions deploy`；`supabase link --project-ref <ref>` 重連 |
| 註冊 400 | Email confirmations／**rate limit（2 封/小時）** | 確認信箱；等 1 小時或接自訂 SMTP |
| 登入後查無資料 | RLS：admin 看全部、proctor 只看自己的 | 確認帳號 role（`select * from profiles;`） |
| `column not found` | migration 未 push | `supabase db push`（先確認 `supabase/migrations/` 存在且為最新） |
| 照片上傳 400 | `media` bucket 未建／RLS | 確認 DB push 有跑；或手動建 `media` public bucket |
| CORS 錯誤 | 從 `file://` 開 App 時瀏覽器限制 | 用 localhost／正式網域開啟；config 已設 `Access-Control-Allow-Origin: *`，確認請求含 `apikey`/`Content-Type` header |

## 16. 成本參考

- **Free**：適合試營運 — 但有 7 天低活動暫停、備份不可下載、email 2 封/小時限制
- **Pro**（$25/月起）：每日備份、不因低活動暫停、可加 PITR、較高 rate limits（email 新用戶 30/小時）
- 詳細價格見 https://supabase.com/pricing（本文件不代列數字，以官方為準）

---

*文件版本：2026-09-06（對應 commit `a836eba` 後）*
