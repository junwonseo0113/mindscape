// ── Local-only account passwords ──────────────────────────────────────────────
// Only used when Supabase isn't configured: the "account" then lives in this
// browser's storage, and its password is just a local gate. It still must
// never be stored in plaintext — people reuse passwords, and localStorage is
// readable by anyone with the unlocked device or a browser extension. Stored
// form is "pbkdf2$<iterations>$<salt b64>$<hash b64>". Cloud accounts never
// come through here; Supabase Auth hashes those server-side.
const PREFIX = "pbkdf2";
const ITERATIONS = 210_000; // OWASP 2023 guidance for PBKDF2-HMAC-SHA256

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

// Accepts legacy plaintext values too (stores saved before this existed), so
// nobody is locked out — the caller re-hashes on a successful legacy login.
export async function verifyLocalPassword(password: string, stored: string): Promise<boolean> {
  if (!isHashedPassword(stored)) return stored !== "" && stored === password;
  const [, iter, saltB64, hashB64] = stored.split("$");
  const expected = fromB64(hashB64);
  const actual = await derive(password, fromB64(saltB64), Number(iter));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
