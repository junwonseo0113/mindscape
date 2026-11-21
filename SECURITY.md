# Security review (2026-11-20)

What was checked, what was fixed, and the settings to turn on outside the code.

## SQL injection: no injectable queries found

- The app and the server never build SQL from text. Every database call goes
  through Supabase's query builder or an RPC with named parameters
  (`.from().eq()`, `.rpc("save_user_store", {...})`), which PostgREST sends as
  parameters, not string-joined SQL.
- None of the SQL functions (`delete_own_account`, `save_user_store`,
  `save_ideal_self_profile`, the triggers) use dynamic SQL (`EXECUTE`/`format`).
  All pin `search_path = ''` and act only on `auth.uid()`.
- Row Level Security is on for every table. The server reaches the database as
  the signed-in user (their JWT plus the anon key), never as the service role,
  so a bug in server code still can't reach another user's rows.
- The one helper that took a table name as a variable (`records()` in the
  Ideal Self server code) was removed with that feature on 2026-11-20. Its
  database tables and `save_ideal_self_profile` still exist in Supabase from
  `supabase/migrations/20261102_ideal_self.sql`; nothing in the app calls them.
- No HTML injection points: no `dangerouslySetInnerHTML`, `innerHTML`, or
  `eval`. Links only come from constants.

## Brute-force protection

- **Login** (`src/app/loginThrottle.ts`): after 5 wrong passwords in a row,
  each attempt waits 30 s, then 1 min, 2 min, and so on, up to 15 min. The
  count survives closing the app, and a correct login resets it. This covers
  device-only accounts and adds friction in front of Supabase's own limits.
- **Password reset**: at most one reset email a minute from the login screen.
- **AI API** (`api/_lib.ts`): 30 requests per IP per 10 minutes, and bodies
  over 64 KB are refused.
- **Turn on in Supabase** (Dashboard → Authentication):
  - Rate Limits: keep the sign-in, sign-up and email limits on.
  - Attack Protection: enable CAPTCHA (Turnstile or hCaptcha).
  - Enable "Leaked password protection", which blocks passwords found in
    breaches.
- **Turn on in Vercel** (Project → Firewall): add a rate-limit rule for
  `/api/*`. The in-code limit lives in one server instance's memory, so it's
  a speed bump, not a hard quota.

## Password hashing

- **Cloud accounts:** Supabase Auth hashes with bcrypt on its server. The app
  never stores or uploads these passwords.
- **Device-only accounts** (`src/app/localPassword.ts`): PBKDF2-HMAC-SHA256
  with a random 16-byte salt and constant-time comparison.
  - Raised from 210,000 to **600,000 iterations** (OWASP's figure for SHA-256;
    210,000 is its figure for SHA-512).
  - Older hashes and legacy plaintext values are re-hashed the next time the
    correct password is entered.
  - A stored hash claiming an absurd iteration count is rejected instead of
    run.
- The password hash is no longer uploaded with the cloud copy, and the
  `20261120_store_revisions.sql` migration clears hashes already uploaded.
- Sign-up requires at least 8 characters.

## Dependencies (`npm audit`)

- Before: 9 vulnerabilities (2 high, 7 moderate). After: **0**.
- `npm audit fix` updated `nanoid` and `source-map-js`. Both were high,
  reached through PostCSS and Tailwind.
- `overrides` in `package.json` pin `glob` ≥ 14.0.6 and `minimatch` ≥ 11.0.9.
  The older versions came in through Storybook's docgen plugin and the shadcn
  CLI (`ts-morph`). Both tools still work: the app build, Storybook build and
  type check all pass.
- Re-run `npm audit` before each release.
