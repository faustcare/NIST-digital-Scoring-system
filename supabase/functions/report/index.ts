// Edge Function: 歷史報表彙總（考生/場道/Level/時間過濾 + 統計）
// 部署：supabase functions deploy report
// 需登入（RLS：proctor 看自己的、admin 看全部）

// @ts-ignore Deno 型
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  const url_env = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_ANON_KEY')!;
  const auth = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const supabase = createClient(url_env, key, { global: { headers: { authorization: `Bearer ${auth}` } } });

  const p = new URL(req.url).searchParams;
  let q = supabase.from('sessions').select('*');
  if (p.get('candidate')) q = q.ilike('candidate', `%${p.get('candidate')}%`);
  if (p.get('lane')) q = q.eq('form_id', p.get('lane')!);
  if (p.get('level')) q = q.eq('level', p.get('level')!);
  if (p.get('from')) q = q.gte('trial_date', p.get('from')!);
  if (p.get('to')) q = q.lte('trial_date', p.get('to')!);
  if (p.get('status')) q = q.eq('status', p.get('status')!);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 400);

  const done = (data || []).filter((x: any) => x.status === 'done');
  const total = (x: any) => (x.scores ? Object.values(x.scores).filter((v: any) => v === 'pass').length * 5 + (x.scores && Object.keys(x.scores).filter(k => k.startsWith('G') && x.scores[k] === 'ok').length * 5) : 0);
  const totals = done.map(total);
  const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
  const max = totals.length ? Math.max(...totals) : 0;

  return json({ data: done, stats: { count: done.length, avg, max } });
});
