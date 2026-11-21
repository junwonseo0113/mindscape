import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { CognitiveRegion } from "./neuralBrainLayout";
import { haptic } from "./native";
import { Collapse, SETTLE } from "./motionPrimitives";
import { display, hand, sans } from "./typefaces";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { mdWarn, mdWarnSoft, ivSurfaceSolid, ivCardShadow, shape, ivHeading, ivBody, ivFaint, ivDivider } from "./screenTheme";
import { bezierSamples } from "./roadGeometry";
import { Emph } from "./insightText";
import { OpenFromContext } from "./screenUI";

// ── Settings list · Apple HIG "inset grouped" ────────────────────────────────
// The Profile hub and its sub-screens share one list grammar, the one iOS
// Settings uses: a rounded card per group, an optional header naming it,
// rows that keep to a single line, and the explanation that used to crowd
// each row moved to a footer under the group, where it reads once instead
// of in the middle of the list. Three HIG details carry the look:
//   · separators start at the label, not the card edge, so the icon
//     column reads as one strip;
//   · a pressed row tints its background instead of fading its text;
//   · a destructive action sits alone, centered, in its own group.
export function SettingsGroup({ header, footer, children, style }: { header?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  const items = React.Children.toArray(children);
  return (
    <section style={{ marginBottom: 22, ...style }}>
      {header && <div style={{ ...hand, fontSize: 21, fontWeight: 600, color: ivHeading, opacity: 0.82, padding: "0 14px 4px", lineHeight: 1.15, wordBreak: "keep-all" }}>{header}</div>}
      {/* A barely-there light falloff, top to bottom, so the card sits on
          the page like a sheet catching light instead of a flat cut-out. */}
      <div style={{ backgroundColor: ivSurfaceSolid, backgroundImage: "linear-gradient(180deg, #FDFBF7 0%, #FBF8F2 55%, #F9F5EE 100%)", borderRadius: shape.md, boxShadow: ivCardShadow, overflow: "hidden" }}>
        {items.map((child, i) =>
          // Only the first row drops its separator; anything that isn't a
          // SettingsRow (a Collapse around one, say) draws its own.
          i === 0 && React.isValidElement(child) && child.type === SettingsRow ? React.cloneElement(child as React.ReactElement<SettingsRowProps>, { divider: false }) : child,
        )}
      </div>
      {footer && <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.5, padding: "8px 16px 0", wordBreak: "keep-all" }}>{footer}</div>}
    </section>
  );
}

type SettingsRowProps = {
  icon?: React.ReactNode;
  // The row's colour: tints its icon tile and its arrow, and colours the
  // ripple when it's tapped. Defaults to identity's violet.
  accent?: CognitiveRegion;
  label: React.ReactNode;
  value?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  center?: boolean;
  chevron?: boolean;
  divider?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
};

// The 28px icon tile is iOS Settings' glyph-on-a-rounded-square, in this
// app's own palette: charcoal on a soft tint rather than white on a
// saturated color, so a column of them stays quiet.
export const settingsTile: React.CSSProperties = { width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

// The arrow on a row: a small gem of the row's colour with the caret in
// its ink. Tapping it sends the caret flying off to the right while a new
// one slides in behind it.
function RowArrow({ accent, fired }: { accent: CognitiveRegion; fired: number }) {
  const reduce = useReducedMotion();
  const c = REGION_CONFIG[accent];
  return (
    <motion.span aria-hidden
      whileHover={reduce ? undefined : { x: 2 }}
      style={{
        position: "relative", width: 26, height: 26, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
        display: "inline-flex", alignItems: "center", justifyContent: "center", color: c.ink,
        backgroundImage: `radial-gradient(circle at 30% 25%, #FFFFFF 0%, ${c.color}30 45%, ${c.color}55 100%)`,
        boxShadow: `inset 0 0 0 1px ${c.color}55, 0 4px 10px -5px ${c.color}`,
      }}>
      {fired > 0 && !reduce && (
        <motion.span key={`out${fired}`} initial={{ x: 0, opacity: 1 }} animate={{ x: 16, opacity: 0 }} transition={{ duration: 0.28, ease: "easeIn" }}
          style={{ position: "absolute", lineHeight: 0 }}>
          <CaretRight size={13} weight="bold" />
        </motion.span>
      )}
      <motion.span key={`in${fired}`} initial={fired > 0 && !reduce ? { x: -14, opacity: 0 } : false} animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.32, delay: 0.12, ease: [0.22, 1, 0.36, 1] }} style={{ lineHeight: 0, display: "block" }}>
        <CaretRight size={13} weight="bold" />
      </motion.span>
    </motion.span>
  );
}

