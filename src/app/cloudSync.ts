// ── Cloud sync ────────────────────────────────────────────────────────────────
// One row per signed-up user, one JSONB blob per row — see
// supabase/schema.sql for the table + Row Level Security policies that
// actually enforce "you can only ever touch your own row" at the database
// level, not just in this app's own code. Every function here is a no-op
// (or throws, for the auth ones — callers already only invoke them after
// checking isCloudSyncConfigured) when Supabase isn't configured, so this
// file never has to be the thing that decides whether cloud sync is on;
// supabaseClient.ts already decided that.
import { supabase } from "./supabaseClient";
import type { Store } from "./types";

export async function pushStoreToCloud(userId: string, store: Store): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("user_stores")
    .upsert({ user_id: userId, store_data: store, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) {
    // Deliberately swallowed past this point — a failed sync (offline, a
    // transient Supabase error) must never block or corrupt the local
    // save that already happened via saveStore. The next successful
    // update after this one carries the same data forward, so nothing is
    // silently lost, just delayed.
    console.error("[cloudSync] push failed:", error.message);
  }
}

export async function pullStoreFromCloud(userId: string): Promise<Store | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_stores")
    .select("store_data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[cloudSync] pull failed:", error.message);
    return null;
  }
  return (data?.store_data as Store | undefined) ?? null;
}

// Thin wrappers over Supabase Auth — kept here rather than called directly
// from App.tsx so every call site that cares about cloud sync goes through
// this one file, and so the "not configured" error has one canonical
// message instead of being restated at each call site.
export async function cloudSignUp(email: string, password: string, name: string) {
  if (!supabase) throw new Error("Cloud sync is not configured.");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function cloudSignIn(email: string, password: string) {
  if (!supabase) throw new Error("Cloud sync is not configured.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function cloudSignOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
