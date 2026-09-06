#!/usr/bin/env node
/**
 * NIST Digital Scoring System — 本機端到端測試（純 fetch，無需 SDK）
 * 流程：登入(或註冊測試帳號) → 建場次 → 查詢 → 更新 → 報表 → 照片上傳
 * 用法：cp supabase/test.env.example test.env 後填 anon key；node scripts/e2e-test.js
 *       （也可用環境變數 SUPABASE_URL / SUPABASE_ANON_KEY 覆蓋）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, '..', 'test.env');
function loadEnv() {
  const out = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}
const fileEnv = loadEnv();
const BASE = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || 'http://localhost:54321';
const ANON = process.env.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || '';
const EMAIL = fileEnv.TEST_EMAIL || 'proctor@test.local';
const PASS = fileEnv.TEST_PASSWORD || 'test-password-123';
const FN = `${BASE}/functions/v1`;

let passed = 0, failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}\n${detail}`); }
}
async function bodyText(r) {
  try { return (await r.text()).slice(0, 400); } catch { return '<無法讀取回應>'; }
}

async function authToken() {
  // 1) 嘗試以密碼登入
  let r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (r.ok) return (await r.json()).access_token;
  // 2) 不存在則註冊一次
  r = await fetch(`${BASE}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, data: { full_name: 'Proctor Test' } }),
  });
  if (!r.ok) {
    const t = await bodyText(r);
    throw new Error(`登入/註冊失敗 (${r.status}): ${t}\n→ 檢查：test.env 的 anon key 是否與 supabase status 一致；config.toml 是否已設 [auth.email] enable_confirmations = false`);
  }
  // 3) 註冊後再登入
  r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!r.ok) throw new Error(`註冊後登入失敗 (${r.status}): ${await bodyText(r)}`);
  return (await r.json()).access_token;
}

async function main() {
  console.log(`NIST 本機 E2E 測試 — ${BASE}\n`);
  if (!ANON) {
    console.error('❌ 未設定 anon key。請執行：cp supabase/test.env.example test.env，填入 SUPABASE_ANON_KEY（supabase status 輸出）後重跑。');
    process.exit(1);
  }
  const token = await authToken();
  const H = { apikey: ANON, authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 1) 建場次
  console.log('1) 建立場次 (POST /sessions)');
  const sessionBody = { local_id: 'e2e-' + Date.now(), form_id: 'open-position', candidate: 'E2E 考生',
    aircraft_make: 'DJI', aircraft_model: 'Mavic 3E', facility: '本機測試場', lane_spacing: '10',
    lighting: 'DAYLIGHT', pilot_view: 'EYES ON', time_limit_min: 10, status: 'done',
    scores: { A1: 'pass', A2: 'pass', A3: 'partial', G1: 'ok', GA1: 'ok' } };
  let r = await fetch(`${FN}/sessions`, { method: 'POST', headers: H, body: JSON.stringify(sessionBody) });
  let created = {}; try { created = await r.json(); } catch {}
  check('回傳 201 且含 id', r.status === 201 && created.data && created.data.id,
    `status=${r.status} body=${JSON.stringify(created).slice(0, 400)}`);
  const sid = created.data?.id;

  // 2) 查詢列表
  console.log('2) 場次列表 (GET /sessions)');
  r = await fetch(`${FN}/sessions`, { headers: H });
  let list = {}; try { list = await r.json(); } catch {}
  check('回傳陣列且含剛建的場次', r.ok && Array.isArray(list.data) && list.data.some(x => x.id === sid),
    `status=${r.status} count=${(list.data || []).length} body=${JSON.stringify(list).slice(0, 400)}`);

  // 3) 更新
  if (sid) {
    console.log('3) 更新場次 (PATCH /sessions/:id)');
    r = await fetch(`${FN}/sessions/${sid}`, { method: 'PATCH', headers: H, body: JSON.stringify({ notes: 'E2E 更新' }) });
    let upd = {}; try { upd = await r.json(); } catch {}
    check('更新成功且 notes 生效', r.ok && upd.data && upd.data.notes === 'E2E 更新',
      `status=${r.status} body=${JSON.stringify(upd).slice(0, 400)}`);
  }

  // 4) 報表
  console.log('4) 報表彙總 (GET /report?status=done)');
  r = await fetch(`${FN}/report?status=done`, { headers: H });
  let rep = {}; try { rep = await r.json(); } catch {}
  check('回傳 stats 且有資料', r.ok && rep.stats && rep.stats.count >= 1,
    `status=${r.status} body=${JSON.stringify(rep).slice(0, 400)}`);

  // 5) 照片上傳
  console.log('5) 照片上傳 (POST /media-upload)');
  const blob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
  const fd = new FormData(); fd.append('file', blob, 'test.jpg'); fd.append('sessionId', sid || 'e2e');
  r = await fetch(`${FN}/media-upload`, { method: 'POST', headers: { apikey: ANON, authorization: `Bearer ${token}` }, body: fd });
  let up = {}; try { up = await r.json(); } catch {}
  check('回傳 public URL', r.ok && up.url && String(up.url).startsWith('http'),
    `status=${r.status} body=${JSON.stringify(up).slice(0, 400)}`);

  console.log(`\n結果：${passed} 通過 / ${failed} 失敗`);
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error('❌ E2E 錯誤:', e.message); process.exit(2); });
