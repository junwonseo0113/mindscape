import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { REGION_CONFIG, resolveRegion } from "./brainRegions";
import authorAnaisNinImg from "../assets/author-anais-nin.webp";
import { CognitiveRegion } from "./neuralBrainLayout";
import { Store, StoredBelief, StoredEvidenceQuote, StoredGoal, StoredHistoryEntry } from "./types";
import { formatDateDots, mondayOfWeek, parseDotDate, shortMonthDay } from "./dateUtils";
import { apiUrl } from "./apiBase";
import { awayStreak, closenessAt, CURRENT_STREAK, stepsSoFar, weekChange } from "./aspirationPath";
import { VoyageCard } from "./Voyage";
import { isMoodCheckIn } from "./realStore";
import { AnimatedNumber, Breathe } from "./motionPrimitives";
import { Node } from "./orb";
import { display, hand, mono, MONO_FAMILY, sans } from "./typefaces";
import { ArrowLeft, ArrowRight, CaretRight, ChartLineUp, Compass, Feather, FileText, Footprints, MagnifyingGlass, PaintBrush, Path, Quotes, ShareNetwork, ShieldCheck, Sparkle, User, UsersThree } from "@phosphor-icons/react";
import { AiConsentContext } from "./aiConsent";
import { eligiblePassages, resolveLiterarySelection, sanitizeLiterarySelections, buildWhyThisFoundYou, type LiteraryTarget } from "./literaryPassages";
import { mdCard, mdCardShadow, mdHeading, mdBody, mdFaint, mdDivider, mdNeutralTag, ivBg2, ivBackground, ivCardShadow, shape, ivHeading, ivBody, ivFaint, ivDivider } from "./screenTheme";
import { ReactionButtons, howOften, OftenDots } from "./insightUI";
import { Emph, B, quietCard, SectionHeading } from "./insightText";
import { settingsTile, DiaryLinkCard } from "./settingsUI";
import { RegionBadge } from "./regionUI";
import { type DiscoveryTarget, computeDiscovery, resolveDiscoveryTarget, type RecentInsightItem, buildRecentInsights } from "./discovery";
import { PRIMARY_HEADER_TOP, PRIMARY_HEADER_SIDE, PageTitle, BottomNav } from "./screenUI";
import { HistoryControlButton } from "./historyShared";
import { groupInsights, LEAN_LABEL, type InsightLean } from "./insightGroups";
import { voyageAnchor } from "./entryTiming";
import { evidenceForHypothesis } from "./hypothesisEvidence";

// A reserved, clearly-labeled slot for an analysis module that doesn't
// exist yet — honest about what it is instead of shipping a fake chart
// with no real data behind it.
function ComingSoonRow({ label, last }: { label: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 2px", borderBottom: last ? "none" : `1px solid ${mdDivider}` }}>
      <span style={{ ...sans, fontSize: 13, color: mdFaint }}>{label}</span>
      <span style={{ ...sans, fontSize: 11, fontWeight: 700, color: mdBody, backgroundColor: mdNeutralTag, padding: "3px 9px", borderRadius: 999 }}>Coming soon</span>
    </div>
  );
}

// The single interactive agree/disagree point for a discovery (the hero
// above just shows a static preview — see ScreenAnalysis). Disagreeing
// doesn't just record a reason anymore: it asks the model for a genuinely
// different reading of the same evidence and swaps the discovery's text
// in place, looping until the user agrees or the model has nothing more to
// offer (reinterpreting/exhausted, driven by rejectedStatements/
// rejectedTitles — see analysisFramework's /api/reinterpret).
function DiscoveryReflection({
  reaction,
  reinterpreting,
  exhausted,
  onReact,
}: {
  reaction: "agree" | "disagree" | null | undefined;
  reinterpreting?: boolean;
  exhausted?: boolean;
  onReact?: (r: "agree" | "disagree") => void;
}) {
  // Once a discovery is settled — agreed with, or reinterpretation
  // exhausted — there's nothing left to press, so the buttons themselves
  // go away instead of sitting there disabled. Only the still-open states
  // (fresh, or a reinterpretation in flight that might still land on
  // something to react to) keep showing them.
  const settled = reaction === "agree" || exhausted;
  return (
    <div>
      <p style={{ ...sans, fontSize: 15, color: ivHeading, margin: "0 0 6px", lineHeight: 1.5 }}>Does this observation match your experience right now?</p>
      {/* Observer-self framing (ACT: self-as-context) — agree/disagree here
          isn't a verdict on whether the thought is true, just whether this
          reading of it matches what was actually noticed. */}
      <p style={{ ...display, fontStyle: "italic", fontSize: 15, color: ivBody, margin: "0 0 16px", lineHeight: 1.5, wordBreak: "keep-all" }}>
        This isn't about deciding whether to believe this thought. It's just about whether it fits who you are right now.
      </p>
      {reinterpreting && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0" }}>
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: ivHeading }}
          />
          <span style={{ ...sans, fontSize: 13, color: ivBody }}>Reconsidering...</span>
        </div>
      )}
      {!settled && !reinterpreting && <ReactionButtons reaction={reaction} onReact={onReact} night />}
      {settled && exhausted && (
        <p style={{ ...sans, fontSize: 13, color: ivBody, margin: "0 0 12px" }}>We can't come up with a new interpretation right now. We'll take another look next time.</p>
      )}
      {settled && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${ivHeading}`, color: ivHeading, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</span>
          <span style={{ ...sans, fontSize: 13, color: ivBody }}>{exhausted ? "That's as far as we've gotten for now." : "You accepted this observation."}</span>
        </div>
      )}
    </div>
  );
}

// ── Examine, sectioned ───────────────────────────────────────────────────────
// Examine used to be one column of ivory serif under identical tracked-caps
// labels, so every section looked like the one before it and nothing said
// where you were on the page. Each section now has its own header (a
// tinted icon tile and a sentence-case title, the same grammar as History's
// "How you've changed"), and its content takes the form of what it is: the
// discovery as a card in its region's color with a confidence ring, your
// own words as speech bubbles, the history of the thought as a lit trail.
function ExamineSectionHeader({ region, icon, title, subtitle }: { region: CognitiveRegion; icon: React.ReactNode; title: string; subtitle?: string }) {
  const tone = REGION_CONFIG[region];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
      <span style={{ ...settingsTile, width: 32, height: 32, borderRadius: 9, backgroundColor: tone.tint, color: tone.ink }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...display, fontSize: 20, color: ivHeading, lineHeight: 1.25 }}>{title}</div>
        {subtitle && <div style={{ ...hand, fontSize: 19, fontWeight: 500, color: ivBody, marginTop: 1, lineHeight: 1.2, wordBreak: "keep-all" }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function ExamineSection({ region, icon, title, subtitle, children, style }: { region: CognitiveRegion; icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ marginTop: 36, ...style }}>
      <ExamineSectionHeader region={region} icon={icon} title={title} subtitle={subtitle} />
      {children}
    </section>
  );
}

// A ring that fills to the confidence value when it scrolls into view.
function ConfidenceRing({ value, color, size = 64 }: { value: number; color: string; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}% confidence`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(42,38,33,0.08)" strokeWidth="5" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - pct) }} viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
      />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={size * 0.25} fontWeight="700" fontFamily={MONO_FAMILY} fill="#2A2621">{value}%</text>
    </svg>
  );
}

