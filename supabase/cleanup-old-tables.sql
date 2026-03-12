-- 清理旧版计分表（东/南/西/北 固定 4 人、无登录）
-- 在 Supabase SQL Editor 中执行本脚本后，再执行 schema.sql 建立「用户密码登录」所需的新表
-- 执行后：旧表 players、rounds、round_scores、rooms 会被删除（旧数据清空），请确认后再执行

drop table if exists public.round_scores;
drop table if exists public.rounds;
drop table if exists public.players;
drop table if exists public.rooms;

-- 执行完上面后，在 SQL Editor 再新建一个 query，把 schema.sql 整份复制进去执行。
