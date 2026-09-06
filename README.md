# NIST-digital-Scoring-system

Digital Scoring system for the NIST DRONE TRAINING using in the TFAZ training center

NIST sUAS（無人機）現場考評用之數位評分系統。將 NIST 官方紙本 scoresheet 數位化：選表單 → 填測驗條件 → 開始計時 → 圈選／劃掉打點 → 自動計分 → 存檔／匯出。

**依據規格**：NIST Standard Test Methods for sUAS（2020B5）Open/Obstructed Test Lane Forms Book
**官方來源**：https://www.nist.gov/system/files/documents/2021/02/12/NIST%20sUAS%20Open%20Test%20Lane%20-%20Forms%20Book.pdf

## 目前狀態（M1–M3 功能完成）

- 評分網站（單檔、RWD 響應式、離線可用）：`app/index.html` — 直接雙擊即可在瀏覽器使用
- 表單庫配置：`app/forms.open-lane.json`
- 內建 **20 張表單**：Open（Position/Traverse/Orbit/Spiral/Recon）・ Obstructed（Wall90/Wall45/Ground/Post/Avoid）・ Confined（同組）・ Scenario（Fuel Truck/Box Truck/Wide Area Search/Obstructed 1–10）・ Sensor（SENSING 1–5）
- 功能：表單引擎（JSON 驅動）、測驗條件（Trial Info）、計時器（暫停/逾時）、自動計分（對齊 5/部分 1/漏失 0＋缺口 5）、暫存、結果頁（通過判定/簽名欄）、匯出 CSV＋列印/PDF、表單管理（JSON 匯入/匯出/回復預設）

## 專案結構

```
docs/01-plan-system-design.md   # 規劃：需求拆解與系統設計
docs/02-data-model.md           # 規劃：資料模型與 API
docs/03-roadmap.md              # 里程碑與後續開發
docs/04-local-testing.md        # 本機測試環境（supabase start＋E2E）
docs/05-deployment.md           # 部署文件（本機測試→Supabase Cloud 上線）
app/index.html                  # 評分網站（單檔、RWD：行動／平板／桌機自適應）
supabase/migrations/            # 資料庫 migration（0001_init.sql，本機/雲端共用）
app/forms.open-lane.json        # 表單庫配置（20 張表單）
```

## 開發藍圖

| 里程碑 | 內容 | 狀態 |
|---|---|---|
| M1 MVP | 表單引擎＋評分閉環（選表單→計時→打點→計分→存檔→匯出） | ✅ 完成 |
| M1.1 | Scenario 表單（Vehicle×2/WAS/Obstructed 1–10） | ✅ 完成 |
| M1.2 | Sensor 表單（SENSING 1–5） | ✅ 完成 |
| M2 | 通過門檻設定 ✅、Supabase schema＋雲端同步 ✅、歷史報表＋可比性警告 ✅ | ✅ 完成 |
| M3 | 多考官權限 ✅、API（Edge Functions）✅、照片/簽名數位化 ✅、本機測試環境＋E2E ✅、部署文件 | ✅ 完成（部署文件待驗證） |

詳細規劃見 `docs/`。