// The discovery itself: a card washed in its region's color, the region's
// orb glowing in the corner, the statement, and the confidence ring.
function ExamineHero({ kicker, thoughtLabel, text, confidence, entries, region }: { kicker: string; thoughtLabel?: string; text: string; confidence: number; entries: number; region: CognitiveRegion }) {
  const tone = REGION_CONFIG[region];
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: shape.lg, padding: "18px 18px 16px", boxShadow: ivCardShadow, backgroundImage: `linear-gradient(155deg, ${tone.tint} 0%, #FBF8F2 62%, #FBF8F2 100%)` }}>
      <div aria-hidden style={{ position: "absolute", top: -6, right: -6 }}>
        <Node color={tone.color} size={34} intensity={0.85} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, ...sans, fontSize: 12, fontWeight: 600, color: ivHeading, backgroundColor: "rgba(255,255,255,0.7)", padding: "4px 9px", borderRadius: shape.full }}>
          <Sparkle size={12} weight="fill" color={tone.ink} /> {kicker}
        </span>
        <RegionBadge region={region} />
      </div>
      {thoughtLabel && (
        <p style={{ ...display, fontStyle: "italic", fontSize: 17, color: tone.ink, margin: "14px 0 0" }}>The "{thoughtLabel}" thought showed up again</p>
      )}
      <p style={{ ...display, fontSize: 22, lineHeight: 1.38, color: ivHeading, margin: "8px 0 0", paddingRight: 24, wordBreak: "keep-all" }}>{text}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${ivDivider}` }}>
        <ConfidenceRing value={confidence} color={tone.color} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...sans, fontSize: 14, fontWeight: 500, color: ivHeading }}>How sure the AI is</div>
          <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 2, lineHeight: 1.45 }}>
            Based on {entries} {entries === 1 ? "thing you said" : "things you said"}. It never reaches 100%.
          </div>
        </div>
      </div>
    </div>
  );
}

// One thing you actually said, as a speech bubble in the color of the
// area of life it came from. Entries pointing the other way sit on the
// right in a warm tone, so for and against read apart at a glance.
function EvidenceBubble({ date, quote, domain, against, index }: { date: string; quote: string; domain?: string; against?: boolean; index: number }) {
  const region = domain ? resolveRegion({ domain } as StoredBelief) : "identity";
  const tone = against ? REGION_CONFIG.creativity : REGION_CONFIG[region];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
      style={{ display: "flex", flexDirection: "column", alignItems: against ? "flex-end" : "flex-start" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, padding: "0 6px" }}>
        <span style={{ ...mono, fontSize: 11, color: ivBody }}>{date}</span>
        {domain && <span style={{ ...sans, fontSize: 11, fontWeight: 600, color: tone.ink }}>{domain}</span>}
      </div>
      <div style={{
        position: "relative", maxWidth: "88%", padding: "11px 14px", ...display, fontStyle: "italic", fontSize: 17, lineHeight: 1.5, color: ivHeading, wordBreak: "keep-all",
        backgroundImage: `linear-gradient(140deg, ${tone.tint} 0%, rgba(255,255,255,0.85) 100%)`,
        borderRadius: against ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
      }}>
        "{quote}"
      </div>
    </motion.div>
  );
}

// A vertical "watch it develop" chain — origin, current understanding, and
// (when there's a real recorded one) an outcome. Only ever built from
// points that trace back to something actually recorded; never a
// fabricated midpoint. Drawn as a trail that warms from faint to the
// region's color, each point a small orb, the outcome as its own card.
function EvolutionTimeline({ points, color = ivHeading }: { points: { label: string; text: string; accent?: boolean }[]; color?: string }) {
  return (
    <div style={{ position: "relative" }}>
      {points.length > 1 && (
        <span aria-hidden style={{ position: "absolute", left: 13, top: 14, bottom: 26, width: 2, borderRadius: 1, backgroundImage: `linear-gradient(180deg, ${color}22 0%, ${color} 100%)` }} />
      )}
      {points.map((p, i) => (
        <motion.div
          key={i} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.12 }}
          style={{ display: "flex", gap: 10, paddingBottom: i < points.length - 1 ? 16 : 0 }}
        >
          <span style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Node color={color} size={p.accent ? 14 : 9} intensity={p.accent ? 0.95 : 0.35 + (i / Math.max(1, points.length - 1)) * 0.4} />
          </span>
          <div style={{
            flex: 1, minWidth: 0, paddingTop: 3,
            ...(p.accent ? { padding: "10px 12px", borderRadius: shape.sm, backgroundImage: `linear-gradient(140deg, ${color}26 0%, rgba(255,255,255,0.7) 100%)` } : {}),
          }}>
            <div style={{ ...mono, fontSize: 11, color: p.accent ? ivHeading : ivBody, marginBottom: 3 }}>{p.label}</div>
            <p style={{ ...display, fontStyle: "italic", fontSize: 17, color: p.accent ? ivHeading : ivBody, margin: 0, lineHeight: 1.45, wordBreak: "keep-all" }}>{p.text}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}



// The Analysis tab's one layout primitive — a raised white card on the
// screen's surface-tinted background (see ScreenAnalysis), Apple grouped-
// list style: elevation instead of a border does the work a thin `hair`
// divider used to (and couldn't, since surface-on-page is barely visible).
// Every section from "why" onward is one of these, so the page reads as
// distinct, scannable groups rather than one continuous flow of text.
function SectionCard({ title, subtitle, children, dataTutorial }: { title?: string; subtitle?: string; children: React.ReactNode; dataTutorial?: string }) {
  return (
    <div data-tutorial={dataTutorial} style={{ backgroundColor: mdCard, borderRadius: 20, padding: "22px 20px", boxShadow: mdCardShadow }}>
      {title && <div style={{ ...display, fontSize: 20, color: mdHeading, marginBottom: subtitle ? 4 : 18 }}>{title}</div>}
      {subtitle && <div style={{ ...sans, fontSize: 13, color: mdBody, marginBottom: 16, lineHeight: 1.5, wordBreak: "keep-all" }}>{subtitle}</div>}
      {children}
    </div>
  );
}

// ── Screen 4.5 · Mind ──────────────────────────────────────────────────────────
// Just the belief network now — the discovery/evidence/evolution/reflection
// conversation that used to share this screen with it moved out to its own
// "Analysis" tab (see ScreenDiscoveryAnalysis and the "discoveryAnalysis"
// case in the App shell below), leaving this one to answer a single
// question: "what does my confirmed belief network actually look like?"
// ── ConnectionThread ─────────────────────────────────────────────────────────
// Two beliefs and what joins them, drawn: each belief a glowing orb in its
// own color, a woven thread between them that shades from one color to the
// other, and light traveling along it both ways — each orb flaring as the
// light reaches it, because the two keep feeding each other. The note
// that explains the connection sits under the picture as a quote, its
// first clause set larger, so the idea lands before the sentence does.
function ConnectionThread({ a, b, note, tension, night }: { a: StoredBelief; b: StoredBelief; note: string; tension?: boolean; night?: boolean }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const ra = REGION_CONFIG[resolveRegion(a)], rb = REGION_CONFIG[resolveRegion(b)];
  const label = (x: StoredBelief) => x.thoughtLabel || x.statement;
  const CYCLE = 2.6;
  // The thread: two strands braided around the line between the orbs.
  const strand = (phase: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const x = 82 + t * 156;
      const y = 62 + Math.sin(t * Math.PI * 3 + phase) * 9 * Math.sin(t * Math.PI);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  };
  const flare = (delay: number) => (reduce ? undefined : { duration: CYCLE, repeat: Infinity, delay, ease: "easeOut" as const, times: [0, 0.12, 0.5, 1] });
  // The split: the clause before "seems"/"connects"/"," leads, larger.
  const cut = note.search(/\s(seems|seem|connects?|is linked|ties|because)\s|,\s/);
  const lead = cut > 12 ? note.slice(0, cut) : "";
  const rest = cut > 12 ? note.slice(cut) : note;
  const font = "'Pretendard Variable', Pretendard, sans-serif";
  return (
    <div>
      <svg role="img" aria-label={`"${a.statement}" and "${b.statement}" are joined${tension ? ", pulling against each other" : " and feed each other"}.`}
        viewBox="0 0 320 112" style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id={`cbg${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={ra.tint} /><stop offset="1" stopColor={rb.tint} /></linearGradient>
          <linearGradient id={`cth${id}`} x1="82" y1="0" x2="238" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={ra.color} /><stop offset="1" stopColor={rb.color} /></linearGradient>
          {[["a", ra], ["b", rb]].map(([k, t]) => (
            <radialGradient key={k as string} id={`co${k}${id}`}><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.35" stopColor={(t as typeof ra).color} /><stop offset="1" stopColor={(t as typeof ra).color} stopOpacity="0" /></radialGradient>
          ))}
        </defs>
        {!night && <rect width="320" height="112" rx="16" fill={`url(#cbg${id})`} opacity="0.75" />}
        {/* The braided thread, its strands slowly turning. */}
        {[0, Math.PI].map((ph, i) => (
          <motion.polyline key={i} points={strand(ph)} fill="none" stroke={`url(#cth${id})`} strokeWidth="2.2" strokeLinecap="round"
            strokeDasharray={tension ? "5 6" : undefined} opacity={0.75}
            initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 1, delay: 0.2 + i * 0.15, ease: [0.22, 1, 0.36, 1] }} />
        ))}
        {/* Light traveling both ways. */}
        {!reduce && (
          <>
            <motion.circle r="4.5" fill="#FFFFFF" cy={62} cx={82} initial={{ cx: 82, opacity: 0 }}
              animate={{ cx: [82, 238], opacity: [0, 1, 1, 0] }} transition={{ duration: CYCLE * 0.55, repeat: Infinity, repeatDelay: CYCLE * 0.45, ease: "easeInOut" }}
              style={{ filter: `drop-shadow(0 0 6px ${ra.color})` }} />
            <motion.circle r="4.5" fill="#FFFFFF" cy={62} cx={238} initial={{ cx: 238, opacity: 0 }}
              animate={{ cx: [238, 82], opacity: [0, 1, 1, 0] }} transition={{ duration: CYCLE * 0.55, repeat: Infinity, repeatDelay: CYCLE * 0.45, delay: CYCLE * 0.5, ease: "easeInOut" }}
              style={{ filter: `drop-shadow(0 0 6px ${rb.color})` }} />
          </>
        )}
        {/* The two beliefs, flaring as the light arrives. */}
        {[{ x: 62, g: `coa${id}`, c: ra.color, d: CYCLE * 0.98 }, { x: 258, g: `cob${id}`, c: rb.color, d: CYCLE * 0.48 }].map((o, i) => (
          <g key={i}>
            {/* Flares by growing its radius (scaling an SVG node around a
                point is unreliable across browsers). */}
            <motion.circle cx={o.x} cy={62} r={26} fill={`url(#${o.g})`}
              initial={{ r: 26 }} animate={reduce ? undefined : { r: [26, 36, 29, 26] }} transition={flare(o.d)} />
            <circle cx={o.x} cy={62} r="8" fill={o.c} />
            <circle cx={o.x - 2.4} cy={59.6} r="2.6" fill="#FFFFFF" opacity="0.9" />
          </g>
        ))}
      </svg>
      <div style={{ position: "relative", marginTop: 12, padding: "2px 0 0 18px" }}>
        <span aria-hidden style={{ position: "absolute", left: 0, top: -6, ...display, fontSize: 44, lineHeight: 1, color: ra.color, opacity: 0.55 }}>“</span>
        {lead && (
          <div style={{ ...display, fontSize: 24, lineHeight: 1.2, wordBreak: "keep-all",
            backgroundImage: night ? `linear-gradient(90deg, ${ra.color}, ${rb.color})` : `linear-gradient(90deg, ${ra.ink}, ${rb.ink})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            {lead}
          </div>
        )}
        <div style={{ ...display, fontStyle: "italic", fontSize: lead ? 18 : 20, lineHeight: 1.45, color: night ? "rgba(244,239,255,0.72)" : ivBody, marginTop: lead ? 4 : 0, wordBreak: "keep-all" }}><Emph text={rest.trim()} keys={[a.statement, b.statement, a.thoughtLabel, b.thoughtLabel]} color={night ? "#FFFFFF" : ivHeading} /></div>
      </div>
    </div>
  );
}

// The paper Mind's cards are written on: diary paper with a wash of two
// colours, a strip of washi tape, and a few small star stickers scattered
// in the margins (fixed positions, a third of them twinkling on the same
// .twinkle CSS the sky uses). Both of Mind's cards use it, so the page reads
// as one diary spread rather than a dark card next to light ones.
const PAPER_STARS = Array.from({ length: 9 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  // Kept to the outer edges, where they won't sit under text.
  const side = i % 3;
  const x = side === 0 ? 2 + r(1) * 6 : side === 1 ? 92 + r(1) * 6 : 10 + r(1) * 80;
  const y = side === 2 ? (r(2) < 0.5 ? 2 + r(3) * 4 : 94 + r(3) * 4) : 8 + r(2) * 84;
  return { x, y, s: 7 + Math.round(r(4) * 5), tone: (["identity", "career", "relationships"] as CognitiveRegion[])[i % 3], tw: i % 3 === 0, d: 2.5 + r(5) * 3, dl: r(6) * 4 };
});

// A small page-of-notes glyph — "N thoughts" — matching the supplied
// concept reference's document icon (not a speech bubble).
function ThoughtGlyph({ color }: { color: string }) {
  return <FileText size={12} color={color} />;
}
// A shield-check glyph — "NN% confidence" — matching the reference in
// place of the earlier clock icon.
function ConfidenceGlyph({ color }: { color: string }) {
  return <ShieldCheck size={12} color={color} />;
}
// The small four-point sparkle before "TODAY'S DISCOVERY" in the reference —
// a plain "✦" reads one weight heavier/rounder than the reference's crisp
// diamond mark, so this draws it directly instead of relying on a font glyph.
function SparkleGlyph({ color, size = 11 }: { color: string; size?: number }) {
  return <Sparkle size={size} color={color} weight="fill" />;
}
// A vertical "|" separator between the two footer stats — matching the
// reference's metadata row, drawn rather than relying on a literal pipe
// character's inconsistent glyph metrics across fonts.
function MetaDivider({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 1, height: 12, backgroundColor: color, opacity: 0.4, flexShrink: 0 }} />;
}

// One simple monoline glyph per cognitive region, for Recent Insights'
// circular icon badge — the reference marks each insight with an icon
// instead of a domain-name tag, so this is what stands in for that per the
// app's own six real regions (see REGION_CONFIG/CognitiveRegion) rather
// than inventing a separate icon set unrelated to the actual data.
function RegionIconGlyph({ region, color }: { region: CognitiveRegion; color: string }) {
  const size = 15;
  switch (region) {
    case "identity": return <User size={size} color={color} />;
    case "security": return <ShieldCheck size={size} color={color} />;
    case "career": return <ChartLineUp size={size} color={color} />;
    case "relationships": return <UsersThree size={size} color={color} />;
    case "curiosity": return <MagnifyingGlass size={size} color={color} />;
    case "creativity":
    default: return <PaintBrush size={size} color={color} />;
  }
}

// Today's Discovery — the one dominant content object on the Analysis
// landing scene, inside a single restrained ivory SurfaceCard rather than
// sitting directly on the canvas (that read as a feed/dashboard, weak
// hierarchy). No dark navy card, no photographic backdrop — see the ivory
// redesign pass. `interpretation` is only shown when it's genuinely
// distinct from `title` (see ScreenDiscoveryAnalysis) so the card never
// repeats the same sentence twice.
function DiscoveryCard({
  title,
  interpretation,
  thoughtCount,
  confidence,
  region = "identity",
  onExamine,
}: {
  title: string;
  interpretation: string;
  thoughtCount: number;
  confidence: number;
  region?: CognitiveRegion;
  onExamine?: () => void;
}) {
  // Today's discovery as the page's one bright object: the paper washed in
  // the discovery's own colour, a strip of washi tape holding it to the
  // page, and its star in the corner with two small lights circling it.
  const reduce = useReducedMotion();
  const c = REGION_CONFIG[region];
  const second = REGION_CONFIG[region === "relationships" ? "identity" : "relationships"];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14, rotate: -0.6 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 150, damping: 20 }}
      style={{
        position: "relative", boxSizing: "border-box", padding: "26px 22px 20px", borderRadius: 22,
        backgroundColor: "#FFFDF8",
        backgroundImage: `radial-gradient(80% 70% at 100% 0%, ${c.color}40, transparent 60%), radial-gradient(70% 60% at 0% 100%, ${second.color}26, transparent 65%), linear-gradient(180deg, #FFFDF8, #FBF6EE)`,
        border: `1px solid ${c.color}33`,
        boxShadow: `0 18px 36px -22px ${c.color}, 0 1px 0 rgba(255,255,255,0.9) inset`,
      }}
    >
      {/* Washi tape */}
      <span aria-hidden style={{ position: "absolute", top: -9, left: 26, width: 70, height: 20, borderRadius: 2, transform: "rotate(-5deg)", opacity: 0.9,
        backgroundImage: `repeating-linear-gradient(45deg, ${c.color}aa 0 7px, ${c.tint} 7px 14px)`, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }} />
      {/* The discovery's star, with two lights orbiting it */}
      <div aria-hidden style={{ position: "absolute", top: 16, right: 18, width: 64, height: 64 }}>
        <motion.div animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          style={{ position: "absolute", inset: 0 }}>
          <span style={{ position: "absolute", left: "50%", top: -2, width: 6, height: 6, marginLeft: -3, borderRadius: "50%", backgroundColor: second.color, boxShadow: `0 0 8px ${second.color}` }} />
          <span style={{ position: "absolute", left: 4, bottom: 6, width: 4, height: 4, borderRadius: "50%", backgroundColor: REGION_CONFIG.career.color, boxShadow: `0 0 6px ${REGION_CONFIG.career.color}` }} />
        </motion.div>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Breathe amount={1.1}><Node color={c.color} size={30} intensity={0.95} /></Breathe>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 70 }}>
        <Sparkle size={15} weight="fill" color={c.color} aria-hidden />
        <div style={{ ...hand, fontSize: 22, fontWeight: 600, color: c.ink, lineHeight: 1 }}>Today's discovery</div>
      </div>

      <p style={{
        ...display, fontSize: 25, fontWeight: 400, lineHeight: 1.2, color: ivHeading, margin: "14px 0 0", paddingRight: 54, wordBreak: "keep-all",
        overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3,
      }}>
        {title}
      </p>

      {interpretation && (
        <p style={{
          ...sans, fontSize: 13, color: ivBody, lineHeight: 1.55, margin: "8px 0 0", wordBreak: "keep-all",
          overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2,
        }}>
          <Emph text={interpretation} />
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, ...sans, fontSize: 11, fontWeight: 600, color: c.ink, backgroundColor: `${c.color}1f`, border: `1px solid ${c.color}33`, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
            <ThoughtGlyph color={c.ink} /> {thoughtCount} thought{thoughtCount === 1 ? "" : "s"}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, ...sans, fontSize: 11, fontWeight: 600, color: second.ink, backgroundColor: `${second.color}1a`, border: `1px solid ${second.color}33`, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
            <ConfidenceGlyph color={second.ink} /> {howOften(confidence).label}
          </span>
        </div>

        <motion.button
          type="button" aria-label="Examine today's discovery" onClick={onExamine}
          whileTap={{ scale: 0.94 }} whileHover={reduce ? undefined : { scale: 1.03 }}
          className={reduce ? undefined : "lens-current"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, border: 0, cursor: "pointer", flexShrink: 0,
            ...sans, fontSize: 13, fontWeight: 700, color: "#FFFFFF", padding: "9px 15px", borderRadius: 999,
            backgroundImage: `linear-gradient(110deg, ${c.ink}, ${c.color}, ${second.color}, ${c.ink})`,
            boxShadow: `0 8px 18px -8px ${c.color}`,
          }}
        >
          Examine <ArrowRight size={13} weight="bold" aria-hidden />
        </motion.button>
      </div>
    </motion.div>
  );
}

