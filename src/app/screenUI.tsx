import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { CognitiveRegion } from "./neuralBrainLayout";
import { haptic } from "./native";
import { AnimatedNumber, Breathe, MeterFill, SETTLE } from "./motionPrimitives";
import { display, hand, mono, sans } from "./typefaces";
import { ArrowLeft, BookOpen, Graph, House, Sparkle, User, Waveform } from "@phosphor-icons/react";
import { subtle, hair, accent, dkHeading, dkBody, dkAccent, dkAccentLight, dkTrack, dkDivider, mdBg, mdHeading, mdBody, mdAccent, mdAccentText, mdAccentSoft, mdTrack, mdDivider, ivCardShadow, shape, ivBorder, ivHeading, ivBody, ivFaint } from "./screenTheme";

// ── Opening a page from the row you tapped ───────────────────────────────────
// A row that leads somewhere hands its own rectangle to the app shell
// (OpenFromContext); the next screen then grows out of that row (the
// "grow" transition: a clip-path opening like the one Home's orbs use to
// open the sky), instead of sliding in from the side. If the tap doesn't navigate, the hand-off lapses.
export const OpenFromContext = React.createContext<((el: HTMLElement) => void) | null>(null);

// ── Shared primary-screen header system ─────────────────────────────────────
// Mind, Analysis, and History all position, size, and space their title and
// subtitle from these same values instead of each eyeballing its own — see
// the cross-screen consistency pass. Home keeps its own unique hero
// treatment (it's the landing screen, not part of this shared system).
// Kept as shared VALUES rather than a shared component: each screen's
// header sits in a structurally different context (Mind: absolute over a
// fixed scene; Analysis/History: the top of a flex/scroll column), so
// literally sharing a component risked restructuring more of each screen
// than this consistency pass calls for.
export const PRIMARY_HEADER_TOP = 34; // px down from each screen's own full-bleed top edge
export const PRIMARY_HEADER_SIDE = 30; // px — same left/right grid every primary screen's own body content already uses
// "Deep charcoal / muted taupe / quieter taupe" — the three text weights
// every primary screen's header should be drawn from, instead of each
// screen's header nudging its own slightly different shade. Was cream-on-
// photo with a drop shadow for legibility; now flat ivory needs neither —
// dark ink on a light ground reads on its own.
const HEADER_TEXT_PRIMARY = ivHeading;
const HEADER_TEXT_SECONDARY = ivBody;
const HEADER_TEXT_TERTIARY = ivFaint;
const primaryTitleStyle: React.CSSProperties = { ...display, fontSize: 34, lineHeight: 1.05, color: HEADER_TEXT_PRIMARY };
// whiteSpace/overflow/textOverflow is a safety net, not the primary fix —
// every subtitle string itself was shortened to comfortably fit one line;
// this just guarantees it can never wrap even if a header's control row
// leaves less room than expected.
const primaryTitleSubtitleStyle: React.CSSProperties = { ...hand, fontSize: 19, fontWeight: 500, color: HEADER_TEXT_SECONDARY, marginTop: 2, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

// The title of a main tab (Mind, Analysis, Diary), written the way the
// cards below it are: the word swiped with a highlighter in the tab's
// colour, a small star sticker beside it, and the subtitle in hand.
export function PageTitle({ title, subtitle, tone }: { title: string; subtitle?: React.ReactNode; tone: CognitiveRegion }) {
  const reduce = useReducedMotion();
  const c = REGION_CONFIG[tone];
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ position: "relative", display: "inline-block" }}>
          <motion.span aria-hidden
            initial={{ scaleX: reduce ? 1 : 0 }} animate={{ scaleX: 1 }} transition={{ duration: reduce ? 0 : 0.55, delay: reduce ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: "absolute", left: -4, right: -6, bottom: "0.06em", height: "0.42em", transformOrigin: "left center", borderRadius: "3px 8px 4px 9px",
              transform: "rotate(-1deg)", background: `linear-gradient(100deg, ${c.color}66, ${c.color}3a 75%, ${c.color}55)` }} />
          <span style={{ position: "relative", ...primaryTitleStyle }}>{title}</span>
        </span>
        <span aria-hidden className={reduce ? undefined : "twinkle"} style={{ lineHeight: 0, color: c.color, marginTop: 2, ["--tw-dur" as string]: "3.2s" } as React.CSSProperties}>
          <Sparkle size={13} weight="fill" />
        </span>
      </div>
      {subtitle && <div style={{ ...primaryTitleSubtitleStyle, color: c.ink, marginTop: 4 }}>{subtitle}</div>}
    </>
  );
}

