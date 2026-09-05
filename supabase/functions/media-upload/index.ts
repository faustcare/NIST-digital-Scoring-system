// Edge Function: 照片上傳（回傳可公開存取的 URL）
// 部署：supabase functions deploy media-upload
// 需登入（Storage RLS 保護 media bucket）

// @ts-ignore Deno 型
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const url_env = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_ANON_KEY')!;
  const auth = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  const supabase = createClient(url_env, key, { global: { headers: { authorization: `Bearer ${auth}` } } });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const sessionId = (formData.get('sessionId') as string) || user.id;
  if (!file) return json({ error: 'no file' }, 400);

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${sessionId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from('media').upload(path, file, { upsert: false });
  if (error) return json({ error: error.message }, 400);
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
  return json({ url: publicUrl, path: data?.path });
});