// One insight as a line in a list: its orb, its name, the fuller sentence
// on one line under it, and how many entries it rests on.
function InsightRow({ item, onOpen, divider }: { item: RecentInsightItem; onOpen?: () => void; divider?: boolean }) {
  const c = REGION_CONFIG[item.region];
  const primary = item.thoughtLabel || item.title;
  return (
    <motion.div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(); } }}
      whileTap={{ backgroundColor: `${c.color}14` }} transition={{ duration: 0.12 }}
      style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px 13px 16px", cursor: "pointer", backgroundColor: "rgba(0,0,0,0)", WebkitTapHighlightColor: "transparent" }}>
      {divider && <span aria-hidden style={{ position: "absolute", top: 0, left: 50, right: 0, height: 1, backgroundColor: ivDivider }} />}
      <span style={{ width: 22, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        <Node color={c.color} size={14} intensity={Math.min(1, 0.45 + (item.confidence / 100) * 0.4)} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", ...display, fontSize: 18, color: ivHeading, lineHeight: 1.25, wordBreak: "keep-all" }}>{primary}</span>
      </span>
      {item.thoughtCount > 0 && <span style={{ ...hand, fontSize: 17, color: c.ink, flexShrink: 0 }}>{item.thoughtCount} {item.thoughtCount === 1 ? "entry" : "entries"}</span>}
      <CaretRight size={14} color={ivBody} weight="bold" style={{ flexShrink: 0 }} />
    </motion.div>
  );
}