// ── Status bar ────────────────────────────────────────────────────────────────
export function StatusBar({ modernist }: { modernist?: boolean }) {
  const color = modernist ? mdHeading : dkHeading;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 4px", flexShrink: 0 }}>
      <span style={{ ...sans, fontSize: 13, fontWeight: modernist ? 800 : 600, color }}>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 16, height: 10, border: `1px solid ${color}`, borderRadius: 2, position: "relative" }}>
          <div style={{ position: "absolute", inset: 1, right: 4, backgroundColor: color, borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

// Same parallel-session port as NavIcon below — a small waveform glyph for
// Home's "Speak your mind" button, replacing the plain dot with something that
// actually reads as "speak/record."
export function WaveformIcon({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  return <Waveform size={size} color={color} weight="bold" />;
}

// Real line icons for the bottom nav, ported from the friend's parallel
// session (odysseyof26's 8580f53) — a clear upgrade over the earlier
// colored-square/dot placeholders, with no functional conflict, so it's
// merged in on its own rather than picking one whole branch over the other.
function NavIcon({ id, color, size = 23, active = false }: { id: string; color: string; size?: number; active?: boolean }) {
  const weight = active ? "fill" : "regular";
  if (id === "home") return <House size={size} color={color} weight={weight} />;
  if (id === "analysis") return <Graph size={size} color={color} weight={weight} />;
  if (id === "history") return <BookOpen size={size} color={color} weight={weight} />;
  return <User size={size} color={color} weight={weight} />;
}

// ── Bottom navigation ─────────────────────────────────────────────────────────
// `dark` matches the imported design spec's nav (blurred near-black bar) —
// only Home/Analysis pass it; every other screen keeps the light bar. Both
// variants share the ported NavIcon set and the animated sliding selection
// pill (also from the friend's parallel session) instead of each having
// their own placeholder indicator.
export function BottomNav({ active, onSelect, dark, modernist, vintage }: { active: string; onSelect?: (id: string) => void; dark?: boolean; modernist?: boolean; vintage?: boolean }) {
  const items = [
    { id: "home", label: "Home" },
    // Mind is one screen: how close you are to who you want to be, today's
    // discovery, further insights and the links to go deeper. (It was split
    // into Mind and Analysis for a while; both led with the same discovery.)
    { id: "analysis", label: "Mind" },
    // The tab is the person's diary (entries by day, see JournalView); the
    // route id stays "history".
    { id: "history", label: "Diary" },
    // Profile used to live here, but Home's top-right icon already opens it
    // (see ScreenHome) — that's still true, and the slot that briefly held a
    // standalone Premium tab is gone too: its features now live inside
    // Mind/Analysis/History for everyone, and the bar is exactly
    // Home/Mind/Analysis/History.
  ];
  const activeColor = vintage ? ivHeading : modernist ? mdAccentText : dark ? dkAccentLight : "#6B6EF6";
  const inactiveColor = vintage ? "#ADA290" : modernist ? "#8b8785" /* --color-neutral-600 */ : dark ? "#726A8A" : "#8B8A92";
  // `vintage` now means the ivory theme (Home/Mind/Analysis/History, all
  // sharing one floating nav bar) — kept the original prop name to avoid
  // rippling a rename through every call site, but the "vintage" tan photo
  // palette this branch used to draw from is gone; see ivHeading/ivSurface
  // etc. above. It still skips the sliding pill entirely — the reference
  // design marks the active tab with color + a small dot underneath
  // instead of a highlight chip.
  const pillColor = modernist ? mdAccentSoft : dark ? "rgba(123,92,240,0.16)" : "#F0EEFF";
  const themeKey = modernist ? "modernist" : dark ? "dark" : "light";
  // This ivory bar nests two layers instead of putting border-radius,
  // backdrop-blur, and box-shadow all on one element: a blurred backdrop
  // only reliably clips to a rounded corner when something with overflow:
  // hidden sits between it and the edge, but overflow:hidden on that same
  // element would just as reliably clip its OWN box-shadow (shadows render
  // outside the box, right where overflow:hidden cuts them off). Split in
  // two, each half only carries what it can render correctly: the outer
  // div is transparent and just places the shadow + margins; the inner
  // div is what actually has the ivory fill/blur, clipped clean by its own
  // overflow:hidden so the rounded corners never show a leftover square
  // corner of unclipped background/blur behind them. The other themes
  // don't combine backdrop-blur with a border-radius in the first place,
  // so they're unaffected and keep the single-div version.
  const barStyle: React.CSSProperties = {
    position: modernist || dark || vintage ? "sticky" : "static",
    bottom: modernist || dark || vintage ? 0 : undefined,
    display: "flex",
    // The floating ivory bar (this bar and Home's "Speak your mind" card
    // above it) sits free of the frame edge — a margin + full border-
    // radius instead of the other themes' edge-to-edge bar with just a
    // top hairline. Its own margin/shadow live on the outer wrapper below
    // instead of here — see the comment above.
    borderTop: vintage ? "none" : `1px solid ${modernist ? mdDivider : dark ? dkDivider : hair}`,
    borderRadius: vintage ? shape.xl : 0,
    // Opaque now, not a translucent glass panel over blurred content —
    // "no glass, no backdrop blur panels" (see the removed backdropFilter
    // here). A plain opaque bar reads as decided; a frosted floating one
    // reads as a default nobody chose.
    backgroundColor: vintage ? "#FBF8F2" : modernist ? "#ffffff" : dark ? "#0a0716" : "#ffffff",
    overflow: vintage ? "hidden" : "visible",
    padding: "8px 10px",
    // Real value on a notched/gesture-nav phone (clears the home
    // indicator so nothing renders under it), 0px everywhere else —
    // always safe to include unconditionally. The ivory bar already has
    // its own bottom margin standing in for that gap (on the outer wrapper).
    paddingBottom: vintage ? "8px" : "calc(8px + env(safe-area-inset-bottom))",
    flexShrink: vintage ? undefined : 0,
  };
  const bar = (
    <div style={barStyle}>
      {items.map((item) => {
        const isActive = active === item.id;
        const color = isActive ? activeColor : inactiveColor;
        return (
          <motion.div
            key={item.id}
            data-tutorial={`nav-${item.id}`}
            role="button"
            tabIndex={0}
            onClick={() => { if (!isActive) haptic("tap"); onSelect?.(item.id); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect?.(item.id); }}
            whileTap={{ scale: 0.9, opacity: 0.8 }}
            transition={SETTLE}
            style={{ flex: 1, position: "relative", display: "flex", justifyContent: "center", padding: "2px 4px", cursor: "pointer" }}
          >
            {isActive && !vintage && (
              <motion.div
                layoutId={`navSelectedPill-${themeKey}`}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: "absolute", inset: "0 6px", borderRadius: 18, backgroundColor: pillColor, zIndex: 0 }}
              />
            )}
            <Breathe amount={1.06} style={{ position: "relative", zIndex: 1 }}>
            <div style={{ minWidth: 44, minHeight: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <NavIcon id={item.id} color={color} active={isActive} />
              <span style={{ ...sans, fontSize: 11, fontWeight: isActive ? (modernist ? 800 : 600) : (modernist ? 500 : 400), color }}>{item.label}</span>
              {/* The dot slides between tabs (layoutId) instead of blinking
              off one and on the next. */}
              {vintage && isActive && <motion.span layoutId="navDot-vintage" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: ivHeading }} />}
            </div>
            </Breathe>
          </motion.div>
        );
      })}
    </div>
  );
  if (!vintage) return bar;
  // Outer wrapper: transparent, carries only what needs to render outside
  // the inner div's overflow:hidden clip (the shadow) or outside its own
  // box entirely (the margins placing this pill free of the frame edge).
  return (
    <div
      style={{
        position: "sticky", bottom: 0, flexShrink: 0,
        margin: "0 20px", marginBottom: "calc(14px + env(safe-area-inset-bottom))",
        borderRadius: shape.xl, boxShadow: ivCardShadow,
      }}
    >
      {bar}
    </div>
  );
}

// `ivory` is the opening flow's own theme (quote/splash/auth/login/signup/
// onboarding — see OPENING_BG above): a solid ivHeading charcoal pill,
// matching how every other ivory screen marks its one "active" action
// (nav, toggles) with charcoal rather than a saturated accent color.
// ── InkButton ────────────────────────────────────────────────────────────────
// The buttons on the opening screens. The filled one is deep ink with a
// slow wash of the app's colors moving underneath and a band of light
// that sweeps across it every few seconds; the outlined one has a border
// that shades through the same colors. Both lift slightly under a finger,
// send a ripple out from exactly where they were pressed, and — while
// working — swap their label for three bouncing dots. All of it stops
// under reduced motion.
// Both now take the page's colour (`tone`). The filled one is a cloth tab in
// that colour's ink with a stitched edge, like the diary's cover; the
// outlined one is a slip of paper held on by washi tape. Labels are in hand.
function InkButton({ children, onClick, disabled, loading, ghost, icon, tone = "identity" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; ghost?: boolean; icon?: React.ReactNode; tone?: CognitiveRegion }) {
  const reduce = useReducedMotion();
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number }[]>([]);
  const off = disabled || loading;
  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (off || reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const rid = Date.now() + Math.random();
    setRipples((rs) => [...rs, { id: rid, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setRipples((rs) => rs.filter((x) => x.id !== rid)), 700);
  };
  const c = REGION_CONFIG[tone];
  const v = c.color, rose = REGION_CONFIG.relationships.color, gold = REGION_CONFIG.career.color;
  return (
    <Breathe active={!off} amount={1.02}>
      <motion.button
        type="button" disabled={disabled} aria-busy={loading || undefined} onClick={off ? undefined : () => { haptic("press"); onClick?.(); }} onPointerDown={press}
        whileHover={off ? undefined : { y: -2 }} whileTap={off ? undefined : { scale: 0.97 }} transition={SETTLE}
        whileFocus={off ? undefined : { boxShadow: `0 0 0 3px ${v}40` }}
        style={{
          position: "relative", overflow: "hidden", width: "100%", minHeight: 52, padding: "14px 18px", borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 9, cursor: off ? "default" : "pointer",
          ...hand, fontSize: ghost ? 22 : 24, fontWeight: 700, lineHeight: 1, WebkitTapHighlightColor: "transparent",
          ...(ghost
            ? {
              color: c.ink, border: 0, backgroundColor: "#FFFCF6",
              backgroundImage: `linear-gradient(160deg, ${v}1f, transparent 60%)`,
              boxShadow: `0 0 0 1px ${v}40, 0 10px 20px -14px ${c.ink}`,
            }
            : {
              color: "#FFFFFF", border: 0, textShadow: "0 1px 1px rgba(0,0,0,.18)",
              backgroundColor: disabled ? "rgba(42,38,33,.24)" : c.ink,
              backgroundImage: disabled ? "none" : `linear-gradient(120deg, ${c.ink} 0%, ${c.ink} 45%, ${v} 140%)`,
              boxShadow: off ? "none" : `0 12px 24px -12px ${c.ink}, 0 4px 10px -6px rgba(42,38,33,.45), inset 0 1px 0 rgba(255,255,255,.22)`,
            }),
        }}
      >
        {/* Stitching around a filled tab, the same as the diary's cloth cover. */}
        {!ghost && (
          <span aria-hidden style={{ position: "absolute", inset: 4, borderRadius: 12, border: `1.5px dashed rgba(255,255,255,${disabled ? 0.35 : 0.5})`, pointerEvents: "none" }} />
        )}
        {/* A strip of washi tape holding the paper slip down. */}
        {ghost && (
          <span aria-hidden style={{
            position: "absolute", top: -2, left: 18, width: 46, height: 13, transform: "rotate(-5deg)", pointerEvents: "none", opacity: 0.85,
            backgroundImage: `repeating-linear-gradient(45deg, ${v}99 0 5px, ${v}55 5px 10px)`,
          }} />
        )}
        {!ghost && !disabled && (
          <>
            {/* The color wash moving under the ink. */}
            <span aria-hidden className={reduce ? undefined : "ink-wash"} style={{
              position: "absolute", inset: "-60% -20%", opacity: 0.35, pointerEvents: "none",
              backgroundImage: `radial-gradient(circle at 20% 50%, ${v}aa 0%, transparent 38%), radial-gradient(circle at 80% 40%, ${rose}88 0%, transparent 36%), radial-gradient(circle at 55% 90%, ${gold}77 0%, transparent 34%)`,
            }} />
            {/* The sweep of light. */}
            {!reduce && <span aria-hidden className="ink-sheen" style={{ position: "absolute", top: 0, bottom: 0, width: "40%", pointerEvents: "none",
              backgroundImage: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)" }} />}
          </>
        )}
        {ripples.map((r) => (
          <motion.span key={r.id} aria-hidden initial={{ scale: 0, opacity: 0.45 }} animate={{ scale: 9, opacity: 0 }} transition={{ duration: 0.65, ease: "easeOut" }}
            style={{ position: "absolute", left: r.x - 20, top: r.y - 20, width: 40, height: 40, borderRadius: "50%", pointerEvents: "none", backgroundColor: ghost ? `${v}55` : "rgba(255,255,255,0.55)" }} />
        ))}
        <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 9 }}>
          {loading ? (
            <span aria-label="Working" style={{ display: "inline-flex", gap: 5, padding: "4px 0" }}>
              {[0, 1, 2].map((i) => (
                <motion.span key={i} animate={reduce ? undefined : { y: [0, -5, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.13, ease: "easeInOut" }}
                  style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "currentColor", display: "block" }} />
              ))}
            </span>
          ) : (
            <>
              {icon}
              {children}
            </>
          )}
        </span>
      </motion.button>
    </Breathe>
  );
}

export function PrimaryBtn({ children, onClick, disabled, modernist = false, ivory = false, loading = false, icon, tone }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; modernist?: boolean; ivory?: boolean; loading?: boolean; icon?: React.ReactNode; tone?: CognitiveRegion }) {
  if (ivory) return <InkButton onClick={onClick} disabled={disabled} loading={loading} icon={icon} tone={tone}>{children}</InkButton>;
  // Breathes while it waits (see Breathe); a disabled button holds still,
  // since there's nothing to invite.
  return (
    <Breathe active={!disabled} amount={1.03}>
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.975, opacity: 0.92 }}
      transition={SETTLE}
      whileFocus={disabled ? undefined : { boxShadow: `0 0 0 3px ${ivory ? "rgba(42,38,33,.16)" : modernist ? "rgba(91,77,130,.18)" : "rgba(255,255,255,.14)"}` }}
      style={{
        ...sans, width: "100%", minHeight: 48, padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: disabled ? (ivory ? "rgba(42,38,33,.14)" : modernist ? mdTrack : dkTrack) : (ivory ? ivHeading : modernist ? mdAccent : dkAccent),
        color: disabled ? (ivory ? "rgba(42,38,33,.4)" : modernist ? "#a29d9d" : "#6E6580") : "#fff",
        border: 0, borderRadius: 14, fontSize: 17, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.72 : 1,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </motion.button>
    </Breathe>
  );
}

