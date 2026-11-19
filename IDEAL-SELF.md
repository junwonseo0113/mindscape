# Ideal Self integration and deployment dependency

## Current status

The dedicated profile editor, authenticated CRUD API, versioned storage migration,
reflection/suggestion validators, review UI, and source/version safeguards are implemented.
**Comparisons and AI suggestions intentionally remain disabled in production.**
This app's existing `Store.isPro`, Premium Mode toggle, and checkout are client-side
mocks, not a trusted entitlement authority. `MONETIZATION_ENABLED` is also false.
There is no billing webhook, subscription table, or verified entitlement lookup to reuse.
The new API never treats these client flags as authorization.

The local environment does not have configured Supabase credentials or a database.
No migration was applied and no live account-persistence or AI comparison was verified.
The UI explicitly describes unavailable saving and Premium operations. It does not
replace them with hardcoded results. Browser test fixtures are isolated test doubles.

## Architecture and minimal integration

- React 18/Vite; existing `App.tsx` screen switch and Profile settings entry.
- Existing `Instrument Serif`/Inter type and `nightTheme` colors; isolated feature CSS.
- Existing Supabase Auth: the browser sends its session bearer token. The server
  verifies it with `auth.getUser(token)` and uses the same token/anon client for RLS.
  Request-supplied user IDs, `isPro`, and client journal text do not select ownership.
- Existing `user_stores` JSONB remains the journal source. Only server-fetched owned
  entries and explicitly reviewed beliefs/hypotheses are supplied to the new AI path.
- Existing Anthropic helper/model; optional system-message support was added without
  changing the existing handlers' request behavior. API keys remain server-side.
- `/api/ideal-self` has production and Vite adapters, a 64 KiB request limit,
  generic private-data-safe errors, and `Cache-Control: no-store`.
- No new billing, background processing, push notifications, or sample user results.

## Configuration and local migration

