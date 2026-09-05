-- ============================================================
-- NIST Digital Scoring System — Supabase Schema (v1)
-- 在 Supabase Dashboard → SQL Editor 執行
-- ============================================================

-- ---------- 表單定義 ----------
create table if not exists public.forms (
  id            uuid primary key default gen_random_uuid(),
  form_id       text unique not null,            -- 對應 App 的 form.id（open-position…）
  lane_type     text not null,                   -- open / obstructed / confined / scenario
  level         text,
  name          text not null,                   -- Position、Wall90…
  title         text,
  kind          text default 'bucket',           -- bucket / scenario / sensor
  version       text default '2020B5',
  time_limit_min int default 10,
  passing_rule  jsonb,                           -- { min_score, time_limit_fail }
  created_at    timestamptz default now()
);

-- ---------- 題目 ----------
create table if not exists public.form_items (
  id          uuid primary key default gen_random_uuid(),
  form_uuid   uuid references public.forms(id) on delete cascade,
  code        text not null,                    -- A1…D5、1…4D、S1…S20
  row         text,                             -- 分組列（可空）
  label       text,
  has_gap     boolean default true,
  sort_order  int default 0,
  unique(form_uuid, code)
);

-- ---------- 帳號（對應 Supabase Auth） ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text default 'proctor',           -- admin / proctor / viewer
  created_at  timestamptz default now()
);

-- ---------- 場次（含逐題 scores jsonb） ----------
create table if not exists public.sessions (
  id              uuid primary key default gen_random_uuid(),
  local_id        text unique,                  -- App 端 localStorage id（同步去重用）
  form_uuid       uuid references public.forms(id),
  proctor_id      uuid references public.profiles(id),
  candidate       text,
  aircraft_make   text, aircraft_model text, payload text,
  personnel       text, facility text,
  trial_date      date, trial_time text, lane_no text,
  lane_spacing    text, lighting text,
  wind_avg        text, wind_gust text,
  pilot_view      text,
  time_limit_min  int, time_elapsed_ms bigint default 0,
  scoring_source  text default 'Pilot',
  status          text default 'draft',          -- draft / done
  fault_code      text,
  notes           text,
  scores          jsonb default '{}'::jsonb,     -- { "A1":"pass", "G1":"ok", … }
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ---------- 逐題成績（正式稽核用；M3 拆表） ----------
create table if not exists public.session_items (
  id            uuid primary key default gen_random_uuid(),
  session_uuid  uuid references public.sessions(id) on delete cascade,
  item_code     text not null,
  result        text,                            -- pass / partial / miss / ok / no
  score         int,
  note          text
);

-- ---------- 匯出紀錄 ----------
create table if not exists public.session_exports (
  id            uuid primary key default gen_random_uuid(),
  session_uuid  uuid references public.sessions(id) on delete cascade,
  export_type   text,                            -- pdf / csv
  file_url      text,
  created_at    timestamptz default now()
);

-- ---------- Row Level Security ----------
-- 啟用後：本人可讀寫自己的場次；admin 可看全部
alter table public.sessions enable row level security;
alter table public.session_items enable row level security;
alter table public.session_exports enable row level security;

drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all using (proctor_id = auth.uid())
  with check (proctor_id = auth.uid());

drop policy if exists "admin all sessions" on public.sessions;
create policy "admin all sessions" on public.sessions
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "own items" on public.session_items;
create policy "own items" on public.session_items
  for all using (
    exists (select 1 from public.sessions s where s.id = session_uuid and s.proctor_id = auth.uid())
  );

-- ---------- 觸發器：更新 updated_at ----------
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists sessions_touch on public.sessions;
create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();

-- ---------- 索引 ----------
create index if not exists idx_sessions_proctor on public.sessions(proctor_id);
create index if not exists idx_sessions_form on public.sessions(form_uuid);
create index if not exists idx_sessions_status on public.sessions(status);

-- ============================================================
-- Supabase Auth 支援（多人共用）
-- 在既有 schema 之後執行（可重複執行）
-- ============================================================

-- 註冊時自動建立 profile（full_name 取自 signUp 的 metadata）
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'proctor')
  on conflict (id) do nothing;
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- profiles RLS：本人可讀自己的；admin 可讀全部
alter table public.profiles enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "admin all profiles" on public.profiles;
create policy "admin all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- forms / form_items：所有已登入使用者可讀（表單引擎共用）
alter table public.forms enable row level security;
drop policy if exists "forms readable" on public.forms;
create policy "forms readable" on public.forms for select using (true);

alter table public.form_items enable row level security;
drop policy if exists "form_items readable" on public.form_items;
create policy "form_items readable" on public.form_items for select using (true);

-- 提示：將 sessions 的 proctor_id 設為 auth.uid() 後，
-- 既有「own sessions」RLS 即自動讓 proctor 只看自己的場次、admin 看全部。

-- ---------- Storage（現場照片） ----------
insert into storage.buckets (id, name, public)
values ('media','media',true) on conflict (id) do nothing;
drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');
drop policy if exists "media auth insert" on storage.objects;
create policy "media auth insert" on storage.objects
  for insert with check (bucket_id = 'media' and auth.role() = 'authenticated');
