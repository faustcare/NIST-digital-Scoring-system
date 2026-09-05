# 規劃 03｜里程碑與開發進度

## M1 MVP ✅ 已完成
- [x] 表單引擎（JSON 驅動，App 內建＋`forms.open-lane.json` 可匯入/匯出）
- [x] 評分閉環：選表單 → Trial Info → 計時 → 打點 → 自動計分 → 暫存 → 結果 → 匯出
- [x] 15 張標準表單（Open 5＋Obstructed 5＋Confined 5）每張 20 targets＋20 缺口
- [x] 條件欄位（間距/照明/風/時限/Pilot View/評分方式）與成績一起儲存
- [x] 計時器（timestamp、暫停、逾時警示）
- [x] 匯出 CSV＋列印/PDF（表單式紙本＋簽名欄）
- [x] 表單管理頁（JSON 編輯/匯入/回復/下載）

## M1.1 ✅ Scenario 表單
- [x] Vehicle Inspection：Fuel Truck / Box Truck（20 題位置分類＋TOP 辨識＋Cargo Bay U–Z）
- [x] Wide Area Search（4 站 × Top/A–D）
- [x] Obstructed Scenario 1–10（10 站 × Straight/Angled）

## M1.2 ✅ Sensor 表單
- [x] SENSING 1–5：4 面板（A 近2S～D 遠6S）× 5 感測（Visual/Color/Hazmat/Motion/Thermal）= 20 題
- [x] 支援 Quick／Comprehensive 程序

## M2 ⬜ 待開發
- [x] 通過門檻設定（可配置 min_score＋時限 → 自動 Pass/Fail，列入匯出） [2026-09-05 完成]
- [x] 歷史報表（考生/場道/Level/時間過濾＋統計＋匯出 CSV） [2026-09-05 完成]
- [x] Supabase 遷移：schema.sql（含 RLS）+ App 雲端同步層（URL/key 可設定、local_id 去重） [2026-09-05 完成]
- [x] 條件可比性警告（間距/照明/Pilot View/時限不同群組標示） [2026-09-05 完成]

## M3 ⬜ 待開發
- [ ] 多考官權限（Admin/Proctor/Viewer）
- [ ] API（見 02-data-model.md）
- [ ] 照片/簽名數位化、QR 開場
- [ ] 打點 UX 進階（長按復原、對齊+缺口連動、震動回饋）
- [ ] 跨版本 NIST 表單控管

## 已知限制（M1）
- 本機單機版：資料在瀏覽器 localStorage，無帳號/同步
- 計分語意可配置但未綁定各 Level 官方通過門檻
- Scenario 之 gap 權重與官方「reliability/efficiency」衍生指標尚待補
