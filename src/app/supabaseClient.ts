// ── Cloud sync client ─────────────────────────────────────────────────────────
// Optional by design: this app has to keep working exactly as it does today
// (fully local, guest-friendly, zero setup) for anyone who hasn't configured
// Supabase — most importantly, for this codebase's own dev/test environment,
// which has no real Supabase project behind it. Every call site checks
// `supabase` for null before using it (see cloudSync.ts and the auth screens
// in App.tsx) rather than assuming it's configured.
//
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY come from .env (see
// .env.example) — the anon key is safe to ship to the client by design
// (Supabase's actual access control is Postgres Row Level Security, see
// supabase/schema.sql, not secrecy of this key).
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export const isCloudSyncConfigured = supabase !== null;
