import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { Store, StoredSettings } from "./types";
import { formatDateDots } from "./dateUtils";
import { diaryAsMarkdown, saveTextFile } from "./diaryExport";
import { isNative } from "./native";
import { isCloudSyncConfigured } from "./supabaseClient";
import { AnimatedNumber, Breathe, Collapse } from "./motionPrimitives";
import { display, mono, sans } from "./typefaces";
import { ArrowCounterClockwise, BellSimple, CalendarBlank, Clock, DownloadSimple, FileText, Flask, Lightbulb, LockSimple, Question, ShareNetwork, Sparkle } from "@phosphor-icons/react";
import { cloudSignOut, flushCloudSync } from "./cloudSync";
import { computeStreak } from "./entryTiming";
import { mdBg, mdHeading, mdBody, mdFaint, mdWarn, mdWarnSoft, mdWarnLabel, ivBg2, ivBackground, ivSurfaceSolid, ivCardShadow, shape, ivHeading, ivBody, ivFaint } from "./screenTheme";
import { BottomNav, BackButton } from "./screenUI";
import { SettingsGroup, SettingsRow, DataPathIllustration, IllustrationKey, DisclosureRow } from "./settingsUI";
import { JourneyCharacter } from "./journeyShared";

// ── Screen 14 · Profile ────────────────────────────────────────────────────────
export function ScreenProfile({
  onBack,
  onNavSelect,
  store,
  updateStore,
  onOpenSettings,
  isDemoMode,
  onToggleDemoMode,
  onOpenJourneyMap,
}: {
  // Profile is reached from Home's top-right icon, so "back" means Home.
  // Having a real back control also gives the edge swipe-back something
  // to press (see findBackButton in navGestures.ts).
  onBack?: () => void;
  onNavSelect?: (id: string) => void;
  store: Store;
  updateStore: (updater: (prev: Store) => Store) => void;
  onOpenSettings?: (screen: "notifications" | "dataPrivacy" | "help") => void;
  isDemoMode: boolean;
  onToggleDemoMode: (v: boolean) => void;
  onOpenJourneyMap?: () => void;
}) {
  const name = store.account?.name || "Anonymous observer";
  const initial = name.charAt(0);
  const firstEntryDate = [...store.history].sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
  const streakDays = computeStreak(store.history);
  const stats = [
    { value: store.entryCount, key: "profile.entries", label: "Thoughts logged" },
    { value: store.beliefs.length, key: "profile.beliefs", label: "Beliefs discovered" },
    { value: streakDays, key: "profile.streak", suffix: " days", label: "Streak" },
  ];
  const [copied, setCopied] = React.useState(false);
  const shareStats = async () => {
    const text = `${store.entryCount} thoughts logged, ${store.beliefs.length} beliefs discovered, ${streakDays}-day streak on Mindscape.`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* user cancelled */ }
      return;
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* clipboard permission denied */ }
    }
  };
  const logOut = onNavSelect
    ? () => {
        // Finish uploading anything not yet saved to the cloud, then sign out.
        if (isCloudSyncConfigured) flushCloudSync().finally(() => cloudSignOut());
        onNavSelect("auth");
      }
    : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", ...ivBackground }}>
      <div className="edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 16px 24px" }}>
        <div style={{ padding: "0 4px 24px" }}>
          <div style={{ marginBottom: 14 }}><BackButton onClick={onBack} color={ivBody} /></div>
          <div style={{ ...display, fontSize: 34, fontWeight: 400, color: ivHeading, marginBottom: 6 }}>Profile</div>
          <div style={{ ...sans, fontSize: 13, color: ivBody }}>We've been tracking your journey.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, backgroundColor: ivSurfaceSolid, borderRadius: 20, padding: 20, boxShadow: ivCardShadow, marginBottom: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: ivHeading, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...display, fontSize: 24, color: "#fff" }}>
            {initial}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...sans, fontSize: 17, fontWeight: 800, color: ivHeading }}>{name}</span>
            </div>
            {firstEntryDate && <span style={{ ...mono, fontSize: 12, color: ivFaint }}>With you since {firstEntryDate}</span>}
          </div>
        </div>

        <div data-tutorial="profile-stats" style={{ display: "flex", gap: 12, marginBottom: 22 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ flex: 1, backgroundColor: ivSurfaceSolid, borderRadius: shape.md, padding: "16px 12px", textAlign: "center", boxShadow: ivCardShadow }}>
              <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: ivHeading, marginBottom: 4 }}>
                <AnimatedNumber value={s.value} memoryKey={s.key} />{s.suffix}
              </div>
              <div style={{ ...sans, fontSize: 11, color: ivBody }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Entry point into ScreenJourneyMap — Identity Drift's own
        aspiration/driftNotes data, just walked as waypoints instead of
        read as a list (see that screen's own comment). Sits right under
        the stats row since both are "how's this going so far" at a
        glance, not buried in Settings-style rows below. */}
        <SettingsGroup footer={store.aspiration ? "Where you started, and how far the goal still is." : "Set a direction and watch the distance to it."}>
          <SettingsRow icon={<JourneyCharacter size={20} />} label="Your Journey" value={store.aspiration ? undefined : "Not set"} onClick={onOpenJourneyMap} />
          {store.entryCount > 0 && (
            <SettingsRow
              icon={<ShareNetwork size={17} />} label={copied ? "Copied to clipboard" : "Share your progress"} onClick={shareStats} chevron={false}
              trailing={copied ? <span style={{ ...sans, fontSize: 15, color: ivBody }}>✓</span> : undefined}
            />
          )}
        </SettingsGroup>

        {/* Design/dev affordance: instantly switches the whole app between
            curated demo content and a real, on-device, initially-empty
            store — see src/app/dataProvider.ts. Kept visible because App
            Store review uses it (APP-STORE.md) to see the app with data. */}
        <SettingsGroup
          header="Modes"
          footer="Demo Mode fills every screen with example data; turn it off to see only your own entries — a new account starts empty."
        >
          <SettingsRow icon={<Flask size={17} />} label="Demo Mode" trailing={<Switch label="Demo Mode" value={isDemoMode} onChange={onToggleDemoMode} />} />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow icon={<BellSimple size={17} />} label="Notifications" onClick={() => onOpenSettings?.("notifications")} />
          <SettingsRow icon={<LockSimple size={17} />} label="Data & Privacy" onClick={() => onOpenSettings?.("dataPrivacy")} />
          <SettingsRow icon={<Question size={17} />} label="Help" onClick={() => onOpenSettings?.("help")} />
        </SettingsGroup>

        <SettingsGroup style={{ marginBottom: 0 }}>
          <SettingsRow label={<Breathe inline amount={1.04}>Log out</Breathe>} destructive center onClick={logOut} />
        </SettingsGroup>
      </div>
      <BottomNav active="profile" onSelect={onNavSelect} vintage />
    </div>
  );
}