// ── Insights web ──
// Every further insight, sorted into three branches around you by where
// the entries behind it pull (insightGroups.ts). Tap a branch to open its
// insights underneath; tap one to examine it, as before.
const LEAN_REGION: Record<InsightLean, CognitiveRegion> = { closer: "security", back: "relationships", unclear: "curiosity" };
// Node positions in a 320 × 210 field: you in the middle, branches around.
const WEB_CENTER = { x: 160, y: 92 };
const WEB_NODES: Record<InsightLean, { x: number; y: number }> = { closer: { x: 78, y: 44 }, back: { x: 242, y: 44 }, unclear: { x: 160, y: 158 } };

function InsightsWeb({ items, store, onOpen }: { items: RecentInsightItem[]; store: Store; onOpen: (item: RecentInsightItem) => void }) {
  const reduce = useReducedMotion();
  const groups = React.useMemo(() => groupInsights(items, store), [items, store]);
  const [open, setOpen] = React.useState<InsightLean | null>(null);
  const leans: InsightLean[] = ["closer", "back", "unclear"];
  return (
    <div>
      <div style={{ ...quietCard, position: "relative", padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "320 / 210" }}>
          <svg viewBox="0 0 320 210" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            {leans.map((l, i) => {
              const n = WEB_NODES[l], c = REGION_CONFIG[LEAN_REGION[l]];
              const active = open === l;
              return (
                <motion.path key={l} d={`M${WEB_CENTER.x} ${WEB_CENTER.y} Q${(WEB_CENTER.x + n.x) / 2 + (i - 1) * 14} ${(WEB_CENTER.y + n.y) / 2 - 10} ${n.x} ${n.y}`}
                  fill="none" stroke={c.color} strokeWidth={active ? 2.4 : 1.4} strokeOpacity={open && !active ? 0.25 : 0.7} strokeDasharray={groups[l].length ? undefined : "3 5"}
                  initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.8, delay: 0.1 * i }} />
              );
            })}
            {/* you, in the middle */}
            <circle cx={WEB_CENTER.x} cy={WEB_CENTER.y} r="15" fill="#E2A847" opacity="0.18" />
            <path transform={`translate(${WEB_CENTER.x} ${WEB_CENTER.y})`} d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z" fill="#E2A847" />
            <text x={WEB_CENTER.x + 22} y={WEB_CENTER.y + 4} textAnchor="start" fontSize="10" fill={ivBody} style={{ fontFamily: sans.fontFamily }}>you</text>
          </svg>
          {leans.map((l) => {
            const n = WEB_NODES[l], c = REGION_CONFIG[LEAN_REGION[l]];
            const count = groups[l].length, active = open === l;
            return (
              // Positioned by a plain wrapper: Motion owns the button's own
              // transform (for the tap), which would undo a translate here.
              <div key={l} style={{ position: "absolute", left: `${(n.x / 320) * 100}%`, top: `${(n.y / 210) * 100}%`, transform: "translate(-50%, -17px)" }}>
                <motion.button type="button" aria-expanded={active} aria-controls="insights-branch"
                  aria-label={`${LEAN_LABEL[l].title}: ${count} ${count === 1 ? "insight" : "insights"}`}
                  onClick={() => setOpen(active ? null : l)} whileTap={{ scale: 0.95 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "none", border: 0, padding: 0, cursor: "pointer",
                    WebkitTapHighlightColor: "transparent", opacity: open && !active ? 0.55 : 1 }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", boxSizing: "border-box",
                    backgroundColor: active ? c.color : "#FFFFFF", border: `3px solid ${c.color}`, boxShadow: `0 0 0 ${active ? 6 : 4}px ${c.color}2e, 0 6px 14px -6px ${c.color}`,
                    ...sans, fontSize: 13, fontWeight: 700, color: active ? "#FFFFFF" : c.ink }}>{count}</span>
                  <span style={{ ...hand, fontSize: 17, fontWeight: 600, color: active ? c.ink : ivHeading, lineHeight: 1, whiteSpace: "nowrap" }}>{LEAN_LABEL[l].title}</span>
                </motion.button>
              </div>
            );
          })}
        </div>
      </div>
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div key={open} id="insights-branch" initial={{ opacity: 0, y: reduce ? 0 : -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ marginTop: 10 }}>
            <div style={{ ...sans, fontSize: 12, color: ivBody, lineHeight: 1.5, margin: "0 4px 8px" }}>{LEAN_LABEL[open].hint}</div>
            {groups[open].length === 0 ? (
              <div style={{ ...quietCard, ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, padding: "14px 16px" }}>Nothing here yet. It fills in as you write.</div>
            ) : (
              <div style={quietCard}>
                {groups[open].map((item, idx) => <InsightRow key={item.key} item={item} divider={idx > 0} onOpen={() => onOpen(item)} />)}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ ...sans, fontSize: 12, color: ivBody, margin: "8px 4px 0" }}>
            {items.length ? "Tap a branch to see what's in it." : "No insights yet. They'll show up here as more come into focus."}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ── Screen 4.6 · Analysis ──────────────────────────────────────────────────────