export function SettingsRow({ icon, label, value, trailing, onClick, destructive, center, chevron, divider = true, disabled, style, accent }: SettingsRowProps) {
  const reduce = useReducedMotion();
  const openFrom = React.useContext(OpenFromContext);
  const rowRef = React.useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const [fired, setFired] = React.useState(0);
  const interactive = !!onClick && !disabled;
  const showChevron = chevron ?? (!!onClick && !trailing && !center);
  const color = destructive ? mdWarn : ivHeading;
  const inset = icon ? 16 + 28 + 12 : 16;
  const tone = REGION_CONFIG[accent ?? "identity"];
  const activate = (pt?: { x: number; y: number }) => {
    const el = rowRef.current;
    if (el && !reduce) {
      const r = el.getBoundingClientRect();
      const x = pt ? pt.x - r.left : r.width - 30, y = pt ? pt.y - r.top : r.height / 2;
      const id = Date.now() + Math.random();
      setRipples((rs) => [...rs.slice(-2), { id, x, y, size: Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) * 2 }]);
      setTimeout(() => setRipples((rs) => rs.filter((q) => q.id !== id)), 650);
    }
    if (showChevron) setFired((n) => n + 1);
    if (el && showChevron) openFrom?.(el);
    haptic("tap");
    onClick?.();
  };
  return (
    <motion.div
      ref={rowRef}
      role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} aria-disabled={disabled || undefined}
      onClick={interactive ? (e) => activate({ x: e.clientX, y: e.clientY }) : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } } : undefined}
      whileTap={interactive ? { backgroundColor: `${tone.color}14` } : undefined}
      transition={{ duration: 0.12 }}
      style={{
        position: "relative", display: "flex", alignItems: "center", justifyContent: center ? "center" : undefined, gap: 12, overflow: "hidden",
        minHeight: 46, padding: "10px 16px", cursor: interactive ? "pointer" : "default", backgroundColor: "rgba(42,38,33,0)",
        opacity: disabled ? 0.55 : 1, WebkitTapHighlightColor: "transparent", ...style,
      }}
    >
      {divider && <span aria-hidden style={{ position: "absolute", top: 0, left: inset, right: 0, height: 1, backgroundColor: ivDivider }} />}
      {ripples.map((q) => (
        <motion.span key={q.id} aria-hidden initial={{ scale: 0, opacity: 0.55 }} animate={{ scale: 1, opacity: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "absolute", left: q.x - q.size / 2, top: q.y - q.size / 2, width: q.size, height: q.size, borderRadius: "50%", pointerEvents: "none",
            backgroundImage: `radial-gradient(circle, ${tone.color}55 0%, ${tone.color}22 45%, transparent 70%)` }} />
      ))}
      {icon && <span style={{ ...settingsTile, position: "relative",
        ...(destructive ? { backgroundColor: mdWarnSoft, color } : accent
          ? { backgroundImage: `linear-gradient(135deg, ${tone.color}2e, ${tone.color}14)`, boxShadow: `inset 0 0 0 1px ${tone.color}33`, color: tone.ink }
          : { backgroundColor: "rgba(42,38,33,0.07)", color }) }}>{icon}</span>}
      <span style={{ ...sans, fontSize: 15, fontWeight: 500, color, flex: center ? undefined : 1, minWidth: 0, lineHeight: 1.3, wordBreak: "keep-all", position: "relative" }}>{label}</span>
      {value !== undefined && value !== null && <span style={{ ...sans, fontSize: 15, color: ivBody, flexShrink: 0, position: "relative" }}>{value}</span>}
      {trailing}
      {showChevron && <RowArrow accent={destructive ? "career" : accent ?? "identity"} fired={fired} />}
    </motion.div>
  );
}