function Switch({ value, onChange, label }: { value: boolean; onChange?: (v: boolean) => void; label: string }) {
  return (
    <motion.button
      type="button" role="switch" aria-checked={value} aria-label={label}
      onClick={() => onChange?.(!value)} whileTap={{ scale: 0.95 }}
      whileFocus={{ boxShadow: "0 0 0 3px rgba(42,38,33,.16)" }}
      style={{ width: 44, height: 26, borderRadius: 13, border: 0, backgroundColor: value ? ivHeading : "rgba(42,38,33,0.12)", flexShrink: 0, padding: 3, cursor: "pointer", display: "flex", justifyContent: value ? "flex-end" : "flex-start", WebkitTapHighlightColor: "transparent" }}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 520, damping: 34 }} style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#fff", display: "block" }} />
    </motion.button>
  );
}

// ── Screen 14.1 · Notification settings ───────────────────────────────────────

export function ScreenNotificationSettings({ settings, onBack, onChange }: { settings: StoredSettings; onBack?: () => void; onChange?: (settings: StoredSettings) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ivBg2 }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: ivHeading, marginTop: 10 }}>Notifications</div>
      </div>
      <div className="edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px 24px" }}>
        <SettingsGroup
          footer={settings.dailyReminder
            ? (isNative ? "Once a day at this time, a nudge to write what's on your mind." : "Once a day, a nudge to log what's on your mind. It only fires while this app is open in a tab — there's no server behind it yet to reach you when it's closed.")
            : "Once a day, a nudge to log what's on your mind."}
        >
          <SettingsRow icon={<BellSimple size={17} />} label="Daily reminder" trailing={<Switch label="Daily reminder" value={settings.dailyReminder} onChange={(v) => onChange?.({ ...settings, dailyReminder: v })} />} />
          <Collapse open={settings.dailyReminder}>
            <SettingsRow
              icon={<Clock size={17} />}
              label={<label htmlFor="daily-reminder-time" style={{ cursor: "pointer" }}>Remind me at</label>}
              trailing={
                <input
                  id="daily-reminder-time" type="time" value={settings.dailyReminderTime}
                  onChange={(e) => onChange?.({ ...settings, dailyReminderTime: e.target.value })}
                  style={{ ...sans, fontSize: 16, color: ivHeading, border: 0, borderRadius: shape.xs, padding: "5px 9px", backgroundColor: "rgba(42,38,33,0.07)" }}
                />
              }
            />
          </Collapse>
        </SettingsGroup>
        <SettingsGroup footer="Hypothesis alerts arrive when the AI finds a new pattern. The weekly summary is one recap of the unconscious beliefs and changes that built up over the week.">
          <SettingsRow icon={<Lightbulb size={17} />} label="New hypothesis alerts" trailing={<Switch label="New hypothesis alerts" value={settings.newHypothesisAlert} onChange={(v) => onChange?.({ ...settings, newHypothesisAlert: v })} />} />
          <SettingsRow icon={<CalendarBlank size={17} />} label="Weekly summary" trailing={<Switch label="Weekly summary" value={settings.weeklySummary} onChange={(v) => onChange?.({ ...settings, weeklySummary: v })} />} />
        </SettingsGroup>
      </div>
    </div>
  );
}