export function GhostBtn({ children, onClick, modernist = false, ivory = false, icon, tone }: { children: React.ReactNode; onClick?: () => void; modernist?: boolean; ivory?: boolean; icon?: React.ReactNode; tone?: CognitiveRegion }) {
  if (ivory) return <InkButton onClick={onClick} ghost icon={icon} tone={tone}>{children}</InkButton>;
  return (
    <Breathe amount={1.03}>
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ backgroundColor: ivory ? "rgba(42,38,33,.035)" : modernist ? "rgba(91,77,130,.045)" : "rgba(255,255,255,.035)" }}
      whileTap={{ scale: 0.975, opacity: 0.72 }}
      transition={SETTLE}
      whileFocus={{ boxShadow: `0 0 0 3px ${ivory ? "rgba(42,38,33,.12)" : modernist ? "rgba(91,77,130,.14)" : "rgba(255,255,255,.10)"}` }}
      style={{
        ...sans, width: "100%", minHeight: 48, padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "transparent", color: ivory ? ivBody : modernist ? mdBody : dkBody,
        border: `1px solid ${ivory ? ivBorder : modernist ? mdDivider : dkDivider}`, borderRadius: 14, fontSize: 15, fontWeight: 500, cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </motion.button>
    </Breathe>
  );
}

