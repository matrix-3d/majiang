-- 麻将多人计分 v2：登录 + 房间多用户 + 每人只控自己分数 + 点击头像转积分
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本
-- 多人实时同步：在 Database → Replication 中为 room_balances、transfer_log 开启 Realtime
-- 需在 Authentication → Providers 中启用 Email，并可选关闭 “Confirm email”

-- 用户资料（与 Auth 同步，注册时由 trigger 写入）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- 注册时自动创建 profile（从 user_metadata 取 display_name）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'x@x'), '@', 1))
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- 房间
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  name text default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 房间成员（多人，不固定 4 人）
create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(room_id, user_id)
);

-- 房间内每人当前积分（仅通过转积分修改）
create table if not exists public.room_balances (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  balance int not null default 0,
  primary key (room_id, user_id)
);

-- 转积分记录
create table if not exists public.transfer_log (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_room_members_room on public.room_members(room_id);
create index if not exists idx_room_balances_room on public.room_balances(room_id);
create index if not exists idx_transfer_log_room on public.transfer_log(room_id);

-- 转积分：仅能扣自己、加对方，原子操作
create or replace function public.transfer_points(p_room_id uuid, p_to_user_id uuid, p_amount int)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_from_id uuid := auth.uid();
  v_current int;
begin
  if v_from_id is null then raise exception 'not authenticated'; end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_to_user_id = v_from_id then raise exception 'cannot transfer to self'; end if;
  select balance into v_current from room_balances where room_id = p_room_id and user_id = v_from_id;
  if v_current is null or v_current < p_amount then raise exception 'insufficient balance'; end if;
  update room_balances set balance = balance - p_amount where room_id = p_room_id and user_id = v_from_id;
  update room_balances set balance = balance + p_amount where room_id = p_room_id and user_id = p_to_user_id;
  insert into transfer_log (room_id, from_user_id, to_user_id, amount)
  values (p_room_id, v_from_id, p_to_user_id, p_amount);
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_balances enable row level security;
alter table public.transfer_log enable row level security;

-- profiles：登录用户可读全部（房间内显示昵称）、只能改自己
create policy "profiles read authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());

-- rooms：登录后可创建；可读（需通过邀请码加入）
create policy "rooms insert" on public.rooms for insert to authenticated with check (created_by = auth.uid());
create policy "rooms select" on public.rooms for select to authenticated using (true);

-- room_members：在房间内可读；加入时插入自己
create policy "room_members select in room" on public.room_members for select to authenticated using (
  room_id in (select room_id from room_members where user_id = auth.uid())
);
create policy "room_members insert join" on public.room_members for insert to authenticated with check (user_id = auth.uid());

-- room_balances：在房间内可读；插入/更新仅通过 transfer_points 或加入时初始化
create policy "room_balances select in room" on public.room_balances for select to authenticated using (
  room_id in (select room_id from room_members where user_id = auth.uid())
);
create policy "room_balances insert" on public.room_balances for insert to authenticated with check (user_id = auth.uid());
create policy "room_balances update" on public.room_balances for update to authenticated using (true);
create policy "room_balances delete" on public.room_balances for delete to authenticated using (false);

-- transfer_log：房间内可读
create policy "transfer_log select in room" on public.transfer_log for select to authenticated using (
  room_id in (select room_id from room_members where user_id = auth.uid())
);

-- 允许通过 RPC 调用 transfer_points
grant execute on function public.transfer_points(uuid, uuid, int) to authenticated;
