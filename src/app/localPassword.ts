// ── Local-only account passwords ──────────────────────────────────────────────
// Only used when Supabase isn't configured: the "account" then lives in this
// browser's storage, and its password is just a local gate. It still must
// never be stored in plaintext — people reuse passwords, and localStorage is
// readable by anyone with the unlocked device or a browser extension. Stored
// form is "pbkdf2$<iterations>$<salt b64>$<hash b64>". Cloud accounts never
// come through here; Supabase Auth hashes those server-side.
const PREFIX = "pbkdf2";
// OWASP's current guidance for PBKDF2-HMAC-SHA256 is 600,000 iterations
// (210,000 is its figure for SHA-512). Hashes made with fewer are upgraded
// the next time that password is entered correctly (needsRehash).
export const ITERATIONS = 600_000;
// A stored hash claiming more than this is treated as tampered with rather
// than run, so an edited value can't freeze the app for minutes.
const MAX_ITERATIONS = 5_000_000;

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashLocalPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export function isHashedPassword(stored: string): boolean {
  return stored.startsWith(`${PREFIX}$`);
}

// True for plaintext legacy values and for hashes with fewer iterations
// than ITERATIONS: after a successful login, store a fresh hash.
export function needsRehash(stored: string): boolean {
  if (!isHashedPassword(stored)) return true;
  const iter = Number(stored.split("$")[1]);
  return !Number.isFinite(iter) || iter < ITERATIONS;
}

// Accepts legacy plaintext values too (stores saved before this existed), so
// nobody is locked out — the caller re-hashes on a successful legacy login.
export async function verifyLocalPassword(password: string, stored: string): Promise<boolean> {
  if (!isHashedPassword(stored)) return stored !== "" && stored === password;
  const [, iter, saltB64, hashB64] = stored.split("$");
  const iterations = Number(iter);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS || !saltB64 || !hashB64) return false;
  let expected: Uint8Array, salt: Uint8Array;
  try { expected = fromB64(hashB64); salt = fromB64(saltB64); } catch { return false; }
  const actual = await derive(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
