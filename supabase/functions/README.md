# Supabase Edge Functions（正式後端 API）

| Function | 用途 | 端點 |
|---|---|---|
| `sessions` | 場次 CRUD（GET 列表/單筆、POST 建立、PATCH 更新、DELETE） | `.../functions/v1/sessions` |
| `report` | 歷史報表彙總（考生/場道/Level/時間過濾 + count/avg/max） | `.../functions/v1/report` |
| `media-upload` | 照片上傳（回傳 public URL） | `.../functions/v1/media-upload` |

## 部署

```bash
# 安裝 supabase CLI（本機）
npm i -g supabase
# 登入後部署（需在專案目錄）
supabase functions deploy sessions
supabase functions deploy report
supabase functions deploy media-upload
```

## 呼叫範例

```js
// 登入後取得 user JWT
const { data: { session } } = await supabase.auth.signInWithPassword({ email, password });

// 建立場次
await fetch('https://<project>.supabase.co/functions/v1/sessions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ candidate: '王小明', form_id: 'open-position', ... })
});

// 報表
await fetch('https://<project>.supabase.co/functions/v1/report?lane=open&level=3', {
  headers: { 'Authorization': `Bearer ${session.access_token}` }
});
```

## 注意

- 所有函數都仰賴 RLS（`sessions` 的 own/admin 政策）；Edge Function 以 `auth.getUser()` 解析使用者
- 需在函數內用 `Deno.env.get('SUPABASE_URL')` / `SUPABASE_ANON_KEY`（部署時自動注入）
- JWT 驗證依 `config.toml` 的 `[functions] verify_jwt = true`
