import { DiaryHeading } from "./diaryPaper";
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { StoredAccount } from "./types";
import { isCloudSyncConfigured } from "./supabaseClient";
import { Breathe } from "./motionPrimitives";
import { display, hand, sans } from "./typefaces";
import { BookOpen, Check, EnvelopeSimple, EyeSlash, Key, PenNib, UserCircle, Eye } from "@phosphor-icons/react";
import { cloudResetPassword, cloudSignIn, cloudSignUp } from "./cloudSync";
import { hashLocalPassword, verifyLocalPassword, needsRehash } from "./localPassword";
import { lockRemaining, recordFailure, recordSuccess, waitMessage } from "./loginThrottle";
import { OPENING_BG, OPENING_TEXT, OPENING_MUTED, OpeningBackdrop, PatternConstellation } from "./OpeningScreens";
import { PrimaryBtn, GhostBtn, BackButton } from "./screenUI";
import { mdCard, mdHeading, mdBody, mdDivider, mdWarn, ivHeading, ivBody, ivFaint } from "./screenTheme";

// ── Screen 2 · Auth ───────────────────────────────────────────────────────────
export function ScreenAuth({ onEmailStart, onGuest }: { onEmailStart?: () => void; onGuest?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: OPENING_BG, position: "relative", overflow: "hidden" }}>
      <OpeningBackdrop variant="auth" />
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 28px" }}>
        <div style={{ marginBottom: 28 }}><PatternConstellation /></div>
        <DiaryHeading align="center" size={28} kicker="Mindscape" region="identity"
          title={"Not just a diary.\nA way to see how you think."} />
      </div>
      <div style={{ position: "relative", zIndex: 1, padding: "0 28px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        <PrimaryBtn ivory onClick={onEmailStart} icon={<EnvelopeSimple size={19} weight="fill" />}>Continue with email</PrimaryBtn>
        <GhostBtn ivory onClick={onGuest} icon={<BookOpen size={18} />}>Browse as a guest</GhostBtn>
        {/* Guest mode has no account behind it, so clearing this device's
        storage loses everything with nothing to recover from — this used
        to go unmentioned anywhere near the decision itself. Data &
        Privacy's own "Download my data" is the one way to get ahead of
        that, so it's worth naming right here rather than only discoverable
        after the fact in Settings. */}
        <div style={{ ...sans, fontSize: 12, color: "rgba(42,38,33,.42)", textAlign: "center", marginTop: 2, lineHeight: 1.5, wordBreak: "keep-all" }}>
          Browsing as a guest keeps everything only on this device — nothing to restore if it's ever cleared. You can export a copy anytime from Settings.
        </div>
      </div>
    </div>
  );
}

// ── DiaryPage ────────────────────────────────────────────────────────────────
// Login and sign-up as the first page of a diary: a sheet of paper resting
// on the drifting backdrop, today's date written at the top the way you'd
// head a page, a faint rose margin line down the left, and a ribbon
// bookmark hanging from the top edge that sways a little. The sheet rises
// into place when the screen opens.
function DiaryPage({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const dateline = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24, rotate: -1.2 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 20, delay: 0.05 }}
      style={{
        position: "relative", borderRadius: 18, padding: "26px 22px 22px 34px", marginTop: 8,
        backgroundColor: "#FDFBF6", backgroundImage: "linear-gradient(180deg, #FFFDF9 0%, #FBF7EF 100%)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.8) inset, 0 18px 40px -22px rgba(74,47,94,0.45), 0 0 0 1px rgba(42,38,33,0.06)",
      }}
    >
      {/* Margin line */}
      <span aria-hidden style={{ position: "absolute", left: 20, top: 14, bottom: 14, width: 1.5, borderRadius: 1, backgroundColor: `${REGION_CONFIG.relationships.color}66` }} />
      {/* Ribbon bookmark */}
      <motion.span aria-hidden
        animate={reduce ? undefined : { rotate: [0, 3, -2, 0] }} transition={reduce ? undefined : { duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", right: 26, top: -6, width: 16, height: 46, transformOrigin: "50% 0%",
          backgroundImage: `linear-gradient(180deg, ${REGION_CONFIG.identity.ink}, ${REGION_CONFIG.identity.color})`,
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)", boxShadow: "0 4px 8px rgba(0,0,0,0.15)" }} />
      <div style={{ ...hand, fontSize: 21, fontWeight: 500, color: REGION_CONFIG.identity.ink }}>{dateline}</div>
      <div style={{ ...display, fontSize: 28, color: ivHeading, lineHeight: 1.2, marginTop: 6 }}>{title}</div>
      {subtitle && <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}>{subtitle}</div>}
      <div style={{ marginTop: 18 }}>{children}</div>
    </motion.div>
  );
}