// Brought fully into the Mind screen's own design system: the same full-
// bleed dusk-coast photo (analysisDuskCoastImg — a moonlit shoreline at
// blue hour, swapped in for the earlier indoor night-study scene) bled up
// behind the status bar (the "top:-30" trick ScreenAnalysis uses). An earlier pass
// put Today's Discovery and Recent Insights directly on that photo with no
// containing surface at all, which — with enough real content on screen —
// started reading as a feed/dashboard rather than a considered composition.
// This pass reintroduces restrained "dark glass" cards (the same
// rgba(8,8,9,0.4)-family translucent-panel language ArtifactTile/BeliefCard/
// CatalogueCell already use elsewhere) for exactly two things: Today's
// Discovery as one dominant hero card (DiscoveryCard), and Further Insights
// — renamed from Recent Insights — as a compact horizontally-scrolling row
// of smaller cards (InsightCard) instead of a vertically-stacked list, each
// marked with a small glowing, region-colored node (Node, the same
// one History's own catalogue uses) rather than a text label. The header
// above both stays uncarded, open on the photo. The old single long page
// (Discovery → Evidence → Evolution → Reflection, all inline) is still two
// states of the same component: this landing scene, and — unchanged in
// substance/styling — the Examine sub-view below, which still holds all of
// that guided-conversation content for whichever target (today's discovery,
// or any further insight) it was opened on. Mind's belief network moved out
// the other direction (see ScreenAnalysis above) — no AI interpretation
// lives anywhere else in the app now, this tab is its one home.

// "Where you might be headed" — growth directions inferred from the
// recurring unconscious beliefs the Brain Map has already surfaced.
// Distinct from `aspiration` (which the user types themselves during
// onboarding/Distance from Goal): this is AI-inferred from what they've
// actually written, never something they stated. Lives on the Analysis tab
// (Examine view) rather than Home or Profile — it's an interpretation of
// the same belief evidence Examine is already walking through, not a
// dashboard tile. Only recomputes when the belief set has changed size
// since the last computation (goalsBeliefSnapshot), so it's not re-calling
// the AI on every visit — and never below MIN_BELIEFS_FOR_GOALS, since one
// or two beliefs isn't enough to infer a direction from.
const MIN_BELIEFS_FOR_GOALS = 3;
function GoalDirectionsPanel({ store, updateStore }: { store: Store; updateStore: (updater: (prev: Store) => Store) => void }) {
  const fetchingRef = React.useRef(false);
  // Inferring goals sends belief statements to the AI, so it needs the same
  // consent as analysis itself — see aiConsent.ts.
  const aiAllowed = React.useContext(AiConsentContext);
  const needsRefresh = aiAllowed && store.beliefs.length >= MIN_BELIEFS_FOR_GOALS && store.goalsBeliefSnapshot !== store.beliefs.length;
  React.useEffect(() => {
    if (!needsRefresh || fetchingRef.current) return;
    fetchingRef.current = true;
    const payload = store.beliefs.map((b) => ({ domain: b.domain, statement: b.statement, evidenceCount: b.evidenceCount }));
    fetch(apiUrl("/api/infer-goals"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ beliefs: payload }) })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data?.error || "Couldn't infer goals."); return data; })
      .then((data) => {
        const today = formatDateDots(new Date());
        const nextGoals: StoredGoal[] = (data.goals as { statement: string; basedOnDomains: string[] }[]).map((g, i) => ({ id: `goal-${Date.now()}-${i}`, statement: g.statement, basedOnDomains: g.basedOnDomains, createdDate: today }));
        updateStore((prev) => ({ ...prev, goals: nextGoals, goalsBeliefSnapshot: store.beliefs.length }));
      })
      .catch(() => {})
      .finally(() => { fetchingRef.current = false; });
  }, [needsRefresh, store.beliefs, updateStore]);
  if (!store.goals.length) return null;
  // Suggestions, not steps — so no 01/02/03; each gets its own tint and a
  // small icon instead, and arrives in turn as it scrolls into view.
  const tones: CognitiveRegion[] = ["security", "career", "curiosity"];
  return (
    <ExamineSection region="security" icon={<Compass size={17} weight="duotone" />} title="Where you might be headed" subtitle="Directions suggested by the beliefs that keep coming back.">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {store.goals.slice(0, 3).map((g, i) => {
          const tone = REGION_CONFIG[tones[i % tones.length]];
          return (
            <motion.div
              key={g.id} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 14px", borderRadius: shape.md, backgroundImage: `linear-gradient(135deg, ${tone.tint} 0%, rgba(255,255,255,0.75) 100%)`, boxShadow: ivCardShadow }}
            >
              <span style={{ ...settingsTile, backgroundColor: "rgba(255,255,255,0.8)", color: tone.ink }}><Footprints size={16} weight="duotone" /></span>
              <span style={{ ...display, fontSize: 17, lineHeight: 1.45, color: ivHeading, wordBreak: "keep-all", paddingTop: 2 }}>{g.statement}</span>
            </motion.div>
          );
        })}
      </div>
    </ExamineSection>
  );
}

// ── Analysis · Recent weeks ──────────────────────────────────────────────────
// A KPI row in the dashboard-template sense (TailAdmin and its kin: label,
// value, signed delta, a sparkline of the periods behind it), scaled to a
// phone and this palette. It answers the one question Today's Discovery
// can't — "how much have I actually been doing this?" — with numbers the
// store already has, bucketed into real Monday-to-Sunday weeks. The window
// is anchored to the most recent entry's week, not the calendar's: someone
// who hasn't written this week still sees their last active week instead
// of a row of zeros. Deltas are signed but never colored good/bad — writing
// less is not a failure, and the rest of the app doesn't grade people.
type WeekActivity = { weekStart: string; entries: number; words: number; verbs: number };

function buildWeekActivity(history: StoredHistoryEntry[], maxWeeks = 8): WeekActivity[] {
  // Written entries only: a mood tap is not a thought logged.
  const dated = history.filter((e) => !isMoodCheckIn(e)).flatMap((e) => { const d = parseDotDate(e.date); return d ? [{ e, monday: mondayOfWeek(d) }] : []; });
  if (dated.length === 0) return [];
  const buckets = new Map<string, WeekActivity>();
  dated.forEach(({ e, monday }) => {
    const key = formatDateDots(monday);
    const cur = buckets.get(key) ?? { weekStart: key, entries: 0, words: 0, verbs: 0 };
    cur.entries += 1;
    cur.words += e.languageObservation?.wordCount ?? 0;
    cur.verbs += e.languageObservation?.cognitiveVerbCount ?? 0;
    buckets.set(key, cur);
  });
  const last = new Date(Math.max(...dated.map((x) => x.monday.getTime())));
  // Always a fixed window of `maxWeeks` ending at the latest active week.
  // Quiet weeks — before the first entry or between busy ones — get an
  // explicit zero, so a gap reads as a gap and a two-week-old habit reads
  // as two weeks old, not as a full chart.
  const weeks: WeekActivity[] = [];
  for (let i = maxWeeks - 1; i >= 0; i -= 1) {
    const d = new Date(last);
    d.setDate(d.getDate() - i * 7);
    const key = formatDateDots(d);
    weeks.push(buckets.get(key) ?? { weekStart: key, entries: 0, words: 0, verbs: 0 });
  }
  return weeks;
}

const signedDelta = (n: number, digits = 0) => (n > 0 ? `+${n.toFixed(digits)}` : n < 0 ? `−${Math.abs(n).toFixed(digits)}` : "±0");


// The last seven days as seven small stars, lit for each day of the
// current streak (counting back from today), popping on one after another.
function StreakStars({ streak }: { streak: number }) {
  const reduce = useReducedMotion();
  const lit = Math.min(streak, 7);
  const c = REGION_CONFIG.career;
  return (
    <div role="img" aria-label={`${streak} ${streak === 1 ? "day" : "days"} in a row`} style={{ display: "flex", gap: 3, marginTop: 8 }}>
      {Array.from({ length: 7 }, (_, i) => {
        const on = i >= 7 - lit;
        return (
          <motion.span key={i}
            initial={reduce ? false : { scale: 0.3, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 380, damping: 16, delay: reduce ? 0 : 0.1 + i * 0.06 }}
            style={{ lineHeight: 0, color: on ? c.color : "rgba(42,38,33,0.16)", filter: on ? `drop-shadow(0 0 3px ${c.color})` : undefined }}>
            <Sparkle size={12} weight="fill" />
          </motion.span>
        );
      })}
    </div>
  );
}

// ── Analysis · Moods and thoughts ────────────────────────────────────────────
// Where Home's one-tap check-ins come back. A check-in is only a word, so on
// its own it says nothing about thinking; what it can show is which of
// someone's recurring thoughts turn up in what they wrote on the same day
// they tapped a feeling. A pair needs two separate days before it's shown,
// so one coincidence never reads as a pattern.
type MoodThoughtLink = { mood: string; belief: StoredBelief; days: number };

