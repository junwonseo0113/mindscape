import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { CognitiveRegion } from "./neuralBrainLayout";
import { Store } from "./types";
import { haptic } from "./native";
import { appendMoodCheckIn } from "./realStore";
import { Breathe } from "./motionPrimitives";
import { hand, sans } from "./typefaces";
import { PenNib } from "@phosphor-icons/react";
import { ivSurfaceSolid, ivCardShadow, shape, ivHeading, ivBody } from "./screenTheme";

const QUICK_MOODS: { label: string; intensity: number }[] = [
  { label: "Calm", intensity: 35 },
  { label: "Happy", intensity: 65 },
  { label: "Anxious", intensity: 60 },
  { label: "Sad", intensity: 55 },
  { label: "Frustrated", intensity: 65 },
];

// ── Mood faces ───────────────────────────────────────────────────────────────
// Tapping a quick check-in answers with a small drawn face for that
// feeling, in its own color, popping up above the row for as long as
// "Logged: …" shows. Each face moves the way the feeling does: calm
// breathes slowly with closed eyes and a drifting leaf; happy bounces and
// throws sparkles; anxious jitters with a wavy mouth and a bead of sweat;
// sad droops while a tear falls; frustrated shakes under furrowed brows
// and puffs steam. Under reduced motion each face simply appears, still.
export type MoodKey = "Calm" | "Happy" | "Anxious" | "Sad" | "Frustrated";
export const MOOD_TONES: Record<MoodKey, CognitiveRegion> = {
  Calm: "security", Happy: "career", Anxious: "curiosity", Sad: "identity", Frustrated: "creativity",
};

