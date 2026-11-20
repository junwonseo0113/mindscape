// ── Slowing down password guessing ───────────────────────────────────────────
// After a few wrong passwords in a row, each further attempt has to wait,
// and the wait doubles: 5 free tries, then 30 s, 1 min, 2 min ... up to
// 15 min. The count survives closing the app (localStorage), and a correct
// login clears it. Supabase Auth also rate-limits on its server; this is
// the same idea on the device, and the only guard for device-only accounts.
const KEY = "mijeong.loginThrottle";
export const FREE_ATTEMPTS = 5;
const BASE_MS = 30_000;
const MAX_MS = 15 * 60_000;

type State = { fails: number; lockedUntil: number };

function read(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (s && typeof s.fails === "number" && typeof s.lockedUntil === "number") return s;
  } catch { /* unreadable: start over */ }
  return { fails: 0, lockedUntil: 0 };
}
function write(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

// Milliseconds until the next attempt is allowed (0 = go ahead).
export function lockRemaining(now = Date.now()): number {
  return Math.max(0, read().lockedUntil - now);
}

export function recordFailure(now = Date.now()): number {
  const s = read();
  s.fails += 1;
  if (s.fails >= FREE_ATTEMPTS) {
    const wait = Math.min(MAX_MS, BASE_MS * 2 ** (s.fails - FREE_ATTEMPTS));
    s.lockedUntil = now + wait;
  }
  write(s);
  return Math.max(0, s.lockedUntil - now);
}

export function recordSuccess() {
  write({ fails: 0, lockedUntil: 0 });
}

export function waitMessage(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const when = s >= 60 ? `${Math.ceil(s / 60)} minute${Math.ceil(s / 60) === 1 ? "" : "s"}` : `${s} seconds`;
  return `Too many wrong attempts. Please wait ${when} and try again.`;
}