// Two exits, two jobs: the JSON is the complete backup (everything the app
// knows, restorable), the Markdown is the diary itself in your own words
// with dates, readable in any notes app. See diaryExport.ts.
function downloadStoreAsJson(store: Store) {
  const stamp = formatDateDots(new Date()).replace(/\./g, "-");
  void saveTextFile(`mindscape-export-${stamp}.json`, JSON.stringify(store, null, 2), "application/json");
}

function downloadDiaryAsText(store: Store) {
  const today = formatDateDots(new Date());
  void saveTextFile(`mindscape-diary-${today.replace(/\./g, "-")}.md`, diaryAsMarkdown(store, today), "text/markdown");
}

// What the app does, in three beats that light up in turn: you speak (a
// waveform), it notices what repeats (the same word marked across three
// lines), a pattern takes shape (orbs joining). One beat at a time keeps
// the order readable without arrows doing all the work.
function HowItWorksIllustration() {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const violet = REGION_CONFIG.identity;
  const gold = REGION_CONFIG.career;
  const rose = REGION_CONFIG.relationships;
  const blue = REGION_CONFIG.curiosity;
  const CYCLE = 7.5;
  // Each beat is lit for its third of the cycle and dims for the rest.
  const beat = (i: number) => (reduce
    ? { animate: { opacity: 1 } }
    : { animate: { opacity: [0.35, 1, 1, 0.35, 0.35] }, transition: { duration: CYCLE, repeat: Infinity, ease: "easeInOut" as const, times: [0, 0.08, 0.3, 0.38, 1], delay: i * (CYCLE / 3) } });
  const font = "'Pretendard Variable', Pretendard, sans-serif";
  return (
    <svg role="img" aria-label="Three steps: you speak or write; the app notices what repeats across entries; a pattern takes shape as connected beliefs." viewBox="0 0 360 150" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`hbg${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={rose.tint} /><stop offset="0.5" stopColor={gold.tint} /><stop offset="1" stopColor={violet.tint} /></linearGradient>
      </defs>
      <rect width="360" height="150" rx="16" fill={`url(#hbg${id})`} />
      {/* 1 · You speak */}
      <motion.g {...beat(0)}>
        <rect x="14" y="22" width="96" height="84" rx="14" fill="#FFFFFF" opacity="0.85" />
        {[10, 22, 34, 18, 28, 14, 24].map((h, i) => (
          <motion.rect key={i} x={30 + i * 9} width="5" rx="2.5" fill={rose.ink}
            initial={{ y: 64 - h / 2, height: h }}
            animate={reduce ? undefined : { height: [h, h * 0.45, h], y: [64 - h / 2, 64 - (h * 0.45) / 2, 64 - h / 2] }}
            transition={reduce ? undefined : { duration: 0.9 + (i % 3) * 0.2, repeat: Infinity, ease: "easeInOut" }} />
        ))}
        <text x="62" y="128" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily={font} fill="#2A2621">You speak</text>
      </motion.g>
      {/* 2 · It notices what repeats */}
      <motion.g {...beat(1)}>
        <rect x="132" y="22" width="96" height="84" rx="14" fill="#FFFFFF" opacity="0.85" />
        {[0, 1, 2].map((r) => (
          <g key={r}>
            <rect x="144" y={38 + r * 22} width="72" height="4" rx="2" fill="#2A2621" opacity="0.15" />
            <motion.rect x={150 + r * 14} y={35 + r * 22} width="26" height="10" rx="3" fill={gold.color}
              initial={{ opacity: reduce ? 0.7 : 0 }} animate={reduce ? undefined : { opacity: [0, 0.75, 0.75, 0] }}
              transition={reduce ? undefined : { duration: CYCLE, repeat: Infinity, times: [0.34, 0.42 + r * 0.04, 0.62, 0.7], ease: "easeInOut" }} />
            <rect x={150 + r * 14} y={38 + r * 22} width="26" height="4" rx="2" fill={gold.ink} opacity="0.8" />
          </g>
        ))}
        <text x="180" y="128" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily={font} fill="#2A2621">It spots repeats</text>
      </motion.g>
      {/* 3 · A pattern takes shape */}
      <motion.g {...beat(2)}>
        <rect x="250" y="22" width="96" height="84" rx="14" fill="#FFFFFF" opacity="0.85" />
        <path d="M276 76 L298 46 L322 70 Z" fill="none" stroke={violet.ink} strokeOpacity="0.45" strokeWidth="1.4" />
        {[{ x: 276, y: 76, c: violet.color }, { x: 298, y: 46, c: gold.color }, { x: 322, y: 70, c: blue.color }].map((o, i) => (
          <motion.circle key={i} cx={o.x} cy={o.y} r="7" fill={o.c} style={{ transformOrigin: `${o.x}px ${o.y}px` }}
            animate={reduce ? undefined : { scale: [1, 1.25, 1] }} transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }} />
        ))}
        <text x="298" y="128" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily={font} fill="#2A2621">A pattern forms</text>
      </motion.g>
      {/* Order between beats. */}
      {[118, 236].map((x) => (
        <path key={x} d={`M${x} 64 l6 0 m-3 -3 l3 3 l-3 3`} fill="none" stroke="#2A2621" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

// ── Screen 14.2 · Data & privacy ───────────────────────────────────────────────
export function ScreenDataPrivacy({
  store,
  onBack,
  onResetData,
  onOpenPrivacyPolicy,
  onOpenTermsOfService,
  onDeleteAccount,
  aiConsentOn,
  onOpenAiConsent,
}: {
  aiConsentOn?: boolean;
  onOpenAiConsent?: () => void;
  store: Store;
  onBack?: () => void;
  onResetData?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenTermsOfService?: () => void;
  // Present only while a real cloud session exists — guests have no
  // account to delete, and "Delete all my data" already covers them.
  onDeleteAccount?: () => Promise<void>;
}) {
  const [armed, setArmed] = React.useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = React.useState(false);
  const [accountArmed, setAccountArmed] = React.useState(false);
  const [deletingAccount, setDeletingAccount] = React.useState(false);
  const [accountError, setAccountError] = React.useState("");
  const confirmDeleteAccount = async () => {
    if (!onDeleteAccount || deletingAccount) return;
    if (!accountArmed) { setAccountArmed(true); return; }
    setDeletingAccount(true);
    setAccountError("");
    try {
      await onDeleteAccount();
    } catch (err) {
      setDeletingAccount(false);
      setAccountArmed(false);
      setAccountError(err instanceof Error ? err.message : "Couldn't delete your account. Please try again.");
    }
  };
  const s = store;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ivBg2 }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: ivHeading, marginTop: 10 }}>Data & Privacy</div>
      </div>
      <div className="edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 16px 24px" }}>
        {/* Where your data goes, drawn: the phone, the on-device check,
            and the trip to Anthropic only while analysis is on. The exact
            wording is a promise, so it stays, word for word, one row down. */}
        <div style={{ backgroundColor: ivSurfaceSolid, borderRadius: shape.md, boxShadow: ivCardShadow, padding: 12, marginTop: 4 }}>
          <DataPathIllustration aiOn={!!aiConsentOn} cloud={isCloudSyncConfigured} />
          <div style={{ padding: "0 4px 4px" }}>
            <IllustrationKey items={[
              { tone: REGION_CONFIG.curiosity.color, text: isCloudSyncConfigured ? "Kept on this phone — and in your own encrypted account if you sign up." : "Kept on this phone. There's no account on a server." },
              { tone: REGION_CONFIG.security.color, text: "Checked here for signs of crisis before anything is sent." },
              { tone: REGION_CONFIG.identity.color, text: aiConsentOn ? "Sent to Anthropic only to be analyzed, then the analysis comes back." : "Not sent anywhere while AI analysis is off." },
            ]} />
          </div>
        </div>
        <SettingsGroup style={{ marginTop: 14 }}>
          <DisclosureRow title="Full details" open={showPrivacyDetails} onToggle={() => setShowPrivacyDetails((v) => !v)} first>
        <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.75, wordBreak: "keep-all", }}>
          {isCloudSyncConfigured
            ? "Browsing as a guest, everything stays only in this device's browser. If you've signed up, your unconscious beliefs, interpretations, and conversation history are also synced to a private, encrypted account — accessible only to you, never sold or shared, and protected by database-level access rules that make it impossible for anyone else to read your data even by mistake. Text you log with \"Speak your mind\" is only sent to Claude (Anthropic) at the moment it's analyzed."
            : "This app doesn't create an account on a separate server. Your unconscious beliefs, interpretations, and conversation history are stored only in this device's browser. Text you log with \"Speak your mind\" is only sent to Claude (Anthropic) at the moment it's analyzed, and never leaves your device otherwise."}
        </div>

        <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 12, lineHeight: 1.75, wordBreak: "keep-all", }}>
          One exception: what you write is checked on this device, before anything is sent anywhere, for language that suggests you might be in crisis. That check never leaves your device either — if it matches, you're shown real crisis resources instead of the usual analysis. Nothing about that check is stored, scored, or shared.
        </div>
          </DisclosureRow>
        </SettingsGroup>

        <SettingsGroup header="Stored on this device">
          {[
            ["Unconscious beliefs", s?.beliefs.length ?? 0],
            ["Recurring unconscious interpretations", s?.assumptions.length ?? 0],
            ["Connections between unconscious beliefs", s?.connections.length ?? 0],
            ["Conversation history", s?.history.length ?? 0],
            ["AI's hypotheses", s?.hypotheses.length ?? 0],
          ].map(([label, count]) => (
            <SettingsRow key={label as string} label={label} value={<span style={{ ...mono, fontSize: 13 }}>{count}</span>} />
          ))}
        </SettingsGroup>

        {onOpenAiConsent && (
          <SettingsGroup
            footer={aiConsentOn
              ? "On — entries are sent to Anthropic (US) for analysis. Tap to review or withdraw."
              : "Off — entries stay on this device and aren't analyzed. Tap to review or turn on."}
          >
            <SettingsRow icon={<Sparkle size={17} />} label="AI analysis consent" value={aiConsentOn ? "On" : "Off"} onClick={onOpenAiConsent} />
          </SettingsGroup>
        )}

        <SettingsGroup
          header="Take it with you"
          footer={(isCloudSyncConfigured
            ? "Your diary is yours. \"My diary as text\" is every entry in your own words, with its date and your aspiration on top, readable in any notes app. \"Full backup\" saves everything above as a JSON file — worth doing if you're browsing as a guest, since there's no account to fall back on if this device's storage is ever cleared."
            : "Your diary is yours. \"My diary as text\" is every entry in your own words, with its date and your aspiration on top, readable in any notes app. \"Full backup\" saves everything above as a JSON file. There's no account or backup behind this app — if this device's storage is ever cleared, this download is the only copy that survives.")
            + " Both stay free, always."}
        >
          <SettingsRow icon={<FileText size={17} />} label="My diary as text" onClick={() => downloadDiaryAsText(s)} chevron={false} />
          <SettingsRow icon={<DownloadSimple size={17} />} label="Full backup (JSON)" onClick={() => downloadStoreAsJson(s)} chevron={false} />
        </SettingsGroup>

        <SettingsGroup
          footer={armed
            ? (onDeleteAccount
              ? "All unconscious beliefs, interpretations, conversation history, and your goal will be erased from this device and your synced account. Your account itself (name and email) stays — use \"Delete my account\" below to remove that too. This can't be undone."
              : "All unconscious beliefs, interpretations, conversation history, and your goal stored on this device will be gone. This can't be undone.")
            : undefined}
        >
          <SettingsRow
            label={armed ? "Are you sure? Tap again to delete everything" : "Delete all my data"} destructive center
            onClick={() => (armed ? onResetData?.() : setArmed(true))}
            style={armed ? { backgroundColor: mdWarnSoft } : undefined}
          />
        </SettingsGroup>

        {onDeleteAccount && (
          <SettingsGroup
            footer={
              <span style={accountError ? { color: mdWarn } : undefined}>
                {accountError || (accountArmed
                  ? "Permanently deletes your login, name, email, and everything synced to your account, on every device. If you have a subscription, cancel it separately in your App Store or Google Play settings. This can't be undone."
                  : "Removes your account and all synced data. Download your data first if you want to keep a copy.")}
              </span>
            }
          >
            <SettingsRow
              label={deletingAccount ? "Deleting your account…" : accountArmed ? "Are you sure? Tap again to delete your account" : "Delete my account"}
              destructive center disabled={deletingAccount} onClick={confirmDeleteAccount}
              style={accountArmed ? { backgroundColor: mdWarnSoft } : undefined}
            />
          </SettingsGroup>
        )}

        <SettingsGroup header="Legal" style={{ marginBottom: 0 }}>
          <SettingsRow label="Privacy Policy" onClick={onOpenPrivacyPolicy} />
          <SettingsRow label="Terms of Service" onClick={onOpenTermsOfService} />
          <SettingsRow label="End User License Agreement" onClick={() => openLegalPage("eula")} />
          <SettingsRow label="Refund & Subscription Policy" onClick={() => openLegalPage("refund")} />
        </SettingsGroup>
      </div>
    </div>
  );
}