// ── DiaryLinkCard ────────────────────────────────────────────────────────────
// A way into another page, drawn as a card pasted into the diary: paper
// washed in the page's colour, a strip of washi tape, a round sticker for
// the icon, the title with a line in hand saying what's inside, and the
// gem arrow. Opens its page by growing out of the card (OpenFromContext).
export function DiaryLinkCard({ icon, title, note, badge, accent, onClick, tilt = 0, plain, divider }: {
  icon: React.ReactNode; title: string; note?: string; badge?: string; accent: CognitiveRegion; onClick?: () => void; tilt?: number;
  // `plain`: a row inside a quietCard list rather than a card of its own.
  plain?: boolean; divider?: boolean;
}) {
  const reduce = useReducedMotion();
  const openFrom = React.useContext(OpenFromContext);
  const ref = React.useRef<HTMLDivElement>(null);
  const [fired, setFired] = React.useState(0);
  const [ripple, setRipple] = React.useState<{ id: number; x: number; y: number; size: number } | null>(null);
  const c = REGION_CONFIG[accent];
  const activate = (pt?: { x: number; y: number }) => {
    const el = ref.current;
    if (el && !reduce) {
      const r = el.getBoundingClientRect();
      const x = pt ? pt.x - r.left : r.width - 30, y = pt ? pt.y - r.top : r.height / 2;
      setRipple({ id: Date.now(), x, y, size: Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) * 2 });
    }
    setFired((n) => n + 1);
    if (el) openFrom?.(el);
    haptic("tap");
    onClick?.();
  };
  return (
    <motion.div
      ref={ref} role="button" tabIndex={0} aria-label={note ? `${title}. ${note}` : title}
      onClick={(e) => activate({ x: e.clientX, y: e.clientY })}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } }}
      initial={{ rotate: plain ? 0 : tilt }} whileHover={reduce || plain ? undefined : { y: -2, rotate: 0 }} whileTap={plain ? { backgroundColor: `${c.color}14` } : { scale: 0.98, rotate: 0 }} transition={SETTLE}
      style={plain ? {
        position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "14px 14px 14px 16px", cursor: "pointer",
        backgroundColor: "rgba(0,0,0,0)", WebkitTapHighlightColor: "transparent",
      } : {
        position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "16px 14px 16px 16px", borderRadius: 16, cursor: "pointer",
        backgroundColor: "#FFFCF6", backgroundImage: `radial-gradient(120% 100% at 0% 0%, ${c.color}30, transparent 55%), linear-gradient(160deg, ${c.color}14, #FFFCF6 70%)`,
        boxShadow: `0 0 0 1px ${c.color}33, 0 12px 24px -18px ${c.ink}`, WebkitTapHighlightColor: "transparent",
      }}
    >
      {divider && <span aria-hidden style={{ position: "absolute", top: 0, left: 66, right: 0, height: 1, backgroundColor: ivDivider }} />}
      {!plain && <span aria-hidden style={{ position: "absolute", top: -6, right: 34, width: 52, height: 15, transform: "rotate(4deg)", opacity: 0.8, pointerEvents: "none",
        backgroundImage: `repeating-linear-gradient(-45deg, ${c.color}99 0 5px, ${c.color}55 5px 10px)` }} />}
      <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: plain ? 0 : 16, overflow: "hidden", pointerEvents: "none" }}>
        {ripple && (
          <motion.span key={ripple.id} initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 1, opacity: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: "absolute", left: ripple.x - ripple.size / 2, top: ripple.y - ripple.size / 2, width: ripple.size, height: ripple.size, borderRadius: "50%",
              backgroundImage: `radial-gradient(circle, ${c.color}55 0%, ${c.color}22 45%, transparent 70%)` }} />
        )}
      </span>
      <span aria-hidden style={{
        position: "relative", width: plain ? 36 : 44, height: plain ? 36 : 44, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
        backgroundImage: `radial-gradient(circle at 32% 28%, ${c.color}, ${c.ink})`, boxShadow: plain ? `0 4px 12px -4px ${c.color}, 0 0 0 3px #FFFDF8, 0 0 0 4px ${c.color}44` : `0 6px 14px -6px ${c.ink}, 0 0 0 3px #FFFCF6, 0 0 0 4px ${c.color}55`,
      }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <span style={{ display: "block", ...display, fontSize: plain ? 18 : 19, color: ivHeading, lineHeight: 1.2, wordBreak: "keep-all" }}>{title}</span>
        {note && <span style={{ display: "block", ...hand, fontSize: plain ? 17 : 18, fontWeight: 500, color: c.ink, lineHeight: 1.15, marginTop: plain ? 3 : 4, wordBreak: "keep-all" }}>{note}</span>}
      </span>
      {badge && <span style={{ ...hand, fontSize: 19, fontWeight: 700, color: c.ink, flexShrink: 0, position: "relative" }}>{badge}</span>}
      <RowArrow accent={accent} fired={fired} />
    </motion.div>
  );
}

