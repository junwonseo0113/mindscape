begin;

-- Additive, local-only migration. Do not apply until reviewed in the target project.
-- Premium remains disabled until a real subscription authority replaces BOTH
-- ideal_self_premium_access() and src/server/idealSelf/service.ts premiumAvailability().
create or replace function public.ideal_self_premium_access(p_user_id uuid)
returns boolean language sql stable set search_path = '' as $$ select false $$;
revoke all on function public.ideal_self_premium_access(uuid) from public;
grant execute on function public.ideal_self_premium_access(uuid) to authenticated;

create table if not exists public.ideal_self_profile_versions (
  version uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fields jsonb not null check (jsonb_typeof(fields) = 'object'),
  created_at timestamptz not null default now(),
  unique(user_id, version)
);
create table if not exists public.ideal_self_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version uuid not null,
  fields jsonb not null check (jsonb_typeof(fields) = 'object'),
  updated_at timestamptz not null default now(),
  foreign key(user_id, version) references public.ideal_self_profile_versions(user_id, version) on delete cascade
);
create table if not exists public.ideal_self_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fields jsonb not null,
  explanation text not null,
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) between 1 and 12),
  inputs_hash text not null check (length(inputs_hash) = 64),
  review_state text not null default 'pending' check (review_state in ('pending','accepted','edited','rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.ideal_self_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_version uuid not null,
  criterion_key text not null check (criterion_key in ('qualities','values','aspirations','avoid')),
  criterion_quote text not null check (length(criterion_quote) between 1 and 1000),
  interpretation text not null check (length(interpretation) between 1 and 1800),
  relation text not null check (relation in ('alignment','tension','mixed','insufficient_evidence')),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) <= 12),
  question text not null check (length(question) between 1 and 500),
  inputs_hash text not null check (length(inputs_hash) = 64),
  review_state text not null default 'pending' check (review_state in ('pending','accepted','edited','rejected')),
  reviewed_text text check (length(reviewed_text) between 1 and 1800),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(user_id, profile_version) references public.ideal_self_profile_versions(user_id, version) on delete cascade
);
create index if not exists ideal_self_suggestions_owner on public.ideal_self_suggestions(user_id,created_at desc);
create index if not exists ideal_self_comparisons_owner on public.ideal_self_comparisons(user_id,created_at desc);

alter table public.ideal_self_profile_versions enable row level security;
alter table public.ideal_self_profiles enable row level security;
alter table public.ideal_self_suggestions enable row level security;
alter table public.ideal_self_comparisons enable row level security;
revoke all on public.ideal_self_profiles, public.ideal_self_profile_versions, public.ideal_self_suggestions, public.ideal_self_comparisons from public, anon, authenticated;
grant select on public.ideal_self_profiles, public.ideal_self_profile_versions to authenticated;
grant select, insert on public.ideal_self_suggestions, public.ideal_self_comparisons to authenticated;
grant update(review_state) on public.ideal_self_suggestions to authenticated;
grant update(review_state,reviewed_text,reviewed_at) on public.ideal_self_comparisons to authenticated;

create policy "Read own Ideal Self profile" on public.ideal_self_profiles for select to authenticated using (auth.uid() = user_id);
create policy "Read own Ideal Self versions" on public.ideal_self_profile_versions for select to authenticated using (auth.uid() = user_id);
-- No direct profile writes: confirmation and version checks are atomic in the RPC below.
create policy "Own Premium suggestions" on public.ideal_self_suggestions for all to authenticated
  using (auth.uid() = user_id and public.ideal_self_premium_access(auth.uid()))
  with check (auth.uid() = user_id and public.ideal_self_premium_access(auth.uid()));
create policy "Own Premium comparisons" on public.ideal_self_comparisons for all to authenticated
  using (auth.uid() = user_id and public.ideal_self_premium_access(auth.uid()))
  with check (auth.uid() = user_id and public.ideal_self_premium_access(auth.uid()));