function moodThoughtLinks(store: Store): MoodThoughtLink[] {
  const moodsByDay = new Map<string, Set<string>>();
  store.history.forEach((e) => {
    const label = isMoodCheckIn(e) ? e.analysis?.observation.emotions[0]?.label : undefined;
    if (!label) return;
    moodsByDay.set(e.date, (moodsByDay.get(e.date) ?? new Set()).add(label));
  });
  const entryDay = new Map(store.history.filter((e) => !isMoodCheckIn(e)).map((e) => [e.id, e.date]));
  const links: MoodThoughtLink[] = [];
  store.beliefs.filter((b) => b.userReaction !== "rejected").forEach((belief) => {
    const daysByMood = new Map<string, Set<string>>();
    (belief.supportingEntryIds ?? []).forEach((id) => {
      const day = entryDay.get(id);
      if (!day) return;
      moodsByDay.get(day)?.forEach((mood) => daysByMood.set(mood, (daysByMood.get(mood) ?? new Set()).add(day)));
    });
    daysByMood.forEach((days, mood) => { if (days.size >= 2) links.push({ mood, belief, days: days.size }); });
  });
  return links.sort((a, b) => b.days - a.days || b.belief.confidence - a.belief.confidence).slice(0, 3);
}

export function ScreenDiscoveryAnalysis({
  onNavSelect,
  onOpenArtifact,
  onOpenBrainMap,
  store,
  updateStore,
  onAgreeHypothesis,
  onDisagreeHypothesis,
  onInvestigateHypothesis,
  onAgreeBeliefDiscovery,
  onDisagreeBeliefDiscovery,
  reinterpretingKey,
}: {
  onNavSelect?: (id: string) => void;
  onOpenArtifact?: (id: string) => void;
  onOpenBrainMap?: (region?: CognitiveRegion) => void;
  store: Store;
  updateStore: (updater: (prev: Store) => Store) => void;
  onAgreeHypothesis?: (index: number) => void;
  onDisagreeHypothesis?: (index: number) => void;
  onInvestigateHypothesis?: (index: number) => void;
  onAgreeBeliefDiscovery?: (beliefId: string) => void;
  onDisagreeBeliefDiscovery?: (beliefId: string) => void;
  reinterpretingKey?: string | null;
}) {
  const reduceMotion = useReducedMotion();
  // Pinned once per visit to this screen so the discovery being discussed
  // never gets silently swapped out mid-conversation — see
  // resolveDiscoveryTarget. This is Today's Discovery specifically — the
  // one thing the landing paper shows — independent of whichever target
  // Examine is currently open on below.
  const [pinnedDiscovery] = React.useState<DiscoveryTarget | null>(() => computeDiscovery(store));
  const discovery = pinnedDiscovery ? resolveDiscoveryTarget(store, pinnedDiscovery) : null;
  const discH = discovery?.kind === "hypothesis" ? store.hypotheses[discovery.index] : null;
  const discB = discovery?.kind === "belief" ? store.beliefs.find((x) => x.id === discovery.id) ?? null : null;
  // The paper's headline is the framing sentence ("The '__' showed up
  // again.") built from the short thoughtLabel when there is one, with the
  // fuller reasoning underneath as `discInterpretation`; when there's no
  // thoughtLabel, the one real sentence IS the headline and there's nothing
  // distinct left to show underneath it — never the same sentence twice.
  const discThoughtLabel = discH?.thoughtLabel || discB?.thoughtLabel || "";
  const discTitle = discThoughtLabel ? `The "${discThoughtLabel}" showed up again.` : discovery?.text || "";
  const discInterpretation = discThoughtLabel ? discovery?.text ?? "" : "";
  const discThoughtCount = discH ? evidenceForHypothesis(discH, store.beliefs).length : discB ? discB.evidenceQuotes.length : 0;
  const discConfidence = discH ? discH.confidence : discB ? discB.confidence : 0;
  // This discovery's own constellation-node color — the same region
  // resolution buildRecentInsights uses for Further Insights below — for
  // DiscoveryCard's one small, quiet node next to its eyebrow label (see
  // the redesign brief: "the relevant node can appear subtly inside or
  // near this card").
  const discRegion: CognitiveRegion | undefined = discH
    ? resolveRegion({ domain: discH.domains[0] ?? "identity" } as any)
    : discB
      ? resolveRegion(discB)
      : undefined;
  const discRegionColor = discRegion ? REGION_CONFIG[discRegion].color : undefined;

  // Everything that could have been Today's Discovery but isn't — see
  // buildRecentInsights. Shown as one horizontally-scrolling row (see
  // "Further Insights" below) rather than a capped list with a "View all"
  // expand — scrolling itself is what preserves access to every insight
  // here, so nothing is hidden behind an extra tap by default.
  const recentInsights = React.useMemo(() => buildRecentInsights(store, pinnedDiscovery), [store, pinnedDiscovery]);

  // The Examine sub-view: null means the landing scene; set means the full
  // guided-conversation content below (evidence → evolution → reflection →
  // Dig deeper) is open for that specific target, which may be Today's
  // Discovery or any Recent Insight — same shape, same component, so both
  // entry points share one implementation.
  const [examineTarget, setExamineTarget] = React.useState<DiscoveryTarget | null>(null);
  const examine = examineTarget ? resolveDiscoveryTarget(store, examineTarget) : null;
  const hIndex = examineTarget?.kind === "hypothesis" ? examineTarget.index : null;
  const h = hIndex !== null ? store.hypotheses[hIndex] : null;
  const b = examineTarget?.kind === "belief" ? store.beliefs.find((x) => x.id === examineTarget.id) ?? null : null;
  // The area of life it lives in — drives the hero's wash, the ring, and
  // the timeline's color.
  const examineRegion: CognitiveRegion = h ? resolveRegion({ domain: h.domains?.[0] ?? "identity" } as StoredBelief) : b ? resolveRegion(b) : "identity";

  // SECTION 2 — the strongest (most recent) three, shown chronologically.
  const rawEvidence: (StoredEvidenceQuote & { domain?: string })[] = h ? evidenceForHypothesis(h, store.beliefs) : b ? b.evidenceQuotes : [];
  const evidence = [...rawEvidence]
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    .slice(0, 3)
    .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));

  // SECTION 2, secondary — still part of "why": honest about conflicting signal.
  const contradictoryEntries: { belief: StoredBelief; entry: StoredHistoryEntry }[] = h
    ? h.relatedBeliefIds
        .map((id) => store.beliefs.find((x) => x.id === id))
        .filter((x): x is StoredBelief => !!x)
        .flatMap((belief) => (belief.contradictoryEntryIds ?? []).map((id) => ({ belief, entry: store.history.find((e) => e.id === id) })))
        .filter((x): x is { belief: StoredBelief; entry: StoredHistoryEntry } => !!x.entry)
    : b
      ? (b.contradictoryEntryIds ?? [])
          .map((id) => store.history.find((e) => e.id === id))
          .filter((e): e is StoredHistoryEntry => !!e)
          .map((entry) => ({ belief: b, entry }))
      : [];

  // SECTION 3 — a real timeline: origin → today → outcome for a hypothesis
  // with an investigate trail; earliest → latest evidence for a belief.
  // Never invents a midpoint that isn't actually in the data.
  const evolutionPoints: { label: string; text: string; accent?: boolean }[] = h?.investigate
    ? [
        { label: h.investigate.origin.date, text: h.investigate.origin.quote },
        { label: "Today", text: evidence[evidence.length - 1]?.quote ?? h.title },
        { label: h.investigate.compareLabel2, text: h.investigate.compareSteps2.join(" · "), accent: true },
      ]
    : b && b.evidenceQuotes.length >= 2
      ? (() => {
          const quotes = [...b.evidenceQuotes].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
          return [
            { label: quotes[0].date, text: quotes[0].quote },
            { label: quotes[quotes.length - 1].date, text: quotes[quotes.length - 1].quote, accent: true },
          ];
        })()
      : [];

  const reaction = h ? h.reaction : b ? b.discoveryReaction ?? null : null;
  const exhausted = h ? !!h.exhausted : b ? !!b.discoveryExhausted : false;
  const thisKey = hIndex !== null ? `hyp:${hIndex}` : b ? `belief:${b.id}` : null;
  const reinterpreting = !!thisKey && reinterpretingKey === thisKey;
  const handleReact = (r: "agree" | "disagree") => {
    if (r === "agree") {
      if (hIndex !== null) onAgreeHypothesis?.(hIndex);
      else if (b) onAgreeBeliefDiscovery?.(b.id);
    } else {
      if (hIndex !== null) onDisagreeHypothesis?.(hIndex);
      else if (b) onDisagreeBeliefDiscovery?.(b.id);
    }
  };

  return (
    <div style={{ position: "relative", height: "100%", backgroundColor: ivBg2 }}>
      {/* No overflowX:"hidden" here (deliberately — see below): setting
      only one axis to a non-visible value makes the CSS overflow spec
      compute the OTHER axis's used value as "auto" too, which would clip
      either branch's negative "top:-30" bleed against the status bar right
      at this box's own top edge — invisibly reintroducing the exact gap
      that trick exists to remove. Neither branch below actually needs
      horizontal clipping from this ancestor: Examine's own scroll
      container and the landing scene's own scroll region can each own that
      locally if they ever need it.

      Both Examine and the landing scene now sit on the same shared ivory
      canvas (ivBackground) rather than a photo — see the ivory redesign
      pass — so the two still read as one continuous environment, just two
      different depths into it. ── */}

      <AnimatePresence mode="sync" initial={false}>
        {examineTarget ? (
          <motion.div
            key="examine"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }} transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: "easeOut" }}
            // Same full-bleed treatment as the landing scene right below —
            // its own copy of the ivory canvas, bled up behind the status
            // bar, so switching between the two never reveals a mismatched
            // fallback strip either way.
            style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...ivBackground }}
          >
            {/* One scrolling column, edge to edge with the same 30px page
            grid the landing scene uses — everything (Back, the heading,
            every section label, every line of body text) starts at that
            same left edge. className="no-scrollbar" hides the native
            scrollbar (same mechanism Recent Insights/My Mind use) while
            scrolling still works normally. */}
            <div className="no-scrollbar edge-fade" style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0, overflowY: "auto", padding: "34px 30px calc(28px + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
              <span
                role="button" tabIndex={0} aria-label="Back to Analysis" onClick={() => setExamineTarget(null)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExamineTarget(null); } }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, ...sans, fontSize: 13, fontWeight: 700, color: ivBody, cursor: "pointer" }}
              >
                <ArrowLeft size={13} weight="bold" aria-hidden /> Back
              </span>
              <div style={{ ...display, fontSize: 28, fontWeight: 400, color: ivHeading, marginTop: 14 }}>Examine</div>
              <div style={{ ...sans, fontSize: 12, color: ivBody, marginTop: 4, lineHeight: 1.4 }}>
                What the AI has learned about you across your thoughts.
              </div>

              {/* ── The discovery (or a recent insight) as the hero card. ── */}
              <div data-tutorial="today-discovery" style={{ marginTop: 24 }}>
                {examine ? (
                  <ExamineHero
                    kicker={examineTarget === pinnedDiscovery ? "Today's discovery" : "Recent insight"}
                    thoughtLabel={h?.thoughtLabel || b?.thoughtLabel}
                    text={examine.text}
                    confidence={h ? h.confidence : b?.confidence ?? 0}
                    entries={evidence.length}
                    region={examineRegion}
                  />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <svg width="72" height="72" viewBox="0 0 96 96">
                      <circle cx="48" cy="48" r="44" fill="rgba(42,38,33,0.05)" />
                      <circle cx="34" cy="44" r="5" fill={ivFaint} />
                      <circle cx="62" cy="44" r="5" fill={ivFaint} />
                      <path d="M36 60 Q48 68 60 60" stroke={ivFaint} strokeWidth="3" fill="none" strokeLinecap="round" />
                    </svg>
                    <p style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, margin: 0, maxWidth: 280 }}>Nothing discovered yet. It'll show up here after you leave a few thoughts.</p>
                  </div>
                )}
              </div>

              {examine && (
                <>
                  {/* ── Why this reading: your own words, as bubbles. ── */}
                  <ExamineSection region="career" icon={<Quotes size={17} weight="duotone" />} title="Why this reading" subtitle="Things you actually said that point to it.">
                    {evidence.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {evidence.map((e, i) => <EvidenceBubble key={i} index={i} date={e.date} quote={e.quote} domain={e.domain} />)}
                      </div>
                    ) : (
                      <div style={{ ...sans, fontSize: 13, color: ivBody }}>No entries to cite as evidence yet.</div>
                    )}
                    {contradictoryEntries.length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <div style={{ ...sans, fontSize: 13, fontWeight: 600, color: REGION_CONFIG.creativity.ink, textAlign: "right", marginBottom: 8 }}>And some that point the other way</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {contradictoryEntries.map(({ belief, entry }, i) => <EvidenceBubble key={i} index={i} date={entry.date} quote={entry.text} domain={belief.domain} against />)}
                        </div>
                      </div>
                    )}
                  </ExamineSection>

                  {/* ── How it has changed — only when there's a real trail. ── */}
                  {evolutionPoints.length > 0 && (
                    <ExamineSection region="curiosity" icon={<Path size={17} weight="duotone" />} title="How it has changed" subtitle="From the first time it showed up to now.">
                      <EvolutionTimeline points={evolutionPoints} color={REGION_CONFIG[examineRegion].color} />
                    </ExamineSection>
                  )}
                </>
              )}

              {/* ── Where you might be headed — independent of which
              discovery is pinned (inferred from the whole belief set);
              renders nothing until there are enough beliefs. ── */}
              <GoalDirectionsPanel store={store} updateStore={updateStore} />

              {/* ── For where you are now — a literary match. ── */}
              <LiteraryReflectionPanel
                store={store}
                updateStore={updateStore}
                target={b ? { kind: "belief", id: b.id } : hIndex !== null && store.hypotheses[hIndex] ? { kind: "hypothesis", id: store.hypotheses[hIndex].id } : null}
              />

              {/* ── Reflection — does this reading fit? (The "Dig deeper"
              button that used to follow it is gone.) ── */}
              {examine && (
                <div style={{ marginTop: 36, borderRadius: shape.lg, padding: "18px 18px 16px", boxShadow: ivCardShadow, backgroundImage: `linear-gradient(160deg, ${REGION_CONFIG.identity.tint} 0%, #FBF8F2 70%)` }}>
                  <DiscoveryReflection
                    reaction={reaction}
                    reinterpreting={reinterpreting}
                    exhausted={exhausted}
                    onReact={handleReact}
                  />
                </div>
              )}
            </div>
            <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
              <BottomNav active="analysis" onSelect={onNavSelect} vintage />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="landing"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }} transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: "easeOut" }}
            // Bled up by the same 30px the frame's fake status bar reserves
            // — exactly the trick ScreenAnalysis/Mind uses — so the
            // background below reaches all the way to the top of the
            // screen instead of leaving the frame's own fallback color
            // showing through as a strip above the header.
            style={{ position: "absolute", top: -30, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...ivBackground }}
          >
            {/* Header — stationary, over the scene, never scrolls, and
            deliberately not inside a card: the background stays visible
            around it. Shared position/size/spacing with Mind and History's
            own headers (see PRIMARY_HEADER_TOP/SIDE and primaryTitleStyle/
            primaryTitleSubtitleStyle) so "Analysis" carries the same
            visual presence "Mind" and "History" do. */}
            <div style={{ position: "relative", zIndex: 2, flexShrink: 0, padding: `${PRIMARY_HEADER_TOP}px ${PRIMARY_HEADER_SIDE}px 6px`, boxSizing: "border-box" }}>
              <PageTitle tone="identity" title="Mind" subtitle="How close you are, and what's underneath." />
            </div>

            {/* One scrolling composition beneath the header — Today's
            Discovery (the hero card), then Further Insights, in that
            weight, with the background still showing through between them.
            Merging what used to be a pinned discovery panel above an
            independently-scrolling insights list into one shared scroll
            region is also what leaves room for a future Premium
            longitudinal-intelligence section below Further Insights (see
            the brief) without restructuring this again — a new section is
            just another child appended here. */}
            <div className="no-scrollbar edge-fade" style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: `10px ${PRIMARY_HEADER_SIDE}px calc(20px + env(safe-area-inset-bottom))`, boxSizing: "border-box" }}>
              {/* ── Today's Discovery — the dominant object on this screen,
              inside one large ivory SurfaceCard (see DiscoveryCard). ── */}
              {/* The main measure first: the voyage toward who you want to be
              (the same card as Home; tapping it opens the full journey). */}
              <div style={{ marginBottom: 26 }}>
                <VoyageCard
                  closeness={closenessAt(store.history)} change={weekChange(store.history, voyageAnchor(store.history))}
                  steps={stepsSoFar(store.history)} adrift={awayStreak(store.history) >= CURRENT_STREAK}
                  aspiration={store.aspiration} onOpen={() => onOpenArtifact?.("drift")} onSetAspiration={() => onOpenArtifact?.("drift")}
                />
              </div>
              <div data-tutorial="today-discovery">
                {discovery ? (
                  <DiscoveryCard
                    title={discTitle}
                    interpretation={discInterpretation}
                    thoughtCount={discThoughtCount}
                    confidence={discConfidence}
                    region={discRegion}
                    onExamine={() => setExamineTarget(pinnedDiscovery)}
                  />
                ) : (
                  <div style={{ padding: "20px 0", boxSizing: "border-box" }}>
                    <p style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.6, margin: 0 }}>Nothing discovered yet. It'll show up here after you leave a few thoughts.</p>
                  </div>
                )}
              </div>

              {/* ── Insights: three branches around you (InsightsWeb). ── */}
              <div style={{ marginTop: 32 }}>
                <SectionHeading>Insights</SectionHeading>
                <InsightsWeb items={recentInsights} store={store} onOpen={(item) => setExamineTarget(item.target)} />
                {/* The two ways deeper, under the web they belong to (they
                used to sit in a separate "Go deeper" list, beside a third
                link that only repeated the voyage card). */}
                <div style={{ ...quietCard, marginTop: 12 }}>
                  <DiaryLinkCard plain accent="relationships" icon={<ShareNetwork size={17} weight="bold" />} title="All patterns, in detail"
                    badge={store.beliefs.length > 0 ? undefined : "None yet"} onClick={() => onOpenArtifact?.("beliefs")} />
                  {onOpenBrainMap && (
                    <DiaryLinkCard plain divider accent="curiosity" icon={<Sparkle size={17} weight="fill" />} title="See them as your sky"
                      badge={`${store.beliefs.length} ${store.beliefs.length === 1 ? "star" : "stars"}`} onClick={() => onOpenBrainMap()} />
                  )}
                </div>
              </div>


              {/* Structural room for Premium's longitudinal-intelligence
              layer (see the brief's "Today's Discovery → Further Insights →
              Premium deeper interpretation" hierarchy) — intentionally not
              implemented here; a future section drops in below Recent
              Weeks without touching the layout above it. */}
            </div>
            <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
              <BottomNav active="analysis" onSelect={onNavSelect} vintage />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Premium's section header — the gold-caps label + quiet subtitle pattern
