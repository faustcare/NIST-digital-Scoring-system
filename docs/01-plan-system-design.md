# 規劃 01｜需求拆解與系統設計

## 產品定位

現場考評用數位 scoresheet：考官在手機／平板選考試類型 → 填測驗條件 → 開始計時 → 圈選／劃掉打點 → 自動計分 → 存檔並匯出。

> 不做官網／行銷頁，只做「可實際評分」的功能系統。

## 功能模組

```
A. 表單引擎（核心）   JSON 定義表單：場道/Level/題庫/計分規則；後台可新增/編輯/切換 NIST 版本
B. 場次評分 App      建立場次 → 填 Trial Info → 開始計時 → 逐題打點 → 即時算分 → 提交
C. 計時器            timestamp 計算（切分頁不漏秒）、暫停/繼續、逾時警示
D. 成績儲存/匯出     逐題存（非只存總分）；匯出 PDF（表單樣式）/ CSV
E. 權限帳號          Admin（管表單/看全部）／ Proctor（評分）〔M3〕
F. 報表查詢          依考生/場道/Level/時間範圍查歷史〔M3〕
```

## 規格來源（NIST 2020B5 Forms Book）

- 三種場道 × 測項：Open（Position/Traverse/Orbit/Spiral/Recon/Sensor）・ Obstructed（Wall90/Wall45/Ground/Post/Avoid）・ Confined（同 Obstructed，場地半徑減半）
- Scenario：Vehicle Inspection（Fuel/Box Truck）、Wide Area Search、Obstructed Scenario 1–10
- 共同欄位（Form Fill-In Guidance）：Trial Info、Lane Spacing、Lighting（DAYLIGHT/LIGHTED/DARK）、Wind（均/陣風）、Pilot View（EYES ON/BVLOS）、Time Limit（5/10/自訂）、Scoring Source（Pilot/Images）
- 計分語意：green ring 完整 = 5 分、部分 = 1 分；blue gap 方向正確 = 5 分；每表 20 targets = 100 分（對齊）＋100 分（缺口）
- **條件可比性**：成績只在相同 Lane Spacing／照明／風況／時限下可比 → 條件欄位必須與成績一起儲存

## UX 原則（現場操作）

1. 手機優先、大按鈕、高對比、一頁少滾動
2. 每次點擊即自動存檔；斷線可回復
3. 計時與總分永遠固定頂欄可見
4. 快速打點，避免大量打字（單選/勾選/+/−為主，備註才用文字）
5. 一鍵匯出（PDF/CSV/Email）

## 技術選型

| 層 | 最快 MVP | 正式版 |
|---|---|---|
| 前端 | Next.js + Tailwind | 同左 |
| 後端/DB | Supabase（Postgres+Auth+Storage） | NestJS + PostgreSQL |
| PDF | 前端列印樣式 | 伺服端生成 |
| Email | 後加 Resend | Resend/SendGrid |
| 部署 | Vercel | VPS + Docker |
