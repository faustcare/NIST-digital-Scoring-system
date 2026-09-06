// Edge Function: 場次 CRUD（Supabase 正式後端 API）
// 部署：supabase functions deploy sessions
// 需登入：Authorization: Bearer <user JWT>（由 supabase-js 登入取得）

// @ts-ignore Deno 型
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
}

function getClient(req: Request) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_ANON_KEY')!;
  const auth = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  return createClient(url, key, { global: { headers: { authorization: `Bearer ${auth}` } } });
}

const COLUMNS = 'id,local_id,form_id,proctor_id,candidate,aircraft_make,aircraft_model,payload,personnel,facility,trial_date,trial_time,lane_no,lane_spacing,lighting,wind_avg,wind_gust,pilot_view,time_limit_min,time_elapsed_ms,scoring_source,status,fault_code,notes,scores,created_at,updated_at';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const supabase = getClient(req);
  const url = new URL(req.url);
  const id = url.pathname.split('/').filter(Boolean).pop() || '';

  try {
    // GET /sessions        -> 本人場次列表
    // GET /sessions/{id}   -> 單筆
    if (req.method === 'GET') {
      let q = supabase.from('sessions').select(COLUMNS);
      if (id) {
        const { data, error } = await q.eq('id', id).maybeSingle();
        if (error) return json({ error: error.message }, 400);
        if (!data) return json({ error: 'not found' }, 404);
        return json({ data });
      }
      // 過濾（報表用）
      const { searchParams: p } = url;
      if (p.get('candidate')) q = q.ilike('candidate', `%${p.get('candidate')}%`);
      if (p.get('lane')) q = q.ilike('form_id', `%${p.get('lane')}%`); // 表單代號模糊比對
      if (p.get('level')) q = q.eq('level', p.get('level'));
      if (p.get('from')) q = q.gte('trial_date', p.get('from')!);
      if (p.get('to')) q = q.lte('trial_date', p.get('to')!);
      if (p.get('status')) q = q.eq('status', p.get('status'));
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    // POST /sessions -> 建立（proctor_id = auth.uid()；RLS 生效）
    if (req.method === 'POST') {
      const body = await req.json();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return json({ error: 'unauthorized' }, 401);
      const { data, error } = await supabase.from('sessions').insert({ ...body, proctor_id: user.id }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }
    // PATCH /sessions/{id} -> 更新（含 scores / status / notes / media）
    if (req.method === 'PATCH' && id) {
      const body = await req.json();
      const { data, error } = await supabase.from('sessions').update(body).eq('id', id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }
    // DELETE /sessions/{id}
    if (req.method === 'DELETE' && id) {
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'server error' }, 500);
  }
});