Do not overwrite an existing `.env`. The app already uses:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY                 # server only, never VITE-prefixed
```

The server also accepts `SUPABASE_URL` / `SUPABASE_ANON_KEY` for the same project.
It does not require or use a service-role key.

Review `supabase/migrations/20261102_ideal_self.sql` and apply it through your normal
database migration process after the existing `supabase/schema.sql` is installed.
It is additive and transactional: four new tables, owner RLS, atomic profile-save
and deletion RPCs, and validation/deletion triggers on the existing journal store.
This task only creates the file locally; it must not be applied to a remote database
or deployed as part of this change.

The RPC saves a new immutable profile version using an expected-version check.
Concurrent edits return a conflict instead of silently overwriting. Profile rows
cannot be written directly by authenticated clients. A confirmed suggestion must
be accepted/edited explicitly and atomically with the new profile version.

## Exact Premium blocker

Before enabling Premium operations, connect **both** of these to the application's
real, server-verified subscription authority:

1. `premiumAvailability()` in `src/server/idealSelf/service.ts`.
2. `public.ideal_self_premium_access(user_id)` in a subsequent additive migration.

Both currently fail closed. There is intentionally no environment flag or mock
client boolean that bypasses this dependency. Do not replace these with unconditional
`allowed`/`true` responses. The existing subscription UI can be opened when a future
trusted authority returns `premium_required`; its mock checkout cannot unlock this API.

## Data distinctions and lifecycle

- `ideal_self_profiles`: current, user-confirmed criteria; separate from old
  `Store.aspiration` and ordinary journal entries. Existing aspiration behavior is unchanged.
- `ideal_self_profile_versions`: immutable profile versions.
- `ideal_self_suggestions`: AI-proposed fields, exact source excerpts, input hash,
  and pending/accepted/edited/rejected state. They are not criteria until confirmed.
- `ideal_self_comparisons`: criterion excerpt, tentative interpretation, relation,
  open-ended question, evidence, aspiration version, input hash, original wording,
  optional user-edited wording, and review state. No personality/alignment scores.

The input hash includes owned entries (IDs, dates, and text) and explicitly reviewed
interpretations. Any change conservatively makes old comparisons outdated; new profile
versions do too. Stale results cannot be reviewed as current. Existing edits/rejections
are retained, not overwritten by later generation. Evidence is revalidated after AI
returns and again at the database boundary. Missing/edited excerpts are not returned
as current evidence. Deleting source entries purges referencing suggestions/comparisons.
Deleting a cloud store, the Ideal Self profile, or an auth user cleans up dependent data.
The existing 'Delete all my data' path also calls the dedicated deletion RPC first.
An uninstalled additive migration does not block legacy reset; other deletion failures
are surfaced before any local data is cleared.

The AI system prompt separates untrusted content from instructions, avoids diagnosis,
judgment, numerical alignment, and claims about unconscious motives, and explicitly
distinguishes thoughts from actions/endorsement. Only validated, exact owned excerpts
may be saved. A recurring alignment/tension needs multiple entries; mixed evidence
needs support and complication. Insufficient evidence is allowed. The existing sensitive
content guard runs before the AI call. These checks reduce risk; they are not a clinical
assessment or proof that a model's interpretation is correct.

## Verification

```text
npm run test:ideal-self
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.node.json
npm run build
```

There is no pre-existing lint or test script in the package. The existing baseline
app typecheck/build passed before edits. Focused tests cover server ownership and
Premium denial, confirmation, review/edit/rejection, evidence validation, source and
profile staleness, privacy-safe failure handling, draft preservation, and SQL security
contracts. SQL contract tests are **not** live Postgres/RLS tests.

`tests/ideal-self-ui.mjs` checks the actual unconfigured UI and unauthenticated API,
then uses explicitly mocked account/API responses for editor behavior. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed browser if the package's default
Playwright browser is unavailable. UI fixtures never enable production Premium access.

## Manual walkthrough

1. Open Profile → Ideal Self. Existing navigation and all journal/map flows remain.
2. In this unconfigured installation, type into the flexible form. Saving and AI
   operations are visibly disabled; nothing is written to journal/localStorage.
3. On a properly configured staging database, sign in with Supabase, save at least
   one field, reload, edit, and save again. Verify another account cannot read it.
   Open two tabs to check an outdated version cannot overwrite a newer profile.
4. Verify deleting Ideal Self removes feature records but leaves journal entries.
   Verify 'Delete all my data' and auth-user deletion clean up feature data too.
5. Keep comparisons/suggestions disabled until real entitlement integration is ready.
   Then verify non-Premium requests fail at both API and RLS boundaries.
6. With authorized staging access, generate a suggestion, confirm/edit/reject it,
   request a comparison, follow evidence links to original entries, and review each
   interpretation. Change profile/source text and verify results become outdated.
   Delete a source and verify its saved excerpts are removed. Simulate network failure
   while saving/reviewing and verify the user's unsaved input stays intact.

No deployment, push, remote migration, or live AI call was performed.

## Changed files and final checks

| Files | Purpose |
| --- | --- |
| `src/app/idealSelf/model.ts`, `editor.ts` | Typed profile/suggestion/comparison states, source validation, user review rules, stale-result detection, resilient drafts. |
| `src/app/idealSelf/IdealSelfScreen.tsx`, `client.ts`, `ideal-self.css` | Dedicated account profile, flexible editor, source links, review controls, unavailable/loading/error/success states. |
| `src/server/idealSelf/service.ts`, `ai.ts` | Verified bearer identity, owner-bound queries, closed Premium boundary, existing AI provider integration and output checks. |
| `api/ideal-self.ts`, `vite.config.ts` | Matching production/local API adapters. |
| `supabase/migrations/20261102_ideal_self.sql` | Additive versioned tables, owner RLS, Premium-deny policies, confirmation/deletion RPCs, and source cleanup. |
| `src/app/App.tsx` | Profile entry point, original-entry return route, existing subscription-UI callback, all-data deletion integration. |
| `src/server/aiHandlers.ts` | Export the existing provider helper and allow an optional system message; existing calls retain their original behavior. |
| `package.json`, `vitest.ideal-self.config.ts`, feature `*.test.ts` files | Focused test command and 60 passing unit/integration-contract cases; no dependency changes. |
| `tests/ideal-self-ui.mjs` | Actual unconfigured-state and unauthenticated-API checks, plus explicitly mocked account/editor/review browser scenarios. |

Final results: 60 focused tests passed; both app/server TypeScript configurations
passed; production build passed; browser checks passed at mobile/desktop sizes;
the existing Home observatory flow checks passed. No lint command is configured.
The large-bundle build warning was present in the pre-change baseline too.

This supplied directory has no Git metadata. A SHA-256 baseline and final file audit
confirm that only the four intended existing files changed; earlier design files,
the package lock, and other existing source files were preserved. See
`artifacts/ideal-self-change-audit.json`. Screenshots in `artifacts/ideal-self/`
distinguish the actual unavailable state from the mocked-account UI fixture.
