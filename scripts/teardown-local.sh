#!/usr/bin/env bash
# 停止並移除本機 Supabase 容器（保留資料卷可加 -v）
cd "$(dirname "$0")/.."
supabase stop