// ── Screen 14.3 · Help ─────────────────────────────────────────────────────────
const HELP_ITEMS = [
  { q: "What does this app do?", a: "It's not a diary for logging what happened. Over time, it quietly reflects back why you think and act the way you do — the unconscious beliefs and interpretations that keep showing up in your actual words and actions, without you consciously realizing it." },
  { q: "How do I use \"Speak your mind\"?", a: "Don't try to organize it. Whatever happened today, a thought that suddenly crossed your mind, something you haven't decided yet — just say or type it in whatever order it comes to you. Voice uses your browser's built-in recognition; text supports direct typing." },
  { q: "What are unconscious patterns?", a: "It shows the unconscious beliefs that seem to drive your actual decisions, even ones you're not fully aware of, as circles that grow as more evidence builds up. Below that are \"recurring unconscious interpretations\" — interpretations that automatically pop up in specific situations. Lines between circles are connections between unconscious beliefs that appear to come from the same root." },
  { q: "How is an AI hypothesis different from an unconscious belief?", a: "An unconscious belief is the thing itself — what repeatedly shows up in your actual words and actions. A hypothesis is a higher-level theory the AI offers by crossing multiple unconscious beliefs/connections (e.g., \"this pattern shows up the same way in both your career and your relationships\"). It's not a settled fact — it's an interpretation you refine together by agreeing or pushing back." },
  { q: "How is distance from your goal calculated?", a: "The AI points out the concrete gap between who you said you wanted to become and the unconscious beliefs/interpretations that have actually built up. You set the goal directly on that screen." },
  { q: "What is this analysis based on?", a: "It draws on concepts from CBT (Cognitive Behavioral Therapy) and ACT (Acceptance and Commitment Therapy). Cognitive-distortion tags like \"All-or-nothing thinking\" and \"Overgeneralization\" come from CBT; distance from your goal comes from ACT's \"value direction\" concept. A single entry never creates a belief — it takes at least 3 similar patterns building up. Confidence never reaches 100%, and actually goes down when there are conflicting entries. That said, this is a self-reflection tool, not a psychological diagnosis or treatment." },
  { q: "What if I'm in crisis?", a: "If what you write suggests you might be in crisis, we show you real crisis resources (like the 988 Suicide & Crisis Lifeline) right away, instead of the usual analysis — that check happens entirely on your device, before anything is sent anywhere. If you're in danger right now, please contact emergency services or 988 directly rather than waiting on this app." },
];