export function BackButton({ onClick, color = mdBody }: { onClick?: () => void; color?: string }) {
  return (
    <Breathe inline amount={1.06}>
    <motion.button
      type="button" aria-label="Go back" onClick={onClick}
      whileTap={{ opacity: 0.58 }}
      whileFocus={{ boxShadow: "0 0 0 3px rgba(91,77,130,.12)" }}
      style={{ ...sans, display: "inline-flex", alignItems: "center", gap: 5, minHeight: 36, margin: "-8px -10px", padding: "8px 10px", border: 0, borderRadius: shape.sm, background: "transparent", fontSize: 13, color, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
    >
      <ArrowLeft size={13} weight="bold" aria-hidden /> Back
    </motion.button>
    </Breathe>
  );
}

// ── Confidence bar — the one recurring data visualization: always a real
// 0-100 number backing an AI hypothesis, never decorative. ───────────────────
export function ConfidenceBar({ value, dark, modernist }: { value: number; dark?: boolean; modernist?: boolean }) {
  const labelColor = modernist ? mdBody : dark ? dkBody : subtle;
  const fillColor = modernist ? mdAccent : dark ? dkAccent : accent;
  const trackColor = modernist ? mdTrack : dark ? dkTrack : hair;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: labelColor, letterSpacing: "0.04em" }}>Confidence</span>
        <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: fillColor }}><AnimatedNumber value={value} />%</span>
      </div>
      <MeterFill value={value} color={fillColor} track={trackColor} height={5} radius={3} style={{ marginTop: 6 }} />
    </div>
  );
}

