// ── Cloud sync ────────────────────────────────────────────────────────────────
// One row per signed-up user holding their Store as one JSONB blob (see
// supabase/schema.sql and the store_revisions migration). Row Level
// Security makes sure nobody can touch anyone else's row.
//
// How saving works now:
//   · Changes are batched: the latest store is uploaded ~1.5 s after the
//     last change, never once per keystroke.
//   · One upload at a time, so an older copy can't land after a newer one.
//   · Each save says which revision it was based on (save_user_store). If
//     another device saved in between, the server refuses; we fetch theirs,
//     merge (storeMerge.ts) and save the merged copy, so nothing is lost.
//   · A failed upload is retried with back-off, and again when the device
//     comes back online or the app is reopened.
//   · The password hash of a local account never leaves the device.
// Projects that haven't run the revisions migration yet fall back to the
// old plain upsert, so nothing breaks before it's applied.
import { supabase } from "./supabaseClient";
import { mergeStores } from "./storeMerge";
import { sanitizeStore } from "./realStore";
import type { Store } from "./types";

// What's uploaded: the store minus anything that must stay on the device.
export function stripForCloud(store: Store): Store {
  return store.account ? { ...store, account: { ...store.account, password: "" } } : store;
}

export async function pullStoreFromCloud(userId: string): Promise<{ store: Store; revision: number } | null> {
  if (!supabase) return null;
  let res = await supabase.from("user_stores").select("store_data, revision").eq("user_id", userId).maybeSingle();
  // Before the revisions migration there's no `revision` column.
  if (res.error && /revision/.test(res.error.message)) {
    res = await supabase.from("user_stores").select("store_data").eq("user_id", userId).maybeSingle() as typeof res;
  }
  if (res.error) {
    console.error("[cloudSync] pull failed:", res.error.message);
    return null;
  }
  if (!res.data?.store_data) return null;
  return { store: sanitizeStore(res.data.store_data), revision: Number((res.data as any).revision ?? 0) };
}

type SaveResult = { ok: true; revision: number } | { ok: false; conflict: boolean; message: string };

async function saveOnce(userId: string, store: Store, baseRevision: number): Promise<SaveResult> {
  if (!supabase) return { ok: false, conflict: false, message: "not configured" };
  const payload = stripForCloud(store);
  const { data, error } = await supabase.rpc("save_user_store", { p_store: payload, p_base_revision: baseRevision });
  if (!error) return { ok: true, revision: Number(data) };
  if (/revision_conflict/.test(error.message)) return { ok: false, conflict: true, message: error.message };
  // The migration hasn't been run: plain upsert, as before.
  if (error.code === "PGRST202" || /save_user_store/.test(error.message)) {
    const up = await supabase.from("user_stores").upsert({ user_id: userId, store_data: payload, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    return up.error ? { ok: false, conflict: false, message: up.error.message } : { ok: true, revision: baseRevision };
  }
  return { ok: false, conflict: false, message: error.message };
}

// The syncer for whoever is signed in now, so signing out can finish the
// last upload first (flushCloudSync).
let active: CloudSyncer | null = null;
export async function flushCloudSync(): Promise<void> {
  await active?.flush();
}

// One per signed-in user. `queue(store)` whenever the store changes;
// `onMerged` hands a merged store back to the app after a conflict.
export class CloudSyncer {
  private pending: Store | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private failures = 0;
  private stopped = false;
  private readonly flushNow = () => this.flush();
  private readonly onVisibility = () => { if (document.visibilityState === "hidden") this.flush(); };

  constructor(private userId: string, private revision: number, private onMerged: (store: Store) => void) {
    window.addEventListener("online", this.flushNow);
    document.addEventListener("visibilitychange", this.onVisibility);
    active = this;
  }

  queue(store: Store, delay = 1500) {
    if (this.stopped) return;
    this.pending = store;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), delay);
  }

  async flush(): Promise<void> {
    if (this.stopped || this.running || !this.pending) return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.running = true;
    const store = this.pending;
    this.pending = null;
    try {
      let result = await saveOnce(this.userId, store, this.revision);
      if (!result.ok && result.conflict) {
        // Another device saved first: merge theirs into ours and try once more.
        const theirs = await pullStoreFromCloud(this.userId);
        if (theirs) {
          const merged = mergeStores(store, theirs.store);
          this.revision = theirs.revision;
          this.onMerged(merged);
          result = await saveOnce(this.userId, merged, this.revision);
        }
      }
      if (result.ok) {
        this.revision = result.revision;
        this.failures = 0;
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      console.error("[cloudSync] save failed:", err instanceof Error ? err.message : err);
      // Keep the newest copy and try again later: 3 s, 6 s, 12 s ... up to a minute.
      if (!this.pending) this.pending = store;
      this.failures += 1;
      const wait = Math.min(60_000, 3000 * 2 ** (this.failures - 1));
      this.timer = setTimeout(() => this.flush(), wait);
    } finally {
      this.running = false;
      if (this.pending && !this.timer) this.queue(this.pending, 300);
    }
  }

  stop() {
    if (active === this) active = null;
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    window.removeEventListener("online", this.flushNow);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }
}

// ── Auth ──
// Supabase's own messages ("Invalid login credentials", "Email not
// confirmed") turned into plain, actionable sentences.
export function friendlyAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/invalid login credentials/i.test(msg)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first. Check your inbox for the link, then log in.";
  if (/already registered|already exists/i.test(msg)) return "There's already an account with this email. Try logging in instead.";
  if (/password should be at least|weak password/i.test(msg)) return "Please choose a longer password (at least 8 characters).";
  if (/rate limit|too many/i.test(msg)) return "Too many attempts. Please wait a minute and try again.";
  if (/failed to fetch|network/i.test(msg)) return "Couldn't reach the server. Check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
}

export async function cloudSignUp(email: string, password: string, name: string) {
  if (!supabase) throw new Error("Cloud sync is not configured.");
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  if (error) throw new Error(friendlyAuthError(error));
  return data;
}

export async function cloudSignIn(email: string, password: string) {
  if (!supabase) throw new Error("Cloud sync is not configured.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyAuthError(error));
  return data;
}

// Sends the "reset your password" email.
export async function cloudResetPassword(email: string): Promise<void> {
  if (!supabase) throw new Error("Cloud sync is not configured.");
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new Error(friendlyAuthError(error));
}

export async function cloudSignOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// Permanently deletes the signed-in user's auth account (email, name,
// password hash) and their user_stores row — see delete_own_account in
// supabase/schema.sql. Signs out afterward so the now-orphaned session
// token doesn't linger in local storage. Throws on failure so the caller
// can tell the user instead of pretending the account is gone.
export async function cloudDeleteAccount(): Promise<void> {
  if (!supabase) throw new Error("Cloud sync is not configured.");
  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw new Error(friendlyAuthError(error));
  await supabase.auth.signOut();
}
