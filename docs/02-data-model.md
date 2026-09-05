# 規劃 02｜資料模型與 API（正式版）

## PostgreSQL Schema（Supabase）

### forms（表單定義）
| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | |
| lane_type | text | open / obstructed / confined / scenario |
| level | text | 1-3 / 4 / 5 |
| name | text | Position、Wall90… |
| kind | text | bucket / scenario / sensor |
| version | text | 2020B5 |
| time_limit_min | int | 預設時限 |
| passing_rule | jsonb | 各單位通過門檻（可空） |

### form_items（題目）
| 欄位 | 型別 | 說明 |
|---|---|---|
| id | uuid pk | |
| form_id | fk | |
| code | text | A1…D5、1…4D、S1…S20 |
| row | text | 分組列（可空） |
| label | text | 中文標籤 |
| point_mode | text | green/blue/none |
| has_gap | bool | 是否有缺口評分 |
| sort_order | int | |

### users（帳號）
id, name, email, role（admin/proctor/viewer）

### sessions（場次）
| 欄位 | 說明 |
|---|---|
| id | uuid pk |
| form_id | fk |
| proctor_id | fk users |
| candidate | 考生姓名/編號 |
| aircraft_make / model / payload | 飛機資訊 |
| personnel / facility | 考官/設施 |
| date / time / lane_no | 時間地點 |
| lane_spacing / lighting / wind_avg / wind_gust / pilot_view | 條件欄位（可比性）|
| time_limit_min / time_elapsed_ms | 時限/用時 |
| scoring_source | Pilot / Images |
| status | draft / done |
| fault_code | 結束原因（安全等）|

### session_items（逐題成績 — 務必逐題存）
| 欄位 | 說明 |
|---|---|
| id | uuid pk |
| session_id | fk |
| item_id | fk |
| result | pass / partial / miss / ok / no |
| score | 該題得分 |
| note | 備註 |

### session_exports
id, session_id, type（pdf/csv）, file_url, created_at

## Supabase 遷移（已完成 v1）

- `supabase/schema.sql`：forms / form_items / profiles / sessions / session_items / session_exports 全表 + RLS（本人讀寫＋admin 全看）+ updated_at 觸發器 + 索引
- App「表單管理」內建雲端同步：填 Project URL + anon key → 啟用 → 上傳/下載場次（以 local_id 去重）
- 未設定時完全離線、不影響既有使用

## API 層（Edge Functions 已完成）

- `supabase/functions/sessions`：場次 CRUD（GET 列表/單筆、POST 建立含 auth.uid()、PATCH 更新、DELETE）
- `supabase/functions/report`：報表彙總（過濾＋count/avg/max）
- `supabase/functions/media-upload`：照片上傳回傳 public URL
- 皆以 Bearer user JWT 呼叫、受 RLS 保護；`config.toml` 設 verify_jwt。部署：`supabase functions deploy <name>`

## API 草案（REST）

```
POST   /api/sessions                建立場次（含 trial info）
GET    /api/sessions/{id}           取得場次+逐題
PATCH  /api/sessions/{id}/score     回報單題結果
PATCH  /api/sessions/{id}/timer     開始/暫停/完成（伺服器時間）
POST   /api/sessions/{id}/export    產生 PDF/CSV
GET    /api/forms                  表單清單（引擎） 
POST   /api/forms                  新增/更新表單（Admin）
GET    /api/reports?filters=…       歷史報表（M3）
```

## 計時器設計要點

- 用伺服器 timestamp：`elapsed = startedAt 累加 + (now - startedAt)`
- 前端的 setTimeout 只負責畫面更新，不負責計時 → 切分頁/鎖螢幕不漏秒