function MoodFace({ mood, size = 72 }: { mood: MoodKey; size?: number }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const tone = REGION_CONFIG[MOOD_TONES[mood]];
  const ink = "#2E2547";
  const loop = (duration: number, extra: object = {}) => (reduce ? undefined : { duration, repeat: Infinity, ease: "easeInOut" as const, ...extra });
  // Whole-face motion per feeling.
  const body = reduce ? undefined : {
    Calm: { scale: [1, 1.05, 1] },
    Happy: { y: [0, -7, 0], rotate: [0, -4, 4, 0] },
    Anxious: { x: [0, -1.6, 1.6, -1.2, 1.2, 0] },
    Sad: { y: [0, 2.5, 0], rotate: [0, -2, 0] },
    Frustrated: { x: [0, -3, 3, -3, 3, 0], rotate: [0, -3, 3, -2, 2, 0] },
  }[mood];
  const bodyT = loop({ Calm: 3.2, Happy: 0.9, Anxious: 0.45, Sad: 2.6, Frustrated: 0.6 }[mood]);
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden style={{ overflow: "visible", display: "block" }}>
      <defs>
        <radialGradient id={`mf${id}`} cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="0.35" stopColor={tone.tint} />
          <stop offset="1" stopColor={tone.color} />
        </radialGradient>
      </defs>
      {/* Extras behind/around the face */}
      {mood === "Happy" && [0, 1, 2, 3, 4].map((i) => {
        const a = (-150 + i * 30) * (Math.PI / 180);
        return (
          <motion.path key={i} d="M0 -4 L1.2 -1.2 L4 0 L1.2 1.2 L0 4 L-1.2 1.2 L-4 0 L-1.2 -1.2 Z" fill={tone.color}
            initial={{ x: 40, y: 40, scale: 0, opacity: 0 }}
            animate={reduce ? { x: 40 + Math.cos(a) * 36, y: 40 + Math.sin(a) * 36, scale: 1, opacity: 1 } : { x: [40, 40 + Math.cos(a) * 38], y: [40, 40 + Math.sin(a) * 38], scale: [0, 1.4, 0.6], opacity: [0, 1, 0] }}
            transition={reduce ? undefined : { duration: 1.1, repeat: Infinity, repeatDelay: 0.3, delay: i * 0.08, ease: "easeOut" }} />
        );
      })}
      {mood === "Calm" && (
        <motion.path d="M0 0 C 4 -6, 12 -6, 14 0 C 10 4, 4 4, 0 0 Z" fill={REGION_CONFIG.security.color} opacity={0.85}
          initial={{ x: 62, y: 8 }} animate={reduce ? undefined : { x: [62, 70, 60, 68], y: [6, 14, 22, 30], rotate: [0, 25, -10, 30], opacity: [0, 1, 1, 0] }}
          transition={loop(3.6)} />
      )}
      {mood === "Frustrated" && [0, 1].map((i) => (
        <motion.circle key={i} r="5" fill="#B9B3C4"
          cx={i ? 64 : 16} cy={14}
          initial={{ cx: i ? 64 : 16, cy: 14, r: 3, opacity: 0 }}
          animate={reduce ? undefined : { cy: [14, 0], r: [3, 8], opacity: [0, 0.8, 0] }}
          transition={loop(1.1, { delay: i * 0.45, ease: "easeOut" })} />
      ))}

      <motion.g animate={body} transition={bodyT} style={{ transformBox: "view-box", transformOrigin: "40px 44px" }}>
        <circle cx="40" cy="42" r="28" fill={`url(#mf${id})`} />
        {/* Cheeks */}
        {(mood === "Happy" || mood === "Calm") && (
          <>
            <circle cx="25" cy="48" r="4.5" fill={REGION_CONFIG.relationships.color} opacity="0.45" />
            <circle cx="55" cy="48" r="4.5" fill={REGION_CONFIG.relationships.color} opacity="0.45" />
          </>
        )}
        {/* Eyes */}
        {mood === "Calm" && (
          <g fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round">
            <path d="M26 39 Q 30 43 34 39" /><path d="M46 39 Q 50 43 54 39" />
          </g>
        )}
        {mood === "Happy" && (
          <g fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round">
            <path d="M26 40 Q 30 34 34 40" /><path d="M46 40 Q 50 34 54 40" />
          </g>
        )}
        {(mood === "Anxious" || mood === "Sad") && (
          <motion.g animate={reduce || mood !== "Anxious" ? undefined : { scaleY: [1, 1, 0.15, 1] }} transition={loop(2.2, { times: [0, 0.85, 0.92, 1] })}
            style={{ transformBox: "view-box", transformOrigin: "40px 39px" }}>
            <circle cx="30" cy="39" r={mood === "Anxious" ? 3.6 : 3} fill={ink} />
            <circle cx="50" cy="39" r={mood === "Anxious" ? 3.6 : 3} fill={ink} />
            {mood === "Anxious" && (<><circle cx="31.2" cy="37.8" r="1.1" fill="#FFF" /><circle cx="51.2" cy="37.8" r="1.1" fill="#FFF" /></>)}
          </motion.g>
        )}
        {mood === "Frustrated" && (
          <g>
            <circle cx="30" cy="41" r="3" fill={ink} /><circle cx="50" cy="41" r="3" fill={ink} />
            <path d="M23 32 L35 36" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M57 32 L45 36" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
          </g>
        )}
        {mood === "Sad" && (
          <g fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round">
            <path d="M24 32 L34 30" /><path d="M56 32 L46 30" />
          </g>
        )}
        {mood === "Anxious" && (
          <g fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round">
            {/* Worried brows: they rise toward the middle. */}
            <path d="M24 33 Q 29 31 34 29" /><path d="M56 33 Q 51 31 46 29" />
          </g>
        )}
        {/* Mouth */}
        {mood === "Calm" && <path d="M33 52 Q 40 56 47 52" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />}
        {mood === "Happy" && <path d="M29 49 Q 40 62 51 49 Z" fill={ink} />}
        {mood === "Anxious" && (
          <motion.path d="M30 54 Q 33 50 36 54 Q 39 58 42 54 Q 45 50 48 54 Q 50 57 51 55" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
        )}
        {mood === "Sad" && <path d="M31 57 Q 40 49 49 57" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />}
        {mood === "Frustrated" && <path d="M31 55 L49 55" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />}
        {/* Sweat bead and tear */}
        {mood === "Anxious" && (
          <motion.path d="M60 26 C 57 31, 57 34, 60 35 C 63 34, 63 31, 60 26 Z" fill={REGION_CONFIG.curiosity.color}
            animate={reduce ? undefined : { y: [0, 6], opacity: [0, 1, 0] }} transition={loop(1.4, { ease: "easeIn" })} />
        )}
        {mood === "Sad" && (
          <motion.path d="M30 44 C 27 49, 27 52, 30 53 C 33 52, 33 49, 30 44 Z" fill={REGION_CONFIG.curiosity.color}
            animate={reduce ? undefined : { y: [0, 16], opacity: [0, 1, 1, 0] }} transition={loop(1.8, { ease: "easeIn" })} />
        )}
      </motion.g>
    </svg>
  );
}

