import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { Store } from "./types";
import { relativeDayLabel } from "./dateUtils";
import { closenessAt, entryStep, pathSeries, weekChange } from "./aspirationPath";
import { PathChart, PathLegend, VoyageCard } from "./Voyage";
import { isMoodCheckIn } from "./realStore";
import { Breathe } from "./motionPrimitives";
import { display, hand, mono, sans } from "./typefaces";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, ArrowsClockwise, Footprints } from "@phosphor-icons/react";
import { type RoadPoint } from "./roadGeometry";
import { ivBackground, shape, ivHeading, ivBody, ivFaint, ivDivider } from "./screenTheme";
import { PRIMARY_HEADER_TOP, PRIMARY_HEADER_SIDE, PrimaryBtn, BackButton } from "./screenUI";
import { SettingsGroup, SettingsRow } from "./settingsUI";
import { Emph, B, quietCard, SectionHeading } from "./insightText";
import { voyageAnchor } from "./entryTiming";
import { SEAL_MS, FutureSelfLetter } from "./diaryPaper";
import { OpeningBackdrop } from "./OpeningScreens";
import { JourneyCharacter } from "./journeyShared";

// Control points chosen so the lane's edges never fold over at its tightest
// bend: the curve's radius stays above the road's half-width all the way
// (checked numerically, ≥ 1.6× at the worst point).
const ROAD = { p0: [170, 240] as RoadPoint, p1: [100, 150] as RoadPoint, p2: [320, 104] as RoadPoint, p3: [252, 76] as RoadPoint };
function roadAt(t: number): RoadPoint {
  const { p0, p1, p2, p3 } = ROAD;
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}
function roadTangent(t: number): RoadPoint {
  const { p0, p1, p2, p3 } = ROAD;
  const u = 1 - t;
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}
// Perspective: the lane is wide in front and narrows to a thread at the flag.
const roadWidth = (t: number) => 66 * Math.pow(1 - t, 1.35) + 4;
const ROAD_SHAPE = (() => {
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const [x, y] = roadAt(t);
    const [dx, dy] = roadTangent(t);
    const w = roadWidth(t) / 2;
    left.push(`${(x - dy * w).toFixed(1)} ${(y + dx * w).toFixed(1)}`);
    right.unshift(`${(x + dy * w).toFixed(1)} ${(y - dx * w).toFixed(1)}`);
  }
  return `M${left.join(" L")} L${right.join(" L")} Z`;
})();
const ROAD_CENTER = `M${ROAD.p0.join(" ")} C${ROAD.p1.join(" ")} ${ROAD.p2.join(" ")} ${ROAD.p3.join(" ")}`;

// Three skies so a page of roads isn't one picture repeated: dawn, day, dusk.
const ROAD_SKIES = [
  { top: "#FDE6D3", mid: "#F6D9E8", horizon: "#E7E0FA", sun: "#FFC98A" },
  { top: "#D7ECFB", mid: "#E4F2F6", horizon: "#F3F1E2", sun: "#FFE29A" },
  { top: "#E9D9F7", mid: "#F7D7DF", horizon: "#FCE5CF", sun: "#FFB48A" },
];

