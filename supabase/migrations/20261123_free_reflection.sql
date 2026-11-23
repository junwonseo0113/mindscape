-- One free weekly reflection per account, enforced by the server.
--
-- Run once in the Supabase SQL Editor (safe to re-run). Until it's run,
-- free reflections are refused (the API fails closed); Plus still works.
--
-- The app used to count the free reflection on the device, so anyone
-- calling /api/weekly-reflection directly could get unlimited free ones.
-- Now the API records the use here after a reflection is generated.
-- Users can read their own row but have no insert/update/delete policy,
-- so the only way to write is claim_free_reflection(), which can only add
-- the caller's own row and never remove it.

create table if not exists public.free_reflection_uses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  used_at timestamptz not null default now()
);

alter table public.free_reflection_uses enable row level security;

drop policy if exists "Users can read their own free reflection use" on public.free_reflection_uses;
create policy "Users can read their own free reflection use"
  on public.free_reflection_uses for select
  using (auth.uid() = user_id);

-- Returns true only for the first claim. The primary key makes two
-- simultaneous requests race safely: exactly one insert wins.
create or replace function public.claim_free_reflection()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.free_reflection_uses (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing
  returning user_id into v_claimed;
  return v_claimed is not null;
end;
$$;

revoke all on function public.claim_free_reflection() from public, anon;
grant execute on function public.claim_free_reflection() to authenticated;
