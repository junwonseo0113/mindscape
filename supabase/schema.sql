-- Mindscape — cloud sync schema
--
-- Run this once, in your Supabase project's SQL Editor (Dashboard → SQL
-- Editor → New query → paste this whole file → Run). See README setup
-- notes for the rest of what's needed (env vars).
--
-- One row per signed-up user, holding their entire app Store as a single
-- JSONB blob — matches how the app already treats Store as one object
-- everywhere (see src/app/types.ts), so this doesn't require normalizing
-- beliefs/history/hypotheses into separate tables for a first cloud-sync
-- pass. That can happen later without touching this file's RLS model.
--
-- Encryption at rest is handled automatically by Supabase's managed
-- Postgres — nothing to configure here for that. Row Level Security below
-- is what actually prevents one user from ever reading or writing another
-- user's row: it's enforced by Postgres itself on every query, using the
-- requester's own auth JWT (auth.uid()), not by anything this app's code
-- promises to check.

create table if not exists public.user_stores (
  user_id uuid references auth.users(id) on delete cascade primary key,
  store_data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_stores enable row level security;

create policy "Users can read their own store"
  on public.user_stores for select
  using (auth.uid() = user_id);

create policy "Users can insert their own store"
  on public.user_stores for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own store"
  on public.user_stores for update
  using (auth.uid() = user_id);

create policy "Users can delete their own store"
  on public.user_stores for delete
  using (auth.uid() = user_id);