function HelpDisclosure({ question, answer, open, onToggle, first }: { question: string; answer: string; open: boolean; onToggle: () => void; first: boolean }) {
  return (
    <DisclosureRow title={question} open={open} onToggle={onToggle} first={first} titleStyle={{ ...display, fontWeight: 400 }}>
      <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.65, wordBreak: "keep-all" }}>{answer}</div>
    </DisclosureRow>
  );
}

export function ScreenHelp({ onBack, onReplayTutorial }: { onBack?: () => void; onReplayTutorial?: () => void }) {
  const [openQuestion, setOpenQuestion] = React.useState<number | null>(0);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ivBg2 }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: ivHeading, marginTop: 10 }}>Help</div>
        <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
          There are patterns in your mind. You just can't see them from inside.
        </div>
      </div>
      <div className="edge-fade" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px 24px" }}>
        {/* The app in three beats, before any question is asked. */}
        <div style={{ backgroundColor: ivSurfaceSolid, borderRadius: shape.md, boxShadow: ivCardShadow, padding: 12, marginBottom: 22 }}>
          <HowItWorksIllustration />
          <div style={{ ...sans, fontSize: 13, color: ivHeading, lineHeight: 1.5, padding: "10px 4px 2px", wordBreak: "keep-all" }}>
            Say what's on your mind, in any order. Over time the app notices what keeps coming back, and shows you the beliefs underneath.
          </div>
        </div>
        {onReplayTutorial && (
          <SettingsGroup>
            <SettingsRow icon={<ArrowCounterClockwise size={17} />} label="Replay the tutorial" onClick={onReplayTutorial} />
          </SettingsGroup>
        )}
        {/* Questions as disclosure rows: the list of seven reads at a
            glance, and one answer opens at a time where it was asked. */}
        <SettingsGroup header="Questions" style={{ marginBottom: 0 }}>
          {HELP_ITEMS.map((h, i) => (
            <HelpDisclosure key={h.q} question={h.q} answer={h.a} open={openQuestion === i} onToggle={() => setOpenQuestion((cur) => (cur === i ? null : i))} first={i === 0} />
          ))}
        </SettingsGroup>
      </div>
    </div>
  );
}