// ── DiaryField ───────────────────────────────────────────────────────────────
// The sign-in and sign-up fields, as lines on a diary page instead of
// boxes: a small icon, the label sitting on the line until you start
// (then lifting up out of the way), and an ink line that draws in from
// the left in the app's colors while the field has focus. A quiet check
// pops in once an email or password is valid; the password has a
// show/hide eye; an error shakes the line once and turns it warm.
function DiaryField({ label, type = "text", value, onChange, icon, error, valid, autoComplete }: { label: string; type?: string; value: string; onChange: (v: string) => void; icon: React.ReactNode; error?: boolean; valid?: boolean; autoComplete?: string }) {
  const id = React.useId();
  const reduce = useReducedMotion();
  const [focused, setFocused] = React.useState(false);
  const [reveal, setReveal] = React.useState(false);
  const lifted = focused || value.length > 0;
  const isPassword = type === "password";
  const ink = error ? mdWarn : ivHeading;
  return (
    <motion.div
      animate={error && !reduce ? { x: [0, -7, 6, -4, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
      style={{ position: "relative", paddingTop: 18, marginBottom: 18 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <motion.span
          animate={{ color: focused ? (error ? mdWarn : REGION_CONFIG.identity.ink) : ivFaint, scale: focused ? 1.08 : 1 }}
          transition={{ duration: 0.2 }}
          style={{ display: "flex", flexShrink: 0 }}
        >
          {icon}
        </motion.span>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <motion.label
            htmlFor={id}
            animate={lifted ? { y: -24, scale: 0.78, color: focused ? (error ? mdWarn : REGION_CONFIG.identity.ink) : ivBody } : { y: 0, scale: 1, color: ivFaint }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            style={{ position: "absolute", left: 0, top: 10, transformOrigin: "0% 50%", pointerEvents: "none", ...sans, fontSize: 17, fontWeight: lifted ? 600 : 400, whiteSpace: "nowrap" }}
          >
            {label}
          </motion.label>
          <input
            id={id} type={isPassword && reveal ? "text" : type} value={value} autoComplete={autoComplete}
            onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            aria-invalid={error || undefined}
            // 17px keeps iOS from zooming the page on focus.
            style={{ width: "100%", border: 0, outline: "none", background: "transparent", padding: "10px 0 9px", ...display, fontSize: 20, color: ink, caretColor: REGION_CONFIG.identity.color }}
          />
        </div>
        <AnimatePresence>
          {valid && !error && (
            <motion.span key="ok" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}
              style={{ display: "flex", width: 20, height: 20, borderRadius: "50%", alignItems: "center", justifyContent: "center", backgroundColor: REGION_CONFIG.security.tint, color: REGION_CONFIG.security.ink, flexShrink: 0 }}>
              <Check size={12} weight="bold" />
            </motion.span>
          )}
        </AnimatePresence>
        {isPassword && (
          <motion.button type="button" aria-label={reveal ? "Hide password" : "Show password"} onClick={() => setReveal((v) => !v)} whileTap={{ scale: 0.85 }}
            style={{ border: 0, background: "transparent", padding: 6, margin: -6, color: ivFaint, cursor: "pointer", lineHeight: 0, flexShrink: 0 }}>
            {reveal ? <EyeSlash size={18} /> : <Eye size={18} />}
          </motion.button>
        )}
      </div>
      {/* The writing line, and the ink that draws over it on focus. */}
      <div style={{ position: "relative", height: 2, marginTop: 2, borderRadius: 1, backgroundColor: error ? `${mdWarn}55` : "rgba(42,38,33,0.16)" }}>
        <motion.div
          initial={false}
          animate={{ scaleX: focused || error ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute", inset: 0, transformOrigin: "0% 50%", borderRadius: 1,
            backgroundImage: error ? `linear-gradient(90deg, ${mdWarn}, ${REGION_CONFIG.creativity.color})` : `linear-gradient(90deg, ${REGION_CONFIG.identity.color}, ${REGION_CONFIG.relationships.color}, ${REGION_CONFIG.career.color})`,
          }}
        />
      </div>
    </motion.div>
  );
}

function TextField({ label, type = "text", value, onChange, placeholder, error, dark = false }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: boolean; dark?: boolean }) {
  // The caption above every input in the app (login, signup, aspiration,
  // checkout's card fields) was a plain styled div, never actually
  // associated with its input — a screen reader announced every one of
  // these as an unlabeled text box. A real <label htmlFor> fixes all call
  // sites from this one component; useId keeps it unique and stable
  // without callers having to pass their own id.
  const id = React.useId();
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={{ display: "block", ...sans, fontSize: 12, fontWeight: 600, color: dark ? OPENING_MUTED : mdBody, marginBottom: 6 }}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error || undefined}
        style={{
          ...sans, width: "100%", padding: "13px 14px", borderRadius: 12, boxSizing: "border-box",
          border: `1px solid ${error ? mdWarn : (dark ? "rgba(42,38,33,.18)" : mdDivider)}`,
          // 16px, not 15 — iOS Safari auto-zooms the whole page on focus for
          // any input under 16px, which then has to be manually pinched back
          // out. Below that threshold it's a real mobile bug, not a style nit.
          fontSize: 17, color: dark ? OPENING_TEXT : mdHeading,
          backgroundColor: dark ? "rgba(255,255,255,.055)" : mdCard, outline: "none",
          colorScheme: dark ? "dark" : "light",
        }}
      />
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Real Supabase auth when cloud sync is configured (see supabaseClient.ts);
// otherwise the original local-only mock — checking against the single
// account stored on this device (see StoredAccount) — so the app still
// works exactly as before wherever Supabase env vars aren't set.
export function ScreenLogin({ account, onBack, onGoSignup, onLogin }: { account: StoredAccount | null; onBack?: () => void; onGoSignup?: () => void; onLogin?: (upgradedPasswordHash?: string) => void }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resetInfo, setResetInfo] = React.useState("");
  // "Forgot password?" (accounts in the cloud only): emails a reset link.
  // One reset email a minute, so the button can't be used to flood an inbox.
  const lastResetRef = React.useRef(0);
  const forgot = async () => {
    setError(""); setResetInfo("");
    if (!EMAIL_RE.test(email.trim())) { setError("Type your email above first, then tap \"Forgot password?\" again."); return; }
    const since = Date.now() - lastResetRef.current;
    if (since < 60_000) { setError(`A reset email was just sent. You can ask again in ${Math.ceil((60_000 - since) / 1000)} seconds.`); return; }
    lastResetRef.current = Date.now();
    try {
      await cloudResetPassword(email.trim());
      setResetInfo(`We sent a link to ${email.trim()} to set a new password.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the reset email.");
    }
  };

  const submit = async () => {
    if (loading) return;
    setError(""); setResetInfo("");
    if (!email.trim() || !password) { setError("Please enter both an email and a password."); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("That doesn't look like a valid email."); return; }
    // Slow down password guessing (loginThrottle.ts).
    const wait = lockRemaining();
    if (wait > 0) { setError(waitMessage(wait)); return; }
    const wrongPassword = (message: string) => {
      const locked = recordFailure();
      setError(locked > 0 ? waitMessage(locked) : message);
    };
    setLoading(true);

    if (isCloudSyncConfigured) {
      try {
        await cloudSignIn(email.trim(), password);
        recordSuccess();
        setLoading(false);
        onLogin?.();
      } catch (err) {
        setLoading(false);
        const msg = err instanceof Error ? err.message : "Couldn't log in.";
        if (/incorrect/i.test(msg)) wrongPassword(msg); else setError(msg);
      }
      return;
    }

    // Local-only account (no Supabase): compare against the PBKDF2 hash —
    // see localPassword.ts. A store saved before hashing existed still has
    // plaintext here; that still logs in once, and is re-hashed on the spot.
    if (!account || typeof account.email !== "string" || typeof account.password !== "string") {
      setLoading(false);
      setError("No account found. Please sign up first.");
      return;
    }
    const ok = account.email.toLowerCase() === email.trim().toLowerCase() && (await verifyLocalPassword(password, account.password));
    setLoading(false);
    if (!ok) {
      wrongPassword("Email or password is incorrect.");
      return;
    }
    recordSuccess();
    // Plaintext legacy values and hashes made with fewer iterations are
    // replaced with a fresh, current-strength hash.
    onLogin?.(needsRehash(account.password) ? await hashLocalPassword(password) : undefined);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: OPENING_BG, position: "relative", overflow: "hidden" }}>
      <OpeningBackdrop variant="form" />
      <div style={{ padding: "16px 22px 0", position: "relative", zIndex: 1, flexShrink: 0 }}>
        <BackButton onClick={onBack} color={OPENING_MUTED} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative", zIndex: 1, padding: "20px 28px 24px" }}>
        <DiaryPage title="Welcome back" subtitle="Pick up where you left off.">
          {/* An error marks only the field it's about; wrong credentials mark both. */}
          <DiaryField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} icon={<EnvelopeSimple size={20} />} error={!!error && (!email.trim() || !/both/.test(error))} valid={EMAIL_RE.test(email.trim())} />
          <DiaryField label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} icon={<Key size={20} />} error={!!error && (!/both|valid email/.test(error) || !password)} />
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ ...sans, fontSize: 13, color: mdWarn, marginTop: -4, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all", overflow: "hidden" }}>{error}</motion.div>
            )}
            {resetInfo && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ ...sans, fontSize: 13, color: REGION_CONFIG.security.ink, marginTop: -4, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all", overflow: "hidden" }}>{resetInfo}</motion.div>
            )}
          </AnimatePresence>
          {isCloudSyncConfigured && (
            <div style={{ textAlign: "right", marginTop: -6, marginBottom: 14 }}>
              <motion.span role="button" tabIndex={0} onClick={forgot} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); forgot(); } }}
                whileTap={{ opacity: 0.6 }} style={{ ...hand, fontSize: 18, fontWeight: 600, color: REGION_CONFIG.identity.ink, cursor: "pointer" }}>
                Forgot password?
              </motion.span>
            </div>
          )}
          <PrimaryBtn ivory onClick={submit} loading={loading} icon={<PenNib size={18} weight="fill" />}>Log in</PrimaryBtn>
        </DiaryPage>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span style={{ ...sans, fontSize: 13, color: OPENING_MUTED }}>Don't have an account? </span>
          <Breathe inline amount={1.06}><motion.span role="button" tabIndex={0} onClick={onGoSignup} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onGoSignup)?.(); } }} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: ivHeading, fontWeight: 600, cursor: "pointer" }}>Sign up</motion.span></Breathe>
        </div>
      </div>
    </div>
  );
}

export function ScreenSignup({ onBack, onGoLogin, onSignup }: { onBack?: () => void; onGoLogin?: () => void; onSignup?: (account: StoredAccount) => void }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  // Distinct from `error` — Supabase projects that require email
  // confirmation return a user with no active session yet, which isn't a
  // failure, just a "one more step" state that needs its own tone (not
  // red/warning-colored) and shouldn't advance past this screen.
  const [info, setInfo] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
    if (loading) return;
    setError("");
    setInfo("");
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("That doesn't look like a valid email."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);

    if (isCloudSyncConfigured) {
      try {
        const data = await cloudSignUp(email.trim(), password, name.trim());
        setLoading(false);
        if (!data.session) {
          setInfo("Check your email for a confirmation link, then log in.");
          return;
        }
        // Real auth already has the password, hashed, in Supabase's own
        // auth.users table — never duplicated here in plaintext, since
        // this object is what gets synced to user_stores as part of the
        // Store (see cloudSync.ts / supabase/schema.sql).
        onSignup?.({ name: name.trim(), email: email.trim(), password: "" });
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Couldn't create an account.");
      }
      return;
    }

    // Local-only account: never keep the plaintext password — see localPassword.ts.
    const passwordHash = await hashLocalPassword(password);
    setLoading(false);
    onSignup?.({ name: name.trim(), email: email.trim(), password: passwordHash });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: OPENING_BG, position: "relative", overflow: "hidden" }}>
      <OpeningBackdrop variant="form" />
      <div style={{ padding: "16px 22px 0", position: "relative", zIndex: 1, flexShrink: 0 }}>
        <BackButton onClick={onBack} color={OPENING_MUTED} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", position: "relative", zIndex: 1, padding: "20px 28px 24px" }}>
        <DiaryPage
          title="Start your diary"
          subtitle={isCloudSyncConfigured
            ? "Synced privately to your account, so it's there on any device you log into — never sold, never shared."
            : "It only lives on this device. Nothing is sent to any server."}
        >
          {/* An error marks only the field it's about. */}
          <DiaryField label="What should we call you?" autoComplete="name" value={name} onChange={setName} icon={<UserCircle size={20} />} error={/your name/.test(error)} valid={name.trim().length > 0} />
          <DiaryField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} icon={<EnvelopeSimple size={20} />} error={!!error && !/your name|Password must/.test(error)} valid={EMAIL_RE.test(email.trim())} />
          <DiaryField label="Password (8+ characters)" type="password" autoComplete="new-password" value={password} onChange={setPassword} icon={<Key size={20} />} error={/Password must/.test(error)} valid={password.length >= 8} />
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ ...sans, fontSize: 13, color: mdWarn, marginTop: -4, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all", overflow: "hidden" }}>{error}</motion.div>
            )}
          </AnimatePresence>
          {info && <div style={{ ...sans, fontSize: 13, color: ivHeading, marginTop: -4, marginBottom: 14, lineHeight: 1.5, wordBreak: "keep-all" }}>{info}</div>}
          <PrimaryBtn ivory onClick={submit} loading={loading} icon={<PenNib size={18} weight="fill" />}>Sign up</PrimaryBtn>
        </DiaryPage>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span style={{ ...sans, fontSize: 13, color: OPENING_MUTED }}>Already have an account? </span>
          <Breathe inline amount={1.06}><motion.span role="button" tabIndex={0} onClick={onGoLogin} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onGoLogin)?.(); } }} whileTap={{ opacity: 0.6 }} style={{ ...sans, fontSize: 13, color: ivHeading, fontWeight: 600, cursor: "pointer" }}>Log in</motion.span></Breathe>
        </div>
      </div>
    </div>
  );
}