// Where an entry goes. A phone holding your entries, a green scan passing
// over them (the on-device crisis check, before anything leaves), and —
// only while AI analysis is on — an entry travelling out to Anthropic and
// an analysis travelling back. With cloud sync configured, a dashed line
// to your own encrypted account too.
export function DataPathIllustration({ aiOn, cloud, lang = "en" }: { aiOn: boolean; cloud?: boolean; lang?: "en" | "ko" }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const L = lang === "ko"
    ? { phone: "이 기기", ai: "Anthropic (미국)", off: "분석 꺼짐", cloud: "내 계정 · 암호화" }
    : { phone: "This phone", ai: "Anthropic (US)", off: "Analysis off", cloud: "Your account · encrypted" };
  const violet = REGION_CONFIG.identity;
  const green = REGION_CONFIG.security;
  const blue = REGION_CONFIG.curiosity;
  const out = bezierSamples([140, 96], [178, 66], [226, 66], [264, 96]);
  const back = { xs: [...out.xs].reverse(), ys: [...out.ys].reverse().map((y) => y + 10) };
  const loop = { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const };
  const label = [
    `Your entries stay on this phone${cloud ? " and, if you've signed up, in your own encrypted account" : ""}.`,
    "Each one is checked on the phone for signs of crisis before anything is sent.",
    aiOn ? "With AI analysis on, an entry goes to Anthropic in the US to be analyzed, and the analysis comes back." : "AI analysis is off, so nothing is sent to Anthropic.",
  ].join(" ");
  return (
    <svg role="img" aria-label={label} viewBox="0 0 360 184" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={blue.tint} /><stop offset="1" stopColor={violet.tint} /></linearGradient>
        <linearGradient id={`scan${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={green.color} stopOpacity="0" /><stop offset="0.5" stopColor={green.color} stopOpacity="0.38" /><stop offset="1" stopColor={green.color} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`ai${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.6" stopColor={violet.tint} /><stop offset="1" stopColor={violet.color} stopOpacity="0.25" /></radialGradient>
        <clipPath id={`screen${id}`}><rect x="52" y="34" width="76" height="116" rx="10" /></clipPath>
      </defs>
      <rect width="360" height="184" rx="16" fill={`url(#bg${id})`} />

      {/* The phone and the entries it holds. */}
      <rect x="44" y="22" width="92" height="140" rx="16" fill="#FFFFFF" stroke="#2A2621" strokeOpacity="0.14" />
      <rect x="52" y="34" width="76" height="116" rx="10" fill="#FBF8F2" />
      {[violet, green, blue].map((tone, i) => (
        <motion.g key={i} animate={reduce ? undefined : { y: [0, -2, 0] }} transition={reduce ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}>
          <rect x="60" y={46 + i * 30} width="60" height="20" rx="6" fill={tone.tint} />
          <rect x="66" y={52 + i * 30} width="30" height="3" rx="1.5" fill={tone.ink} opacity="0.55" />
          <rect x="66" y={59 + i * 30} width="44" height="3" rx="1.5" fill={tone.ink} opacity="0.3" />
        </motion.g>
      ))}
      {/* The on-device check: a band of green light passing over them. */}
      <g clipPath={`url(#screen${id})`}>
        <motion.rect x="52" width="76" height="28" fill={`url(#scan${id})`}
          initial={{ y: 20 }} animate={reduce ? { y: 60 } : { y: [20, 150] }}
          transition={reduce ? undefined : { duration: 3.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }} />
      </g>
      {/* Lock: it stays here. */}
      <g transform="translate(128 26)">
        <circle r="10" fill="#2A2621" />
        <rect x="-4.5" y="-1" width="9" height="7" rx="1.5" fill="#FFFFFF" />
        <path d="M-2.6 -1 V-3.4 A2.6 2.6 0 0 1 2.6 -3.4 V-1" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
      </g>
      <text x="90" y="178" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621">{L.phone}</text>

      {cloud && (
        <g>
          <path d="M136 46 C 160 26, 178 22, 196 28" fill="none" stroke={blue.ink} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="3 4" />
          <path d="M198 36 a10 10 0 0 1 8 -14 a13 13 0 0 1 24 2 a9 9 0 0 1 4 17 h-32 a8 8 0 0 1 -4 -5 z" fill="#FFFFFF" stroke={blue.ink} strokeOpacity="0.35" />
          <text x="218" y="56" textAnchor="middle" fontSize="9.5" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill={blue.ink}>{L.cloud}</text>
        </g>
      )}

      {/* The way to Anthropic — travelled only while analysis is on. */}
      <motion.path d="M140 96 C 178 66, 226 66, 264 96" fill="none" stroke={violet.ink} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="4 6"
        strokeOpacity={aiOn ? 0.55 : 0.18}
        animate={aiOn && !reduce ? { strokeDashoffset: [0, -20] } : undefined} transition={aiOn && !reduce ? { duration: 1.2, repeat: Infinity, ease: "linear" } : undefined} />
      {aiOn && !reduce && (
        <>
          <motion.circle r="4.5" fill={violet.color} cx={out.xs[0]} cy={out.ys[0]} initial={{ cx: out.xs[0], cy: out.ys[0], opacity: 0 }} animate={{ cx: out.xs, cy: out.ys, opacity: [0, 1, 1, 1, 0] }} transition={{ ...loop, repeatDelay: 1.2 }} />
          <motion.circle r="4.5" fill={green.color} cx={back.xs[0]} cy={back.ys[0]} initial={{ cx: back.xs[0], cy: back.ys[0], opacity: 0 }} animate={{ cx: back.xs, cy: back.ys, opacity: [0, 1, 1, 1, 0] }} transition={{ ...loop, delay: 2.2, repeatDelay: 1.2 }} />
        </>
      )}
      <g opacity={aiOn ? 1 : 0.4}>
        <motion.circle cx="292" cy="96" r="26" fill={`url(#ai${id})`}
          animate={aiOn && !reduce ? { scale: [1, 1.06, 1] } : undefined} transition={aiOn && !reduce ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : undefined}
          style={{ transformOrigin: "292px 96px" }} />
        <path d="M292 82 L295.5 92.5 L306 96 L295.5 99.5 L292 110 L288.5 99.5 L278 96 L288.5 92.5 Z" fill={violet.ink} />
      </g>
      <text x="292" y="138" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621" opacity={aiOn ? 1 : 0.55}>{L.ai}</text>
      {!aiOn && <text x="292" y="153" textAnchor="middle" fontSize="10" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621" opacity="0.55">{L.off}</text>}
    </svg>
  );
}

// A caption row under an illustration: a tinted dot that matches the part
// of the drawing it describes, and one short line.
export function IllustrationKey({ items }: { items: { tone: string; text: React.ReactNode }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: it.tone, marginTop: 5, flexShrink: 0 }} />
          <span style={{ ...sans, fontSize: 13, color: ivHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>{it.text}</span>
        </div>
      ))}
    </div>
  );
}