// ── Screen 14.4/14.5 · Legal documents ────────────────────────────────────────
// Both drafted to accurately describe how the app actually behaves today
// (local-storage-only, what gets sent to Claude/Anthropic and when,
// on-device crisis-language checking, no paid plans) rather than generic boilerplate — but they're still a draft, not
// legal advice, and say so prominently. Swap in this file's content once
// an actual lawyer has reviewed it for your jurisdiction; nothing else
// about how these render needs to change.
type LegalSection = { heading: string; body: string };
type LegalDoc = "privacy" | "terms" | "eula" | "refund";

// The full, hosted versions live in public/legal/ (served at /legal/*.html)
// — those are the documents of record, and the URLs App Store Connect /
// Play Console point at. The in-app sections below are a faithful summary
// of them. Korean-language devices get the Korean edition (*.ko.html).
function legalPageUrl(doc: LegalDoc): string {
  const lang = typeof navigator !== "undefined" ? (navigator.language || "").toLowerCase() : "";
  return `/legal/${doc}${lang.startsWith("ko") ? ".ko" : ""}.html`;
}
function openLegalPage(doc: LegalDoc) {
  window.open(legalPageUrl(doc), "_blank", "noopener,noreferrer");
}

function ScreenLegalDocument({
  title,
  lastUpdated,
  sections,
  fullVersion,
  onBack,
}: {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
  fullVersion?: LegalDoc;
  onBack?: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: mdHeading, marginTop: 10 }}>{title}</div>
        <div style={{ ...mono, fontSize: 11, color: mdFaint, marginTop: 6 }}>Last updated {lastUpdated}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 32px" }}>
        <div style={{ padding: 14, borderRadius: 12, backgroundColor: mdWarnSoft, borderLeft: `2px solid ${mdWarn}`, marginBottom: 22 }}>
          <div style={{ ...sans, fontSize: 13, color: mdWarnLabel, lineHeight: 1.6, wordBreak: "keep-all" }}>
            Draft — written to accurately describe how the app works today, but not yet reviewed by a lawyer. Have this reviewed for your jurisdiction before relying on it.
          </div>
        </div>
        {fullVersion && (
          <a
            href={legalPageUrl(fullVersion)} target="_blank" rel="noopener noreferrer"
            style={{ display: "block", ...sans, fontSize: 13, fontWeight: 600, color: mdHeading, marginBottom: 22, textDecoration: "underline" }}
          >
            This is a summary. Read the full {title} ↗
          </a>
        )}
        {sections.map((s) => (
          <div key={s.heading} style={{ marginBottom: 22 }}>
            <div style={{ ...sans, fontSize: 13, fontWeight: 700, color: mdHeading }}>{s.heading}</div>
            <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 6, lineHeight: 1.7, wordBreak: "keep-all" }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    heading: "1. Overview",
    body: isCloudSyncConfigured
      ? "What you write in Mindscape can reveal your thoughts, beliefs, and mental state, so we treat it as sensitive information. As a guest, everything stays in this browser's storage on your device. If you create an account, your data is also synced to a private, encrypted database that only your own login can read."
      : "What you write in Mindscape can reveal your thoughts, beliefs, and mental state, so we treat it as sensitive information. Everything you record stays in this browser's storage on your device — there's no Mindscape account server holding a copy.",
  },
  {
    heading: "2. What we collect",
    body: "Text you write or speak with \"Speak your mind\"; the AI's analysis of it (beliefs, interpretations, hypotheses, summaries); your reactions to those insights; an optional aspiration; your settings; and, only if you sign up, your name, email, and a password (stored only as a one-way hash by our authentication provider). We don't collect location, contacts, photos, advertising IDs, or anything outside the app.",
  },
  {
    heading: "3. Voice input",
    body: "If you use voice, the microphone is used on your device to draw the waveform. Speech-to-text is done by your browser's or operating system's built-in recognizer (e.g. Apple or Google), which may send audio to that vendor to return text. Mindscape itself never receives or stores audio — only the resulting text.",
  },
  {
    heading: "4. Who processes your data",
    body: "Anthropic (Claude) receives the text of an entry, relevant prior insights, and your first name, solely to generate your analysis — it does not use this to train its models. Vercel hosts the app and relays those requests. " +
      (isCloudSyncConfigured ? "Supabase stores your account and synced data (in Seoul, Korea). " : "") +
      "Some of these providers are in the United States. We never sell your data, show ads, or use third-party analytics or tracking.",
  },
  {
    heading: "5. Crisis-language detection",
    body: "Every entry is checked on your device — not sent anywhere, not reviewed by the AI — for language that may indicate a crisis. If detected, you're shown crisis support resources first. The result is never stored, logged, or transmitted.",
  },
  {
    heading: "6. Your rights & deleting your data",
    body: (isCloudSyncConfigured
      ? "Profile → Data & Privacy lets you download your diary as readable text or everything as a full backup (JSON), erase all your data (\"Delete all my data\"), or permanently delete your account with its name, email, and all synced data (\"Delete my account\", shown while signed in). "
      : "Profile → Data & Privacy lets you download your diary as readable text or everything as a full backup (JSON), or erase it permanently (\"Delete all my data\"). ") +
      "You can also email us to access, correct, delete, or export your data, or to withdraw consent. Depending on where you live (e.g. Korea, the EU/UK, California), you may have additional rights and can complain to your data protection authority.",
  },
  {
    heading: "7. Retention",
    body: "Data on your device stays until you delete it. Account data is erased when you delete your account (and from backups shortly after). Anthropic deletes analysis requests within 30 days under its commercial retention policy (longer only if flagged for a Usage Policy violation). Server logs are kept for up to 30 days for security.",
  },
  {
    heading: "8. Children",
    body: "Mindscape isn't intended for anyone under 14 (or the age of digital consent in your country, if higher), and we don't knowingly collect their information.",
  },
  {
    heading: "9. Changes & contact",
    body: "We'll notify you in the app before material changes take effect. Questions or requests: [CONTACT EMAIL — add before publishing].",
  },
];

