#!/usr/bin/env bash
# NIST Digital Scoring System — 本機測試環境一鍵啟動
# 需求：Docker（Desktop）＋ Node.js 18+
# 用法：bash scripts/setup-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "==> 檢查 Docker…"
docker info >/dev/null 2>&1 || { echo "❌ Docker 未啟動或不支援。請先啟動 Docker Desktop / 安裝 docker。"; exit 1; }
echo "==> 檢查 supabase CLI…"
if ! command -v supabase >/dev/null 2>&1; then
  echo "==> 安裝 supabase CLI…"
  npm i -g supabase 2>/dev/null || curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh || { echo "❌ 安裝 supabase CLI 失敗，請手動安裝後重試。"; exit 1; }
fi
supabase --version
# schema 以 migration 形式套用：supabase start 會自動依序執行 supabase/migrations/
mkdir -p supabase/migrations
if [ ! -f supabase/migrations/0001_init.sql ]; then
  cp supabase/schema.sql supabase/migrations/0001_init.sql
  echo "==> 複製 supabase/schema.sql → supabase/migrations/0001_init.sql"
fi
echo "==> 啟動 Supabase 本地 stack（首次會下載映像，約數分鐘）…"
supabase start
echo "==> 部署 Edge Functions（本地）…"
supabase functions deploy sessions
supabase functions deploy report
supabase functions deploy media-upload
echo "=========================================================="
echo "✅ 本機環境就緒"
supabase status
echo "   Studio     : http://localhost:54323"
echo "   Functions  : http://localhost:54321/functions/v1/{sessions,report,media-upload}"
echo "=========================================================="
echo "下一步：cp supabase/test.env.example test.env（填 anon key），"
echo "       再執行 node scripts/e2e-test.js 跑完整測試流程。"
