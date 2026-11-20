-- Conflict-safe cloud saves.
--
-- Run once in the Supabase SQL Editor (safe to re-run). Until it's run, the
-- app falls back to the plain upsert it used before (see cloudSync.ts).
--
-- Every saved copy gets a revision number. A device saves "on top of"
-- the revision it last saw; if another device saved in between, the save
-- is refused with `revision_conflict`, and the app fetches the newer copy,
-- merges the two and saves again. Without this, the last device to save
-- silently overwrote everything the other one had written.

alter table public.user_stores
  add column if not exists revision bigint not null default 0;

create or replace function public.save_user_store(p_store jsonb, p_base_revision bigint)
returns bigint
language plpgsql
security invoker            -- runs as the caller, so the RLS policies still apply
set search_path = ''
as $$
declare
  v_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  -- A diary is text; 5 MB is far more than any real one needs and stops
  -- a runaway client from filling the database.
  if pg_column_size(p_store) > 5 * 1024 * 1024 then
    raise exception 'store_too_large';
  end if;

  insert into public.user_stores as s (user_id, store_data, revision, updated_at)
  values (auth.uid(), p_store, 1, now())
  on conflict (user_id) do update
    set store_data = excluded.store_data,
        revision   = s.revision + 1,
        updated_at = now()
    where s.revision = p_base_revision
  returning s.revision into v_revision;

  if v_revision is null then
    raise exception 'revision_conflict';
  end if;
  return v_revision;
end;
$$;

revoke all on function public.save_user_store(jsonb, bigint) from public, anon;
grant execute on function public.save_user_store(jsonb, bigint) to authenticated;

-- The password hash of a device-only account used to be uploaded inside
-- the store blob. The app no longer sends it; this clears what's already
-- there.
update public.user_stores
  set store_data = jsonb_set(store_data, '{account,password}', '""'::jsonb)
  where store_data #>> '{account,password}' is not null
    and store_data #>> '{account,password}' <> '';