// A pacing/breather card between dense content — a lesson carried over from
// an earlier project: don't staple a bridging question onto the bottom of a
// content card. Give it its own quiet screen instead. No chart, no stat, no
// decoration competes with it; deliberately visual-free by design, not a
// placeholder for a chart that's missing.
// Only ever used by ScreenInvestigate below, which is fully Modernist —
// straight md* tokens, no dual-theme prop needed (see BeliefCard/etc. above
// for the pattern this would follow if a dark consumer ever showed up).
export function ScreenPivot({ kicker, statement, counter, cta }: { kicker?: string; statement: React.ReactNode; counter?: string; cta?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 24px 14px", minHeight: 0 }}>
        <div style={{ flex: 1.4 }} />
        <div>
          {kicker && (
            <div style={{ ...sans, fontSize: 13, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em", wordBreak: "keep-all" }}>{kicker}</div>
          )}
          <div style={{ ...display, fontSize: 28, color: mdHeading, lineHeight: 1.45, marginTop: kicker ? 14 : 0, wordBreak: "keep-all" }}>{statement}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div>
          {cta}
          {counter && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: cta ? 14 : 0 }}>
              <span style={{ ...mono, fontSize: 12, color: mdBody }}>{counter}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared "current vs. actual" row grammar — arrow-connected steps kept at
// identical geometry across rows so alignment itself teaches the comparison,
// a hairline divider instead of a bordered card per row. Only ever used by
// ScreenInvestigate, which is fully Modernist — straight md* tokens.
export function AlignedRowCompare({ rows }: { rows: { label: string; steps: string[]; accent?: boolean }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((row, ri) => (
        <div key={row.label} style={{ paddingTop: ri === 0 ? 0 : 16, paddingBottom: ri < rows.length - 1 ? 16 : 0, borderBottom: ri < rows.length - 1 ? `1px solid ${mdDivider}` : "none" }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 700, color: row.accent ? mdAccentText : mdBody, letterSpacing: "0.03em", marginBottom: 10 }}>{row.label}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {row.steps.map((step, i) => (
              <React.Fragment key={step}>
                <div style={{ ...sans, fontSize: 12, fontWeight: i % 2 === 1 ? 700 : 500, color: i % 2 === 1 ? (row.accent ? mdAccentText : mdHeading) : mdBody, textAlign: "center", lineHeight: 1.3, wordBreak: "keep-all" }}>{step}</div>
                {i < row.steps.length - 1 && (<div style={{ ...sans, fontSize: 12, color: row.accent ? mdAccentText : mdBody, flexShrink: 0, padding: "0 4px" }}>→</div>)}
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