// A belief and the interpretations it produces, as a plant: the belief is
// a glowing seed below the soil with roots running out to a second belief
// (beliefs prop each other up), and above ground three shoots rise in turn
// — each one a moment the belief showed up.
export function BeliefRootsIllustration() {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const violet = REGION_CONFIG.identity;
  const gold = REGION_CONFIG.career;
  const green = REGION_CONFIG.security;
  const grow = (i: number) => (reduce ? undefined : { duration: 4.5, repeat: Infinity, ease: "easeInOut" as const, delay: i * 0.9, times: [0, 0.35, 0.8, 1] });
  return (
    <svg role="img" aria-label="A belief sits underneath, out of sight, with roots joining it to another belief. Above the surface, three shoots rise one after another: each is an interpretation, a moment the belief shows up." viewBox="0 0 360 170" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`air${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FBF7EF" /><stop offset="1" stopColor={green.tint} /></linearGradient>
        <linearGradient id={`soil${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E3D3BC" /><stop offset="1" stopColor="#CDB797" /></linearGradient>
        <radialGradient id={`seed${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.35" stopColor={violet.color} /><stop offset="1" stopColor={violet.color} stopOpacity="0" /></radialGradient>
        <radialGradient id={`seed2${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.35" stopColor={gold.color} /><stop offset="1" stopColor={gold.color} stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="360" height="170" rx="16" fill={`url(#air${id})`} />
      <path d="M0 92 C 90 86, 260 98, 360 90 L360 154 A16 16 0 0 1 344 170 L16 170 A16 16 0 0 1 0 154 Z" fill={`url(#soil${id})`} />

      {/* Roots: the belief's reach, and the root it shares with another. */}
      <motion.path d="M150 128 C 175 136, 205 140, 236 132" fill="none" stroke="#8A6A4A" strokeWidth="2" strokeLinecap="round"
        strokeDasharray="120" initial={{ strokeDashoffset: 120 }} animate={{ strokeDashoffset: 0 }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }} />
      {["M150 128 C 140 142, 120 148, 104 152", "M150 128 C 154 144, 150 152, 142 160", "M236 132 C 250 146, 266 150, 280 154"].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#8A6A4A" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
      ))}
      <motion.circle cx="150" cy="128" r="16" fill={`url(#seed${id})`} animate={reduce ? undefined : { scale: [1, 1.12, 1] }} transition={reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "150px 128px" }} />
      <motion.circle cx="236" cy="132" r="12" fill={`url(#seed2${id})`} animate={reduce ? undefined : { scale: [1, 1.1, 1] }} transition={reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 1.2 }} style={{ transformOrigin: "236px 132px" }} />

      {/* Shoots: the moments it shows up, rising one after another. */}
      {[{ x: 96, h: 40 }, { x: 150, h: 54 }, { x: 206, h: 36 }].map((s, i) => (
        <motion.g key={i} style={{ transformOrigin: `${s.x}px 92px` }}
          initial={{ scaleY: reduce ? 1 : 0.2 }} animate={reduce ? { scaleY: 1 } : { scaleY: [0.2, 1, 1, 0.2] }} transition={grow(i)}>
          <path d={`M${s.x} 92 C ${s.x - 2} ${92 - s.h * 0.5}, ${s.x + 3} ${92 - s.h * 0.8}, ${s.x} ${92 - s.h}`} fill="none" stroke={green.ink} strokeWidth="2" strokeLinecap="round" />
          <path d={`M${s.x} ${92 - s.h * 0.6} c 7 -8, 15 -7, 18 -3 c -6 6, -12 7, -18 3 z`} fill={green.color} />
          <path d={`M${s.x} ${92 - s.h * 0.85} c -7 -7, -14 -6, -16 -2 c 6 5, 11 6, 16 2 z`} fill={green.color} opacity="0.85" />
          <circle cx={s.x} cy={92 - s.h} r="3.5" fill={gold.color} />
        </motion.g>
      ))}
      {/* Tie the middle shoot visibly to the seed below it. */}
      <path d="M150 92 L150 116" stroke="#8A6A4A" strokeWidth="1.6" strokeDasharray="2 3" strokeOpacity="0.6" />

      <text x="292" y="38" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill={green.ink}>Interpretations</text>
      <text x="292" y="52" textAnchor="middle" fontSize="10" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621" opacity="0.65">the moments it shows</text>
      <text x="300" y="112" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill={violet.ink}>Beliefs</text>
      <text x="300" y="126" textAnchor="middle" fontSize="10" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621" opacity="0.65">running underneath</text>
    </svg>
  );
}