export function QuickMoodCheckIn({ updateStore, onSayWhy }: { updateStore?: (updater: (prev: Store) => Store) => void; onSayWhy?: (mood: string) => void }) {
  const [justLogged, setJustLogged] = React.useState<string | null>(null);
  // The last feeling logged, kept a little longer than the face so "Say
  // why" stays around long enough to be read and tapped.
  const [askWhy, setAskWhy] = React.useState<string | null>(null);
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const askTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const logMood = (label: string, intensity: number) => {
    if (justLogged) return;
    updateStore?.((prev) => appendMoodCheckIn(prev, label, intensity));
    setJustLogged(label);
    setAskWhy(label);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (askTimerRef.current) clearTimeout(askTimerRef.current);
    clearTimerRef.current = setTimeout(() => setJustLogged(null), 2200);
    askTimerRef.current = setTimeout(() => setAskWhy(null), 9000);
  };
  React.useEffect(() => () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (askTimerRef.current) clearTimeout(askTimerRef.current);
  }, []);
  const tone = askWhy && askWhy in MOOD_TONES ? REGION_CONFIG[MOOD_TONES[askWhy as MoodKey]] : null;
  return (
    <div style={{ width: "100%", padding: "0 2px", position: "relative" }}>
      {/* The feeling you just logged, as a face that pops up above the row. */}
      <AnimatePresence>
        {justLogged && (justLogged in MOOD_TONES) && (
          <motion.div
            key={justLogged} role="img" aria-label={`${justLogged}`}
            initial={{ opacity: 0, scale: 0.4, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6, y: -10, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            style={{
              position: "absolute", right: 6, bottom: "100%", marginBottom: 2, zIndex: 4, pointerEvents: "none",
              display: "flex", alignItems: "center", gap: 6, padding: "6px 14px 6px 6px", borderRadius: 999,
              backgroundColor: "#FFFCF6", boxShadow: `0 12px 26px -14px ${REGION_CONFIG[MOOD_TONES[justLogged as MoodKey]].ink}, 0 0 0 1px rgba(42,38,33,0.06)`,
            }}
          >
            <MoodFace mood={justLogged as MoodKey} size={58} />
            <span style={{ ...hand, fontSize: 22, fontWeight: 600, color: REGION_CONFIG[MOOD_TONES[justLogged as MoodKey]].ink }}>{justLogged}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ ...hand, fontSize: 20, fontWeight: 600, color: ivBody, marginBottom: 4, height: 26, position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {/* The label swaps with a small lift so "Logged" reads as a
        response to the tap, not a flicker of text. */}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={askWhy ?? "idle"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {askWhy ? `Logged: ${askWhy}` : "How are you right now?"}
          </motion.span>
        </AnimatePresence>
        {/* A tap on its own only records the word. Writing a line about
        it is what lets the app see which thoughts come with which feeling. */}
        <AnimatePresence>
          {askWhy && onSayWhy && tone && (
            <motion.button
              key="why" type="button" onClick={() => onSayWhy(askWhy)}
              initial={{ opacity: 0, x: 10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.94 }} transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.35 }}
              style={{
                ...sans, fontSize: 12, fontWeight: 700, color: "#fff", border: 0, cursor: "pointer", flexShrink: 0,
                display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: shape.full,
                background: `linear-gradient(135deg, ${tone.color}, ${tone.ink})`, boxShadow: `0 6px 14px -8px ${tone.ink}`, WebkitTapHighlightColor: "transparent",
              }}
            >
              <PenNib size={12} weight="fill" /> Say why
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <div className="no-scrollbar" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
        {QUICK_MOODS.map((m) => {
          const chosen = justLogged === m.label;
          return (
            <Breathe key={m.label} inline amount={1.05} style={{ flexShrink: 0 }}>
            <motion.button
              type="button" aria-label={`Log mood: ${m.label}`} onClick={() => { haptic("tap"); logMood(m.label, m.intensity); }}
              whileTap={{ scale: 0.95, opacity: 0.82 }}
              // The chosen pill fills and gives one small pulse; the others
              // settle back without any motion of their own.
              animate={chosen ? { scale: [1, 1.08, 1], backgroundColor: ivHeading } : { scale: 1, backgroundColor: ivSurfaceSolid }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{ flexShrink: 0, border: 0, padding: "7px 12px", borderRadius: shape.full, cursor: "pointer", boxShadow: ivCardShadow, WebkitTapHighlightColor: "transparent" }}
            >
              <span style={{ ...sans, fontSize: 12, fontWeight: 700, color: chosen ? "#fff" : ivHeading, transition: "color 0.2s" }}>{m.label}</span>
            </motion.button>
            </Breathe>
          );
        })}
      </div>
    </div>
  );
}