const TERMS_OF_SERVICE_SECTIONS: LegalSection[] = [
  {
    heading: "1. What this app is",
    body: "Mindscape is a self-reflection tool that uses AI to help surface patterns in your own words, drawing on concepts from Cognitive Behavioral Therapy (CBT) and Acceptance and Commitment Therapy (ACT).",
  },
  {
    heading: "2. Not medical or mental health treatment",
    body: "Mindscape is not therapy, counseling, medical advice, or a treatment service, and nothing in it is provided or reviewed by a licensed clinician. It isn't monitored and can't respond to emergencies. If you're in crisis, contact emergency services right away (Korea: 112/119 or 109; US: call or text 988) or use the in-app crisis resources.",
  },
  {
    heading: "3. Eligibility & your account",
    body: (isCloudSyncConfigured
      ? "You must be at least 14 (or older where local law requires). You can use Mindscape as a guest (data on this device only) or create an account to sync across devices. Keep your login secure; you're responsible for activity under it. You can delete your account any time in Data & Privacy — deletion is permanent and we can't restore it."
      : "You must be at least 14 (or older where local law requires). Your data exists only in this browser's storage — if it's cleared, we can't recover it."),
  },
  {
    heading: "4. Your content",
    body: "You own what you write. You give us a limited license to store and process it — including sending it to our AI provider — only to provide the app to you. We don't use it to train AI models or for advertising, and there are no public or social features.",
  },
  {
    heading: "5. Acceptable use",
    body: "Don't use Mindscape to break the law or harm anyone, to reverse-engineer, disrupt, or bypass the app's security, to access others' data, to scrape or overload our servers, or to misuse the AI systems it relies on.",
  },
  {
    heading: "6. AI-generated content",
    body: "Analysis, hypotheses, and other AI output are probabilistic and can be wrong or incomplete. They aren't facts about you — use your own judgment.",
  },
  {
    heading: "7. Subscriptions",
    body: "Mindscape Pro is not currently offered — every feature is free and you won't be charged. If paid plans are introduced, they'll be sold through the App Store or Google Play, we'll tell you in advance, and the Refund & Subscription Policy will apply.",
  },
  {
    heading: "8. Disclaimers & liability",
    body: "Mindscape is provided \"as is,\" without warranties. To the extent the law allows, we aren't liable for indirect damages or data loss, and our total liability is limited to what you paid us in the past 12 months (or USD 50). Mandatory consumer rights where you live are not affected.",
  },
  {
    heading: "9. Changes & governing law",
    body: "We'll give in-app notice at least 7 days (30 days if unfavorable) before material changes. These terms are governed by the laws of the Republic of Korea. Contact: [CONTACT EMAIL — add before publishing].",
  },
];

export function ScreenPrivacyPolicy({ onBack }: { onBack: () => void }) {
  return <ScreenLegalDocument title="Privacy Policy" lastUpdated="November 5, 2026" sections={PRIVACY_POLICY_SECTIONS} fullVersion="privacy" onBack={onBack} />;
}

export function ScreenTermsOfService({ onBack }: { onBack: () => void }) {
  return <ScreenLegalDocument title="Terms of Service" lastUpdated="November 5, 2026" sections={TERMS_OF_SERVICE_SECTIONS} fullVersion="terms" onBack={onBack} />;
}