// ── DisclosureRow ────────────────────────────────────────────────────────────
// A row inside a SettingsGroup that unfolds its body in place: the title
// (and an optional one-line subtitle) stays put, the caret turns, and the
// body measures itself open. Used for Help's questions and for History's
// "how you've changed" modules — anything that should cost one line of a
// list until someone asks for it.
export function DisclosureRow({ title, subtitle, icon, open, onToggle, first, titleStyle, children }: { title: string; subtitle?: string; icon?: React.ReactNode; open: boolean; onToggle: () => void; first: boolean; titleStyle?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      {!first && <span aria-hidden style={{ position: "absolute", top: 0, left: icon ? 16 + 28 + 12 : 16, right: 0, height: 1, backgroundColor: ivDivider }} />}
      <motion.button
        type="button" aria-expanded={open} onClick={onToggle}
        whileTap={{ backgroundColor: "rgba(42,38,33,0.07)" }} transition={{ duration: 0.12 }}
        style={{ width: "100%", border: 0, background: "rgba(42,38,33,0)", display: "flex", alignItems: icon ? "flex-start" : "center", gap: 12, padding: "13px 16px", textAlign: "left", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
      >
        {icon && <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...sans, fontSize: 15, fontWeight: 500, color: ivHeading, lineHeight: 1.4, display: "block", wordBreak: "keep-all", ...titleStyle }}>{title}</span>
          {subtitle && <span style={{ ...hand, fontSize: 19, fontWeight: 500, color: ivBody, lineHeight: 1.2, display: "block", marginTop: 2, wordBreak: "keep-all" }}><Emph text={subtitle} /></span>}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SETTLE} style={{ display: "flex", flexShrink: 0, marginTop: icon ? 4 : 0 }}>
          <CaretDown size={14} color={ivFaint} weight="bold" />
        </motion.span>
      </motion.button>
      <Collapse open={open}>
        <div style={{ padding: "2px 16px 18px" }}>{children}</div>
      </Collapse>
    </div>
  );
}