// Analysis/Examine already established (see e.g. "WHY THIS INTERPRETATION"),
// reused here instead of SectionCard's white box so every section sits
// directly in the environment. Local to this screen since nowhere else in
// Premium needs a fifth near-identical copy of the same three lines.
// Author portrait registry — author_id (see LiteraryPassage.authorId) →
// imported illustration asset. Only Anaïs Nin has one right now; every
// other author simply has no entry, so LiteraryReflectionPanel quietly
// renders text-only for them instead of needing a special case anywhere.
// Adding a new author's portrait later is one line here, nothing else.
const AUTHOR_PORTRAITS: Record<string, string> = {
  "anais-nin": authorAnaisNinImg,
};

// "For where you are now" — Premium's literary-match feature. The passage
// itself always comes straight from LITERARY_PASSAGES (see
// literaryPassages.ts) — this component's own job is just: compute the
// match when there's meaningfully new data (recompute gated on
// literaryMatchSnapshot, same pattern GoalDirectionsPanel uses for goals,
// so opening Premium repeatedly never reshuffles the passage on its own —
// see the brief's "not: app opened → random new quote"), persist it, and
// render it as a page from a book, not another analytics row.
// The reading is chosen per discovery (belief or hypothesis) and cached
// under that discovery's key with a content signature, so it changes only
// when that discovery's own material changes — see resolveLiterarySelection.
function LiteraryReflectionPanel({ store, updateStore, target }: { store: Store; updateStore: (updater: (prev: Store) => Store) => void; target: LiteraryTarget | null }) {
  const reduceMotion = useReducedMotion();
  const today = formatDateDots(new Date());
  const resolved = target ? resolveLiterarySelection(store, target, today) : null;
  React.useEffect(() => {
    if (!target || (!resolved?.needsSave && !store.literaryMatch)) return;
    updateStore((prev) => {
      const current = resolveLiterarySelection(prev, target, today);
      if (!current.needsSave && !prev.literaryMatch) return prev;
      return { ...prev, literaryMatch: null, literaryMatchSnapshot: undefined, literarySelections: { ...sanitizeLiterarySelections(prev.literarySelections), [current.key]: current.selection } };
    });
  }, [resolved?.key, resolved?.selection.signature, resolved?.needsSave, store.literaryMatch, target, updateStore, today]);

  const match = resolved?.selection.match ?? null;
  // Eligibility is re-checked at display time, old saved selections included.
  const passage = match ? eligiblePassages().find((p) => p.id === match.passageId) ?? null : null;
  const portraitSrc = passage ? AUTHOR_PORTRAITS[passage.authorId] : undefined;
  const fade = { duration: reduceMotion ? 0.01 : 0.6, ease: "easeOut" as const };

  return (
    <div style={{ marginTop: 36 }}>
      {/* Toned down from a full-strength label — smaller, lighter weight,
      slightly dimmed — so it reads as a quiet editorial eyebrow rather
      than a bold warning-style tag. Same horizontal grid as every other
      section here (this div has no side padding/margin of its own,
      inheriting Premium's shared content column). */}
      <ExamineSectionHeader region="relationships" icon={<Feather size={17} weight="duotone" />} title="For where you are now" subtitle="A passage matched to what you've been writing." />
      {/* mode="wait" + a slow fade — this is meant to feel like turning to
      a new page, not a UI state flipping; see the brief's "no flashy
      animation... contemplative." */}
      <AnimatePresence mode="wait" initial={false}>
        {!passage || !match ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            <p style={{ ...display, fontStyle: "italic", fontSize: 20, color: ivBody, lineHeight: 1.55, margin: "18px 0 0", wordBreak: "keep-all" }}>
              Keep writing.
            </p>
            <p style={{ ...sans, fontSize: 13, color: ivFaint, lineHeight: 1.6, margin: "8px 0 0", wordBreak: "keep-all" }}>
              As your mind takes shape here, we'll find something worth reading alongside it.
            </p>
          </motion.div>
        ) : (
          <motion.div key={passage.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}
            style={{ position: "relative", overflow: "hidden", borderRadius: shape.lg, padding: "24px 18px 18px", boxShadow: ivCardShadow, backgroundImage: `linear-gradient(160deg, ${REGION_CONFIG.relationships.tint} 0%, #FBF8F2 55%, #F7EFE3 100%)` }}>
            {/* A large, faint opening quote mark — the page's one ornament. */}
            <span aria-hidden style={{ position: "absolute", top: 4, left: 12, ...display, fontSize: 84, lineHeight: 0.8, color: REGION_CONFIG.relationships.color, opacity: 0.22, pointerEvents: "none" }}>“</span>
            {/* The passage itself — short (every LITERARY_PASSAGES entry is
            excerpt-length, not a paragraph — see literaryPassages.ts),
            smaller and tighter than a pull-quote, no surrounding box, no
            decorative quotation-mark glyphs (italics alone signal "this is
            quoted," the same convention a literary journal uses). */}
            <p style={{ position: "relative", ...display, fontStyle: "italic", fontSize: 20, lineHeight: 1.55, color: ivHeading, margin: "18px 0 0", wordBreak: "keep-all" }}>
              {passage.exactText}
            </p>

            {/* Attribution + a small, quiet portrait sharing one row — the
            portrait no longer has its own footprint in the passage column;
            it just sits beside the author's name, the way a journal might
            set a tiny engraving beside a byline. pointerEvents:"none" and
            no card/circle/border/glow — a bare, softly-masked illustration
            at low opacity, present only when this author has one (see
            AUTHOR_PORTRAITS). Preserved verbatim — no constellation-author
            redesign here, per the brief. */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...display, fontSize: 15, color: ivBody }}>— {passage.author}</div>
                {passage.work && (
                  <div style={{ ...sans, fontSize: 11, color: ivFaint, marginTop: 2 }}>{passage.work}</div>
                )}
              </div>
              {portraitSrc && (
                <img
                  src={portraitSrc}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{
                    width: 46, height: 46, objectFit: "cover", objectPosition: "50% 15%", flexShrink: 0,
                    opacity: 0.85, pointerEvents: "none",
                    WebkitMaskImage: "radial-gradient(circle at 50% 40%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 78%)",
                    maskImage: "radial-gradient(circle at 50% 40%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 78%)",
                  }}
                />
              )}
            </div>

            {/* "Why this found you" — always present, not a disclosure to
            tap open. A quiet ambient observation sitting under the
            attribution, not an interactive "AI explained itself" affordance
            — see the redesign brief. No divider line; the generous margin
            alone separates it from the passage above. */}
            <p style={{ ...sans, fontStyle: "italic", fontSize: 12, color: ivFaint, lineHeight: 1.6, margin: "24px 0 0", wordBreak: "keep-all" }}>
              {buildWhyThisFoundYou(match.themes)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