create or replace function public.save_ideal_self_profile(p_fields jsonb, p_expected_version uuid,
  p_suggestion_id uuid default null, p_suggestion_state text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid(); current_profile public.ideal_self_profiles;
  suggestion public.ideal_self_suggestions; next_version uuid := gen_random_uuid(); field_name text;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
  if jsonb_typeof(p_fields) <> 'object' or p_fields is null then raise exception 'Invalid profile'; end if;
  if (select count(*) from jsonb_object_keys(p_fields)) <> 4 then raise exception 'Invalid fields'; end if;
  foreach field_name in array array['qualities','values','aspirations','avoid'] loop
    if jsonb_typeof(p_fields -> field_name) is distinct from 'string' or length(p_fields ->> field_name) > 4000 then raise exception 'Invalid field'; end if;
  end loop;
  if not exists(select 1 from jsonb_each_text(p_fields) v where length(trim(v.value)) > 0) then raise exception 'Empty profile'; end if;
  select * into current_profile from public.ideal_self_profiles where user_id = owner_id for update;
  if current_profile.version is distinct from p_expected_version then raise exception 'Profile version changed' using errcode = '40001'; end if;
  if p_suggestion_id is not null then
    if not public.ideal_self_premium_access(owner_id) then raise exception 'Verified Premium required' using errcode = '42501'; end if;
    select * into suggestion from public.ideal_self_suggestions where id = p_suggestion_id and user_id = owner_id for update;
    if suggestion.id is null or suggestion.review_state <> 'pending' or p_suggestion_state not in ('accepted','edited') or p_suggestion_state is null then raise exception 'Explicit confirmation required'; end if;
    if p_suggestion_state = 'accepted' and p_fields <> suggestion.fields then raise exception 'Edited suggestions must be confirmed as edits'; end if;
  elsif p_suggestion_state is not null then raise exception 'Invalid confirmation';
  end if;
  insert into public.ideal_self_profile_versions(version,user_id,fields) values(next_version,owner_id,p_fields);
  insert into public.ideal_self_profiles(user_id,version,fields) values(owner_id,next_version,p_fields)
    on conflict(user_id) do update set version=excluded.version,fields=excluded.fields,updated_at=now();
  if p_suggestion_id is not null then update public.ideal_self_suggestions set review_state=p_suggestion_state where id=p_suggestion_id and user_id=owner_id; end if;
  return (select to_jsonb(p) from public.ideal_self_profiles p where user_id=owner_id);
end $$;
revoke all on function public.save_ideal_self_profile(jsonb,uuid,uuid,text) from public;
grant execute on function public.save_ideal_self_profile(jsonb,uuid,uuid,text) to authenticated;

create or replace function public.delete_ideal_self_profile()
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,0));
  delete from public.ideal_self_comparisons where user_id=owner_id;
  delete from public.ideal_self_suggestions where user_id=owner_id;
  delete from public.ideal_self_profiles where user_id=owner_id;
  delete from public.ideal_self_profile_versions where user_id=owner_id;
end $$;
revoke all on function public.delete_ideal_self_profile() from public;
grant execute on function public.delete_ideal_self_profile() to authenticated;

-- Sources live in user_stores JSONB. Validate exact owned excerpts at the DB
-- boundary as well, and serialize against concurrent journal deletion.
create or replace function public.validate_ideal_self_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare source_store jsonb; ref jsonb; current_version uuid; confirmed_fields jsonb;
begin
  if auth.uid() is distinct from new.user_id then raise exception 'Ownership required' using errcode='42501'; end if;
  select store_data into source_store from public.user_stores where user_id=new.user_id for share;
  for ref in select value from jsonb_array_elements(new.evidence) loop
    if not exists(select 1 from jsonb_array_elements(coalesce(source_store->'history','[]'::jsonb)) e
      where e->>'id'=ref->>'entryId' and length(coalesce(ref->>'quote','')) > 0
      and position((ref->>'quote') in (e->>'text')) > 0) then raise exception 'Source evidence changed' using errcode='40001'; end if;
  end loop;
  if tg_table_name='ideal_self_comparisons' then
    select version,fields into current_version,confirmed_fields from public.ideal_self_profiles where user_id=new.user_id;
    if current_version is distinct from new.profile_version then raise exception 'Profile changed' using errcode='40001'; end if;
    if position(new.criterion_quote in coalesce(confirmed_fields->>new.criterion_key,'')) = 0 then raise exception 'Invalid criterion'; end if;
  end if;
  return new;
end $$;
revoke all on function public.validate_ideal_self_evidence() from public;
create trigger ideal_self_suggestion_evidence before insert or update on public.ideal_self_suggestions for each row execute function public.validate_ideal_self_evidence();
create trigger ideal_self_comparison_evidence before insert or update on public.ideal_self_comparisons for each row execute function public.validate_ideal_self_evidence();

create or replace function public.purge_ideal_self_deleted_sources()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='DELETE' then
    delete from public.ideal_self_profile_versions where user_id=old.user_id;
    delete from public.ideal_self_suggestions where user_id=old.user_id;
    return old;
  end if;
  delete from public.ideal_self_suggestions s where s.user_id=new.user_id and exists(
    select 1 from jsonb_array_elements(s.evidence) ref where not exists(
      select 1 from jsonb_array_elements(coalesce(new.store_data->'history','[]'::jsonb)) e where e->>'id'=ref->>'entryId'));
  delete from public.ideal_self_comparisons c where c.user_id=new.user_id and exists(
    select 1 from jsonb_array_elements(c.evidence) ref where not exists(
      select 1 from jsonb_array_elements(coalesce(new.store_data->'history','[]'::jsonb)) e where e->>'id'=ref->>'entryId'));
  return new;
end $$;
revoke all on function public.purge_ideal_self_deleted_sources() from public;
create trigger ideal_self_source_deletion after update or delete on public.user_stores for each row execute function public.purge_ideal_self_deleted_sources();

commit;