function GoalRoad({ progress, milestones = [], variant = 0, label }: { progress: number; milestones?: number[]; variant?: number; label: string }) {
  const reduce = useReducedMotion();
  const target = Math.max(0.02, Math.min(0.97, progress));
  const [t, setT] = React.useState(reduce ? target : 0);
  const id = React.useId().replace(/:/g, "");
  const sky = ROAD_SKIES[variant % ROAD_SKIES.length];
  // Walk out to the spot: ease-out over 1.6s, starting once on mount and
  // again only if the value itself changes.
  React.useEffect(() => {
    if (reduce) { setT(target); return; }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1600);
      const e = 1 - Math.pow(1 - k, 3);
      setT(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);
  const [wx, wy] = roadAt(t);
  const scale = 1.15 - 0.7 * t; // nearer is bigger
  const walked = Array.from({ length: 33 }, (_, i) => roadAt((t * i) / 32)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const loop = (duration: number) => (reduce ? undefined : { duration, repeat: Infinity, ease: "linear" as const });
  return (
    <svg role="img" aria-label={label} viewBox="0 0 360 220" style={{ width: "100%", height: "auto", display: "block", borderRadius: shape.md }}>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.top} /><stop offset="0.55" stopColor={sky.mid} /><stop offset="1" stopColor={sky.horizon} />
        </linearGradient>
        <radialGradient id={`sun${id}`}>
          <stop offset="0" stopColor={sky.sun} stopOpacity="0.95" /><stop offset="0.45" stopColor={sky.sun} stopOpacity="0.45" /><stop offset="1" stopColor={sky.sun} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`farHill${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#CDE7D6" /><stop offset="1" stopColor="#B7DCC6" /></linearGradient>
        <linearGradient id={`midHill${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A9DABB" /><stop offset="1" stopColor="#8FCCA6" /></linearGradient>
        <linearGradient id={`nearHill${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#86C79C" /><stop offset="1" stopColor="#6DB98A" /></linearGradient>
        <linearGradient id={`road${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#EADFCC" /><stop offset="1" stopColor="#D8CBB4" /></linearGradient>
        <linearGradient id={`walked${id}`} gradientUnits="userSpaceOnUse" x1="170" y1="240" x2="252" y2="76">
          <stop offset="0" stopColor="#8B7CFF" /><stop offset="0.5" stopColor="#E88AAE" /><stop offset="1" stopColor="#F4A261" />
        </linearGradient>
        <radialGradient id={`orb${id}`}>
          <stop offset="0" stopColor="#FFFFFF" /><stop offset="0.25" stopColor="#B9AEFF" /><stop offset="0.6" stopColor="#8B7CFF" stopOpacity="0.55" /><stop offset="1" stopColor="#8B7CFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="360" height="220" fill={`url(#sky${id})`} />
      <motion.circle cx="262" cy="60" r="30" fill={`url(#sun${id})`}
        animate={reduce ? undefined : { scale: [1, 1.12, 1] }} transition={reduce ? undefined : { duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "262px 60px" }} />
      {/* Clouds drift across, two speeds. */}
      <motion.g animate={reduce ? undefined : { x: [-90, 420] }} transition={loop(46)} opacity={0.85}>
        <ellipse cx="40" cy="34" rx="26" ry="8" fill="#FFFFFF" /><ellipse cx="58" cy="29" rx="16" ry="8" fill="#FFFFFF" />
      </motion.g>
      <motion.g animate={reduce ? undefined : { x: [-200, 380] }} transition={loop(64)} opacity={0.7}>
        <ellipse cx="120" cy="52" rx="20" ry="6" fill="#FFFFFF" /><ellipse cx="133" cy="48" rx="12" ry="6" fill="#FFFFFF" />
      </motion.g>

      <path d="M0 96 C 60 72, 130 86, 190 78 S 300 62, 360 84 L360 220 L0 220 Z" fill={`url(#farHill${id})`} />
      <path d="M0 132 C 80 108, 150 130, 222 114 S 330 98, 360 110 L360 220 L0 220 Z" fill={`url(#midHill${id})`} />
      <path d="M0 170 C 90 152, 200 176, 360 152 L360 220 L0 220 Z" fill={`url(#nearHill${id})`} />

      <path d={ROAD_SHAPE} fill={`url(#road${id})`} />
      {/* The lane's center dashes roll toward the flag. */}
      <motion.path d={ROAD_CENTER} fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="2" strokeLinecap="round" strokeDasharray="7 10"
        animate={reduce ? undefined : { strokeDashoffset: [0, -34] }} transition={loop(1.8)} />
      {/* The stretch already walked. */}
      <polyline points={walked} fill="none" stroke={`url(#walked${id})`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />

      {milestones.map((m, i) => {
        const [x, y] = roadAt(m);
        const s = 1.1 - 0.6 * m;
        return (
          <g key={i} transform={`translate(${x + roadWidth(m) / 2 + 3} ${y}) scale(${s})`} opacity={m <= t ? 1 : 0.45}>
            <line x1="0" y1="0" x2="0" y2="-12" stroke="#8A6A4A" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="0" cy="-13" r="3" fill={m <= t ? "#F4A261" : "#E8DCCB"} />
          </g>
        );
      })}

      {/* The goal: a pennant on the far hill. */}
      <g>
        <line x1="252" y1="77" x2="252" y2="47" stroke="#6B4E37" strokeWidth="1.8" strokeLinecap="round" />
        {/* Flutter as a transform pinned at the pole (scale + skew), not
            path morphing — motion hands an SVG `d` keyframe `undefined`
            for a frame, which the browser rejects. */}
        <motion.path fill="#EF6F5E"
          d="M252 47 L271 52 L252 58 Z"
          animate={reduce ? undefined : { scaleX: [1, 0.84, 1], skewY: [0, 5, 0] }}
          transition={reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformBox: "fill-box", transformOrigin: "0% 50%" }} />
      </g>

      {/* You: the app's own orb of light, standing on the road. */}
      <g transform={`translate(${wx.toFixed(1)} ${wy.toFixed(1)}) scale(${scale.toFixed(3)})`}>
        <motion.g animate={reduce ? undefined : { y: [0, -2.5, 0] }} transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
          <circle r="20" fill={`url(#orb${id})`} />
          <circle r="6.5" fill="#8B7CFF" />
          <circle r="2.6" cx="-1.4" cy="-1.6" fill="#FFFFFF" opacity="0.9" />
          <g transform="translate(0 -26)">
            <rect x="-15" y="-9" width="30" height="16" rx="8" fill="#FFFFFF" opacity="0.92" />
            <text x="0" y="3" textAnchor="middle" fontSize="10" fontWeight="600" fontFamily="'Pretendard Variable', Pretendard, sans-serif" fill="#2A2621">You</text>
          </g>
        </motion.g>
      </g>
    </svg>
  );
}

export function ScreenDrift({ onBack, store, onSetupAspiration }: { onBack?: () => void; store: Store; onSetupAspiration?: () => void }) {
  const hasAspiration = !!store.aspiration;
  const examples = store.aspirationExamples ?? [];
  const divider = <span aria-hidden style={{ position: "absolute", top: 0, left: 16, right: 0, height: 1, backgroundColor: ivDivider }} />;
  return (
    // Same full-bleed ivory canvas and grouped-card page as Unconscious
    // Patterns: what you said, then where you stand, each a card with its
    // explanation as the footer.
    <div style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...ivBackground }}>
      <div className="no-scrollbar edge-fade" style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0, overflowY: "auto", padding: `${PRIMARY_HEADER_TOP}px 16px calc(24px + env(safe-area-inset-bottom))`, boxSizing: "border-box" }}>
        <div style={{ padding: "0 6px" }}>
          <BackButton onClick={onBack} color={ivBody} />
          <div style={{ ...display, fontSize: 28, fontWeight: 400, lineHeight: 1.15, color: ivHeading, marginTop: 14 }}>How close you are to who you want to be</div>
          <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
            Who you said you want to be, next to what you've actually been doing.
          </div>
        </div>
        {hasAspiration ? (
          <>
            <SettingsGroup header="What you said" style={{ marginTop: 24 }} footer={store.aspirationSetDate ? `Set on ${store.aspirationSetDate}.` : undefined}>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ ...display, fontSize: 20, fontStyle: "italic", color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all" }}>"{store.aspiration}"</div>
              </div>
              <SettingsRow icon={<ArrowsClockwise size={17} />} label="Set it again" onClick={onSetupAspiration} />
            </SettingsGroup>
            {/* Where you are now, and the steps that got you here. */}
            <section style={{ marginTop: 26 }}>
              <SectionHeading>Where you are</SectionHeading>
              <VoyageCard closeness={closenessAt(store.history)} change={weekChange(store.history, voyageAnchor(store.history))} aspiration={store.aspiration} />
            </section>
            <section style={{ marginTop: 26 }}>
              <SectionHeading>The last two weeks</SectionHeading>
              <div style={{ ...quietCard, padding: "16px 14px 12px" }}>
                <PathChart days={pathSeries(store.history, 14, voyageAnchor(store.history))} />
                <div style={{ marginTop: 8 }}><PathLegend /></div>
              </div>
            </section>
            {(() => {
              const steps = store.history.filter((e) => !isMoodCheckIn(e)).map((e) => ({ e, st: entryStep(e) })).filter(({ st }) => st.dir !== 0)
                .sort((x, y) => (x.e.date < y.e.date ? 1 : x.e.date > y.e.date ? -1 : 0)).slice(0, 8);
              if (steps.length === 0) return null;
              return (
                <section style={{ marginTop: 26 }}>
                  <SectionHeading>Recent steps</SectionHeading>
                  <div style={quietCard}>
                    {steps.map(({ e, st }, i) => {
                      const tone = st.dir > 0 ? REGION_CONFIG.security : REGION_CONFIG.relationships;
                      return (
                        <div key={e.id} style={{ position: "relative", display: "flex", gap: 12, padding: "13px 16px" }}>
                          {i > 0 && divider}
                          <span aria-label={st.dir > 0 ? "toward" : "away"} style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", backgroundColor: tone.color, marginTop: 2 }}>
                            {st.dir > 0 ? <ArrowUpRight size={14} weight="bold" /> : <ArrowDownRight size={14} weight="bold" />}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ ...hand, fontSize: 17, fontWeight: 600, color: tone.ink }}>{st.dir > 0 ? "Toward" : "Away"} · {relativeDayLabel(e.date)}</div>
                            <div style={{ ...sans, fontSize: 14, color: ivHeading, marginTop: 2, lineHeight: 1.5, wordBreak: "keep-all" }}><Emph text={st.note ?? e.text} /></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })()}
            {store.driftNotes.length > 0 && (
              <SettingsGroup header="Notes along the way" style={{ marginTop: 26 }}>
                {[...store.driftNotes].reverse().map((d, i) => (
                  <div key={i} style={{ position: "relative", padding: "13px 16px" }}>
                    {i > 0 && divider}
                    <div style={{ ...mono, fontSize: 11, color: ivFaint }}>{d.date}</div>
                    <div style={{ ...sans, fontSize: 15, color: ivHeading, marginTop: 4, lineHeight: 1.55, wordBreak: "keep-all" }}><Emph text={d.note} /></div>
                  </div>
                ))}
              </SettingsGroup>
            )}
          </>
        ) : (
          <>
            <SettingsGroup style={{ marginTop: 24 }} footer={<><B>One sentence</B> is enough. We'll show the <B>gap</B> between it and what you write.</>}>
              <SettingsRow icon={<Footprints size={17} />} label="Tell us who you want to become" onClick={onSetupAspiration} />
            </SettingsGroup>
            {examples.length > 0 && (
              <SettingsGroup header="What it could look like" footer="Examples, until you write your own.">
                {examples.map((a, i) => {
                  const gap = Math.abs(a.target - a.actual);
                  return (
                    <div key={a.said} style={{ position: "relative", padding: "14px 16px" }}>
                      {i > 0 && divider}
                      <div style={{ ...mono, fontSize: 11, color: ivFaint }}>{a.saidDate}</div>
                      <div style={{ ...display, fontSize: 20, fontStyle: "italic", color: ivHeading, marginTop: 4, lineHeight: 1.45, wordBreak: "keep-all" }}>"{a.said}"</div>
                      {/* How close: 100 minus the gap, so a goal of "less
                          often" (target 0) walks the same road as one of
                          "more often" (target 100). */}
                      <div style={{ marginTop: 12 }}>
                        <GoalRoad
                          progress={(100 - gap) / 100} variant={i}
                          label={`${a.label}: you're ${100 - gap}% of the way to the goal, ${gap} points to go.`}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
                        <span style={{ ...sans, fontSize: 13, color: ivBody, wordBreak: "keep-all" }}>{a.label}</span>
                        <span style={{ ...sans, fontSize: 13, fontWeight: 600, color: ivHeading, flexShrink: 0 }}>{gap} to go</span>
                      </div>
                      <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 3 }}>
                        Now {a.actual} out of 100 · aiming for {a.target}
                      </div>
                      <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 10, lineHeight: 1.55, wordBreak: "keep-all" }}><Emph text={a.note} /></div>
                    </div>
                  );
                })}
              </SettingsGroup>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Screen 10.5 · Aspiration setup ────────────────────────────────────────────
export function ScreenAspirationSetup({ initialValue, onBack, onSave }: { initialValue?: string | null; onBack?: () => void; onSave?: (value: string) => void }) {
  const [value, setValue] = React.useState(initialValue ?? "");
  const [sealing, setSealing] = React.useState(false);
  const save = () => {
    const v = value.trim();
    if (!v || sealing) return;
    setSealing(true);
    setTimeout(() => onSave?.(v), SEAL_MS);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", ...ivBackground, position: "relative", overflow: "hidden" }}>
      <OpeningBackdrop variant="aspire" />
      <div style={{ padding: "16px 22px 12px", flexShrink: 0, position: "relative", zIndex: 1 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 30, color: ivHeading, marginTop: 10, lineHeight: 1.2, wordBreak: "keep-all" }}>Who do you want to become?</div>
        <div style={{ ...hand, fontSize: 19, color: ivBody, marginTop: 8, lineHeight: 1.3, wordBreak: "keep-all" }}>
          We'll keep comparing it with the thoughts you write here.
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: "18px 22px 18px", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        <FutureSelfLetter autoFocus value={value} onChange={setValue} sealed={sealing} />
      </div>
      <div style={{ padding: "0 22px max(32px, calc(12px + env(safe-area-inset-bottom)))", flexShrink: 0, position: "relative", zIndex: 1 }}>
        <PrimaryBtn ivory tone="security" disabled={!value.trim()} onClick={save}>{initialValue ? "Seal the new version" : "Seal it"}</PrimaryBtn>
      </div>
    </div>
  );
}

// One stop on the path — the dot plus the line segment reaching down to
// whatever comes after it, so each node owns its own connector instead of
// one shared line needing to line up with variable-height text next to it.
function JourneyNode({ dot, dotFilled, connector = "solid", last, children }: { dot?: React.ReactNode; dotFilled: boolean; connector?: "solid" | "dashed"; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 22, flexShrink: 0 }}>
        {dot ?? (
          <div style={{
            width: 11, height: 11, borderRadius: "50%", flexShrink: 0,
            backgroundColor: dotFilled ? ivHeading : ivBackground.backgroundColor,
            border: `2px solid ${ivHeading}`, boxSizing: "border-box",
          }} />
        )}
        {!last && (
          <div style={{
            flex: 1, width: 2, minHeight: 30, marginTop: 4,
            backgroundColor: connector === "solid" ? ivHeading : "transparent",
            backgroundImage: connector === "dashed" ? `repeating-linear-gradient(to bottom, rgba(42,38,33,0.3) 0 4px, transparent 4px 9px)` : undefined,
          }} />
        )}
      </div>
      <div style={{ flex: 1, paddingBottom: 28, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// Identity Drift reframed as a map instead of a list: the same aspiration/
// driftNotes data ScreenDrift already reads (see above), just walked top
// to bottom as waypoints with the character standing at the most recent
// one — "where you started," what's been noticed since, and the stated
// goal still further down the path. Deliberately doesn't invent a 0-100
// score driftNotes was never designed to produce (see ScreenDrift's own
// comment on that) — distance is shown as how far down the path you've
// actually walked, not a fabricated percentage.
export function ScreenJourneyMap({ onBack, store, onSetupAspiration }: { onBack?: () => void; store: Store; onSetupAspiration?: () => void }) {
  const hasAspiration = !!store.aspiration;
  const notes = store.driftNotes;

  return (
    <div style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...ivBackground }}>
      <div className="no-scrollbar edge-fade" style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0, overflowY: "auto", padding: `${PRIMARY_HEADER_TOP}px ${PRIMARY_HEADER_SIDE}px calc(40px + env(safe-area-inset-bottom))`, boxSizing: "border-box" }}>
        <Breathe inline amount={1.06}><span
          role="button" tabIndex={0} aria-label="Back to Profile" onClick={onBack}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBack?.(); } }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, ...sans, fontSize: 13, fontWeight: 700, color: ivBody, cursor: "pointer" }}
        >
          <ArrowLeft size={13} weight="bold" aria-hidden /> Back
        </span></Breathe>
        <div style={{ ...display, fontSize: 28, fontWeight: 400, lineHeight: 1.15, color: ivHeading, marginTop: 14 }}>Your Journey</div>
        <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 6, lineHeight: 1.4, wordBreak: "keep-all" }}>
          Where you started, what's changed since, and how far the goal still is.
        </div>

        <div style={{ marginTop: 32 }}>
          {hasAspiration ? (
            <>
              <JourneyNode dotFilled connector={notes.length > 0 ? "solid" : "dashed"}>
                <div style={{ ...mono, fontSize: 11, color: ivFaint }}>{store.aspirationSetDate}</div>
                <div style={{ ...sans, fontSize: 13, fontWeight: 700, color: ivHeading, marginTop: 4 }}>Where you started</div>
              </JourneyNode>

              {notes.map((n, i) => {
                const isCurrent = i === notes.length - 1;
                return (
                  <JourneyNode
                    key={i}
                    connector="dashed"
                    dotFilled={!isCurrent}
                    dot={isCurrent ? <JourneyCharacter size={30} /> : undefined}
                  >
                    <div style={{ ...mono, fontSize: 11, color: ivFaint }}>{n.date}</div>
                    {isCurrent && (
                      <div style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: ivHeading, marginTop: 2, textTransform: "uppercase" }}>
                        You are here
                      </div>
                    )}
                    <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 4, lineHeight: 1.55, wordBreak: "keep-all" }}><Emph text={n.note} /></div>
                  </JourneyNode>
                );
              })}

              {notes.length === 0 && (
                <JourneyNode connector="dashed" dotFilled={false} dot={<JourneyCharacter size={30} />}>
                  <div style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: ivHeading, marginTop: 2, textTransform: "uppercase" }}>
                    You are here
                  </div>
                  <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 4, lineHeight: 1.55, wordBreak: "keep-all" }}>
                    Not enough entries yet to place a waypoint. Keep logging thoughts and this fills in with what's actually changed.
                  </div>
                </JourneyNode>
              )}

              <JourneyNode last dotFilled={false}>
                <div style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: ivFaint, textTransform: "uppercase" }}>Goal</div>
                <div style={{ ...display, fontSize: 20, fontStyle: "italic", color: ivHeading, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>
                  "{store.aspiration}"
                </div>
                <motion.span
                  role="button" tabIndex={0} onClick={onSetupAspiration} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onSetupAspiration)?.(); } }} whileTap={{ opacity: 0.6 }}
                  style={{ ...sans, fontSize: 12, color: ivBody, cursor: "pointer", display: "inline-block", marginTop: 10 }}
                >
                  Set a different goal
                </motion.span>
              </JourneyNode>
            </>
          ) : (
            <>
              <JourneyNode last={false} connector="dashed" dotFilled={false} dot={<JourneyCharacter size={30} />}>
                <div style={{ ...sans, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: ivHeading, marginTop: 2, textTransform: "uppercase" }}>
                  You are here
                </div>
                <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 4, lineHeight: 1.6, wordBreak: "keep-all" }}>
                  No destination set yet — the path has a start, but nowhere marked to walk toward.
                </div>
              </JourneyNode>
              <JourneyNode last dotFilled={false}>
                <div
                  role="button" tabIndex={0} onClick={onSetupAspiration} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (onSetupAspiration)?.(); } }}
                  style={{ padding: 16, borderRadius: 14, backgroundColor: "rgba(42,38,33,0.06)", borderLeft: `2px solid ${ivHeading}`, cursor: "pointer" }}
                >
                  <div style={{ ...sans, fontSize: 13, fontWeight: 700, color: ivHeading }}>Tell us who you want to become</div>
                  <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 6, lineHeight: 1.6, wordBreak: "keep-all" }}>
                    One sentence is enough — we'll mark it as the goal and start tracking the walk toward it.
                  </div>
                </div>
              </JourneyNode>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
