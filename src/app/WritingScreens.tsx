import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { REGION_CONFIG } from "./brainRegions";
import { LanguageObservation, Store, StoredAssumption, StoredBelief, StoredHistoryEntry } from "./types";
import { apiUrl } from "./apiBase";
import { closenessAt, entryStep, stepHeadline, type Step } from "./aspirationPath";
import { VoyageCard } from "./Voyage";
import { haptic, isNative, startNativeSpeech, type NativeSpeechSession } from "./native";
import { type EntryMemory, type RecentMood } from "./realStore";
import { Breathe, RevealGroup, RevealItem, SETTLE } from "./motionPrimitives";
import { display, hand, sans } from "./typefaces";
import { ArrowsClockwise, Microphone, X } from "@phosphor-icons/react";
import { AI_CONSENT_COPY, AI_CONSENT_VERSION, isKoreanLocale } from "./aiConsent";
import { comparePronounLean, compareCognitiveVerbTrend, extractCognitiveVerbExamples } from "./cognitiveLexicon";
import { pickInputGuidance } from "./inputGuidance";
import { DiaryNotePaper } from "./diaryPaper";
import { dkBg, dkCard, dkHeading, dkBody, dkBodyLight, dkAccent, dkAccentSoft, dkWarn, dkDivider, ivBg2, ivSurfaceSolid, ivCardShadow, shape, ivHeading, ivBody, ivDivider } from "./screenTheme";
import { loadAnime } from "./animeLoader";
import { PrimaryBtn, GhostBtn, BackButton } from "./screenUI";
import { DataPathIllustration } from "./settingsUI";
import { countUniqueEmotions } from "./emotionGranularity";
import { Emph } from "./insightText";

// ── Screen 5 · Think (record) ─────────────────────────────────────────────────
// The browser's own speech recognizer — no extra API key, but Chrome/Edge/
// Safari only (no Firefox), and audio goes through the browser vendor's
// servers to come back as text. Good enough to make voice input real for a
// minimal version instead of the decorative waveform-only mock it used to be.
function getSpeechRecognitionCtor(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// A small pool of open reflective questions — one is picked at random each
// time this screen opens, instead of a single fixed prompt. Purely a
// client-side placeholder for now ("do not hardcode any example question"
// as the long-term goal): later this pool should come from the backend so
// it can adapt to what someone's actually been thinking about, but picking
// randomly + never repeating the immediately-prior one is what keeps it
// from feeling like a static form label in the meantime.
const THINK_PROMPTS = [
  "What thought stuck with you the longest today?",
  "Is there a thought that keeps circling in your head?",
  "What was on your mind the most today?",
  "What did you say to yourself the most today?",
  "What's the thought you can't quite resolve right now?",
  "When did your emotions shift the most today?",
];

let lastThinkPromptIndex = -1;
function pickThinkPrompt() {
  if (THINK_PROMPTS.length <= 1) return THINK_PROMPTS[0];
  let idx = Math.floor(Math.random() * THINK_PROMPTS.length);
  if (idx === lastThinkPromptIndex) idx = (idx + 1) % THINK_PROMPTS.length;
  lastThinkPromptIndex = idx;
  return THINK_PROMPTS[idx];
}

// Live mic volume (0..1), sampled via Web Audio while `active`, driven
// entirely through a ref rather than React state — the waveform reads it
// 60x/sec and state updates at that rate would just cause needless
// re-renders. Fails silently (waveform stays calm/flat) if mic access is
// denied or unavailable; speech recognition itself has its own separate
// permission flow and keeps working either way.
function useMicLevel(active: boolean) {
  const levelRef = React.useRef(0);
  React.useEffect(() => {
    if (!active) {
      levelRef.current = 0;
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sumSquares = 0;
          for (let i = 0; i < data.length; i += 1) {
            const v = (data[i] - 128) / 128;
            sumSquares += v * v;
          }
          const rms = Math.sqrt(sumSquares / data.length);
          levelRef.current = Math.min(1, rms * 4);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Mic permission denied/unavailable — leave levelRef at 0 (calm/flat).
      }
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
  }, [active]);
  return levelRef;
}

// Apple Voice Memos-style: thin, soft, single-color bars nudged by the
// live mic level plus a gentle per-bar phase offset so they ripple instead
// of moving in lockstep — never a colorful/equalizer look. Heights are
// written straight to the DOM every frame (not through React state) to
// stay smooth at 60fps.
const WAVEFORM_BAR_COUNT = 26;
function VoiceWaveform({ levelRef }: { levelRef: React.MutableRefObject<number> }) {
  const barsRef = React.useRef<(HTMLDivElement | null)[]>([]);
  const smoothedRef = React.useRef<number[]>(Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0));
  const phasesRef = React.useRef<number[]>(Array.from({ length: WAVEFORM_BAR_COUNT }, () => Math.random() * Math.PI * 2));

  React.useEffect(() => {
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.05;
      const level = levelRef.current;
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        const jitter = Math.sin(t * 2 + phasesRef.current[i]) * 0.15 + 0.85;
        const target = 0.1 + level * jitter * 0.9;
        smoothedRef.current[i] += (target - smoothedRef.current[i]) * 0.22;
        el.style.height = `${3 + smoothedRef.current[i] * 20}px`;
        el.style.opacity = String(0.3 + smoothedRef.current[i] * 0.55);
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 24 }}>
      {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          style={{ width: 3, borderRadius: 2, backgroundColor: LAMP, boxShadow: `0 0 6px ${LAMP}88`, height: 3, opacity: 0.3 }}
        />
      ))}
    </div>
  );
}

// The mic button, redesigned to feel like a quiet living thing rather than
// a UI control: a soft glowing orb that breathes on its own (scale
// 1.00→1.04 every ~2.5s) so it never needs a "tap to start" caption to
// explain itself. Recording shifts the same breathing to a warmer glow and
// a slightly quicker pulse — still smooth, never flashy.
function NeuronOrb({ recording, onClick }: { recording: boolean; onClick: () => void }) {
  // Lamp gold while waiting (with a microphone), rose while listening (with
  // a stop square), and a soft ring of light breathing around it.
  const c = recording ? REGION_CONFIG.relationships : null;
  return (
    <motion.div
      role="button" tabIndex={0} aria-label={recording ? "Stop" : "Start talking"}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      whileTap={{ scale: 0.94 }}
      animate={{ scale: recording ? [1, 1.06, 1] : [1, 1.04, 1] }}
      transition={{ duration: recording ? 1.7 : 2.5, repeat: Infinity, ease: "easeInOut" }}
      style={{
        position: "relative", width: 76, height: 76, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        color: recording ? "#FFFFFF" : "#3A2508",
        backgroundImage: recording ? `radial-gradient(circle at 32% 28%, ${c!.color}, ${c!.ink})` : `radial-gradient(circle at 32% 28%, #FBE3AE, ${LAMP} 55%, #D9973F)`,
        boxShadow: recording ? `0 0 34px -4px ${c!.color}, inset 0 1px 0 rgba(255,255,255,0.35)` : `0 0 34px -6px ${LAMP}, inset 0 1px 0 rgba(255,255,255,0.5)`,
      }}
    >
      <motion.span aria-hidden
        animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.45, 1] }} transition={{ duration: recording ? 1.4 : 2.6, repeat: Infinity, ease: "easeOut" }}
        style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${recording ? c!.color : LAMP}` }} />
      {recording ? <span style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: "#FFFFFF" }} /> : <Microphone size={28} weight="fill" />}
    </motion.div>
  );
}

// ── The night desk ───────────────────────────────────────────────────────────
// Where "Speak your mind" happens: a window of night sky (fixed stars, a
// third of them twinkling on the shared .twinkle CSS) and the warm pool of
// a desk lamp falling on the page. Everything on it is lit by that lamp:
// the date in gold hand, the prompt on a sticky note, a cloth "Done" tab.
const DESK_STARS = Array.from({ length: 40 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 91.17 + n * 47.31) * 24634.6345) % 1 + 1) % 1;
  return { x: r(1) * 100, y: r(2) * 100, s: r(3) < 0.12 ? 2.2 : r(3) < 0.45 ? 1.4 : 1, o: 0.25 + r(4) * 0.55, tw: i % 3 === 0, d: 2.5 + r(5) * 3, dl: r(6) * 4 };
});
const LAMP = "#F6C978";
const LAMP_TEXT = "#F2DDB2";

function NightDeskBackdrop() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none",
      backgroundImage: "linear-gradient(180deg, #17142F 0%, #221C45 55%, #2B2149 100%)" }}>
      <div style={{ position: "absolute", left: "-20%", right: "-20%", top: "8%", height: "26%", transform: "rotate(-12deg)", filter: "blur(10px)",
        backgroundImage: "linear-gradient(180deg, transparent, rgba(200,190,255,0.07) 45%, rgba(255,220,240,0.05) 60%, transparent)" }} />
      {DESK_STARS.map((st, i) => (
        <span key={i} className={st.tw && !reduce ? "twinkle" : undefined}
          style={{ position: "absolute", left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, borderRadius: "50%", backgroundColor: "#fff", opacity: st.o,
            boxShadow: st.s > 2 ? "0 0 6px rgba(255,255,255,0.8)" : undefined,
            ["--tw-dur" as string]: `${st.d}s`, ["--tw-delay" as string]: `-${st.dl}s` } as React.CSSProperties} />
      ))}
      {/* The lamp's light on the desk, warm and centred behind the page. */}
      <div style={{ position: "absolute", left: "50%", top: "32%", width: "150%", height: "75%", transform: "translateX(-50%)",
        backgroundImage: `radial-gradient(closest-side, ${LAMP}38, ${LAMP}14 55%, transparent)` }} />
    </div>
  );
}

// A round, frosted button for the night desk's top bar.
const deskIconBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%", border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  color: LAMP_TEXT, backgroundColor: "rgba(255,255,255,0.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
  backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", WebkitTapHighlightColor: "transparent",
};

// ── You, writing it down ─────────────────────────────────────────────────────
// The voice screen's picture: an open diary under the lamp. While you talk
// a pen writes your words into it, line after line, then the page settles
// and it starts again; while waiting, the pen rests on a half-written page.
// Lines are fixed squiggles (deterministic), drawn with pathLength.
function scribble(x0: number, x1: number, y: number, seed: number) {
  let d = `M${x0} ${y}`;
  let x = x0;
  let k = seed;
  while (x < x1 - 4) {
    k = (k * 9301 + 49297) % 233280;
    const step = 5 + (k % 5);
    const h = 2.2 + ((k >> 3) % 4) * 0.9;
    d += ` q${(step / 2).toFixed(1)} ${(-h).toFixed(1)} ${step} 0`;
    x += step;
    if (k % 7 === 0 && x < x1 - 14) { d += ` m5 0`; x += 5; }
  }
  return d;
}
const DIARY_LINES = [0, 1, 2, 3].map((i) => ({ y: 58 + i * 17, x0: 142, x1: i === 3 ? 196 : 222, d: scribble(142, i === 3 ? 196 : 222, 58 + i * 17, 11 + i * 7) }));
const DIARY_LEFT_LINES = [0, 1, 2, 3, 4].map((i) => scribble(42, i === 4 ? 92 : 118, 50 + i * 17, 3 + i * 5));

function DiaryWritingScene({ writing }: { writing: boolean }) {
  const reduce = useReducedMotion();
  const ink = REGION_CONFIG.identity.ink;
  const LINE = 1.5, CYCLE = DIARY_LINES.length * LINE + 1.2;
  const animate = writing && !reduce;
  // Pen tip keyframes: along each line in turn, then lifted back to the top.
  const xs: number[] = [], ys: number[] = [], times: number[] = [];
  DIARY_LINES.forEach((l, i) => {
    xs.push(l.x0, l.x1); ys.push(l.y, l.y);
    times.push((i * LINE) / CYCLE, ((i + 1) * LINE - 0.15) / CYCLE);
  });
  xs.push(DIARY_LINES[0].x0); ys.push(DIARY_LINES[0].y - 14); times.push(1);
  const rest = { x: 204, y: 108 };
  return (
    <svg viewBox="0 0 260 176" role="img" aria-label={writing ? "A pen writing in your diary as you talk" : "Your diary, open, with a pen resting on it"} style={{ width: "100%", maxWidth: 300, height: "auto", display: "block", overflow: "visible" }}>
      <defs>
        <radialGradient id="dws-lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor={LAMP} stopOpacity="0.45" /><stop offset="1" stopColor={LAMP} stopOpacity="0" /></radialGradient>
        <linearGradient id="dws-l" x1="0" x2="1"><stop offset="0" stopColor="#F3E7CF" /><stop offset="1" stopColor="#FFF9EC" /></linearGradient>
        <linearGradient id="dws-r" x1="0" x2="1"><stop offset="0" stopColor="#FFF9EC" /><stop offset="1" stopColor="#F6EBD3" /></linearGradient>
      </defs>
      <ellipse cx="130" cy="92" rx="130" ry="84" fill="url(#dws-lamp)" />
      {/* Cover peeking out under the pages, and its ribbon. */}
      <path d="M20 40 Q130 26 240 40 L246 150 Q130 138 14 150 Z" fill={REGION_CONFIG.relationships.ink} />
      <path d="M128 140 L128 170 L133 164 L138 170 L138 140 Z" fill={REGION_CONFIG.career.color} />
      {/* The two pages, bowing toward the spine. */}
      <path d="M26 36 Q78 28 130 40 L130 146 Q78 134 22 144 Z" fill="url(#dws-l)" />
      <path d="M130 40 Q182 28 234 36 L238 144 Q182 134 130 146 Z" fill="url(#dws-r)" />
      <path d="M130 40 L130 146" stroke="rgba(90,60,30,0.25)" strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} stroke={REGION_CONFIG.curiosity.color} strokeOpacity="0.25" strokeWidth="0.8">
          <path d={`M38 ${52 + i * 17} Q80 ${48 + i * 17} 122 ${52 + i * 17}`} fill="none" />
          <path d={`M138 ${52 + i * 17} Q180 ${48 + i * 17} 228 ${52 + i * 17}`} fill="none" />
        </g>
      ))}
      {/* Yesterday's page, already written. */}
      {DIARY_LEFT_LINES.map((d, i) => <path key={i} d={d} fill="none" stroke={ink} strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round" />)}
      {/* Today's page, being written. */}
      {DIARY_LINES.map((l, i) => (
        <motion.path key={`${i}${animate}`} d={l.d} fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round"
          initial={{ pathLength: animate ? 0 : i < 2 ? 1 : 0 }}
          animate={animate ? { pathLength: [0, 0, 1, 1, 0] } : { pathLength: i < 2 ? 1 : 0 }}
          transition={animate ? { duration: CYCLE, repeat: Infinity, times: [0, (i * LINE) / CYCLE, ((i + 1) * LINE - 0.15) / CYCLE, 0.96, 1], ease: "linear" } : { duration: 0 }} />
      ))}
      {/* The pen: its nib at (0,0), body angled up and to the right. */}
      <motion.g
        key={animate ? "writing" : "resting"}
        initial={animate ? { x: xs[0], y: ys[0] } : { x: rest.x, y: rest.y }}
        animate={animate ? { x: xs, y: ys } : { x: rest.x, y: rest.y }}
        transition={animate ? { duration: CYCLE, repeat: Infinity, times, ease: "linear" } : { type: "spring", stiffness: 120, damping: 16 }}>
        <motion.g animate={animate ? { rotate: [0, -4, 0, 3, 0] } : { rotate: 0 }} transition={animate ? { duration: 0.35, repeat: Infinity } : undefined}>
          <g transform="rotate(-38)">
            <path d="M0 0 L-3 -9 L3 -9 Z" fill="#E6C27A" />
            <rect x="-4" y="-13" width="8" height="5" rx="1" fill="#C9A24E" />
            <rect x="-4.5" y="-58" width="9" height="46" rx="4.5" fill={REGION_CONFIG.identity.color} />
            <rect x="-4.5" y="-58" width="3" height="46" rx="1.5" fill="#FFFFFF" opacity="0.35" />
            <rect x="-5" y="-40" width="10" height="3" fill="#E6C27A" />
          </g>
        </motion.g>
      </motion.g>
    </svg>
  );
}

export function ScreenThink({ onDone, onBack, mood }: { onDone?: (text: string) => void; onBack?: () => void; mood?: string | null }) {
  const [recording, setRecording] = React.useState(false);
  // Text-first: voice self-reports lower self-disclosure than text at the
  // same response length (perceived anonymity drops with voice) — text is
  // the default, voice is the opt-in via the toggle below, not the other
  // way around.
  const [textMode, setTextMode] = React.useState(true);
  const [text, setText] = React.useState("");
  // Coming from Home's "Say why" after a check-in, the first prompt is about
  // that feeling; "Another prompt" goes back to the usual ones.
  const [promptHint, setPromptHint] = React.useState(() => (mood ? `You said you feel ${mood.toLowerCase()}. What's behind it?` : pickThinkPrompt()));
  const [transcript, setTranscript] = React.useState("");
  const [interim, setInterim] = React.useState("");
  const [micError, setMicError] = React.useState<string | null>(null);
  // The web's speech API, or on the iOS app the system recogniser (native.ts).
  const voiceSupportedRef = React.useRef(!!getSpeechRecognitionCtor() || isNative);
  const nativeSpeechRef = React.useRef<NativeSpeechSession | null>(null);
  const recognitionRef = React.useRef<any>(null);
  // On iOS the recogniser owns the microphone and reports its own level.
  const micLevelRef = useMicLevel(recording && !isNative);
  const manualStopRef = React.useRef(false);
  // Guards the transition out of this screen — without it, a fast double
  // tap on "Next" (or on the orb to stop recording) before the parent's
  // setScreen("processing") actually commits could fire onDone twice,
  // queuing the same entry for analysis twice. Once tripped, both submit
  // paths below are inert and the button renders disabled.
  const [submitted, setSubmitted] = React.useState(false);
  // Authoritative running transcript, mirrors the `transcript` state but
  // read synchronously (state set via a functional updater isn't
  // guaranteed to be visible in the same tick, and the silence-watcher
  // below needs the current value the instant it fires).
  const finalTranscriptRef = React.useRef("");

  // INPUT-role silence guidance (see inputGuidance.ts) — a few seconds of
  // no new input fades in one short line. `lastActivityAt`/`latestText` are
  // refs, not state, so the watcher interval below never closes over a
  // stale value; `inputGuidance` itself is the only piece that needs to
  // trigger a render.
  const [inputGuidance, setInputGuidance] = React.useState<string | null>(null);
  const lastActivityRef = React.useRef(Date.now());
  const latestTextRef = React.useRef("");
  const guidanceShownRef = React.useRef(false);
  const guidanceDelayRef = React.useRef<any>(null);

  const noteActivity = (currentText: string) => {
    latestTextRef.current = currentText;
    lastActivityRef.current = Date.now();
    guidanceShownRef.current = false;
    setInputGuidance(null);
    if (guidanceDelayRef.current) { clearTimeout(guidanceDelayRef.current); guidanceDelayRef.current = null; }
  };

  React.useEffect(() => () => { manualStopRef.current = true; recognitionRef.current?.stop?.(); nativeSpeechRef.current?.stop(); }, []);

  // Guidance only applies while input is actually expected — typing (text
  // mode, whether or not anything's written yet) or actively recording.
  // Switching modes or starting a fresh recording resets the silence clock.
  React.useEffect(() => {
    lastActivityRef.current = Date.now();
    guidanceShownRef.current = false;
    setInputGuidance(null);
  }, [textMode, recording]);

  React.useEffect(() => {
    const active = textMode || recording;
    if (!active) return;
    const watcher = setInterval(() => {
      if (guidanceShownRef.current) return;
      if (Date.now() - lastActivityRef.current >= 5000) {
        guidanceShownRef.current = true;
        // Async fade-in delay — the prompt doesn't snap in the instant the
        // threshold crosses, so it never reads as a timer going off.
        guidanceDelayRef.current = setTimeout(() => {
          setInputGuidance(pickInputGuidance(latestTextRef.current));
        }, 700);
      }
    }, 1000);
    return () => { clearInterval(watcher); if (guidanceDelayRef.current) clearTimeout(guidanceDelayRef.current); };
  }, [textMode, recording]);

  const startRecording = () => {
    setTranscript("");
    setInterim("");
    setMicError(null);
    finalTranscriptRef.current = "";
    haptic("press");
    if (isNative) {
      setRecording(true);
      startNativeSpeech({
        onText: (t) => { finalTranscriptRef.current = t; setTranscript(t); noteActivity(t); },
        onLevel: (l) => { micLevelRef.current = l; },
        onError: (msg) => { setMicError(msg); setRecording(false); nativeSpeechRef.current?.stop(); nativeSpeechRef.current = null; },
      }).then((session) => {
        if (!session) { setRecording(false); return; }
        nativeSpeechRef.current = session;
      });
      return;
    }
    const SR = getSpeechRecognitionCtor();
    if (SR) {
      manualStopRef.current = false;
      const recognition = new SR();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (e: any) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalChunk += r[0].transcript;
          else interimChunk += r[0].transcript;
        }
        if (finalChunk) {
          finalTranscriptRef.current = (finalTranscriptRef.current ? finalTranscriptRef.current + " " : "") + finalChunk.trim();
          setTranscript(finalTranscriptRef.current);
        }
        setInterim(interimChunk);
        noteActivity((finalTranscriptRef.current + (interimChunk ? " " + interimChunk : "")).trim());
      };
      recognition.onerror = (e: any) => {
        // Fatal errors (mic denied, no mic, offline): stop retrying instead
        // of looping start/stop forever. "no-speech" is not fatal — it just
        // means a silent gap, so let onend's restart handle that one.
        if (["not-allowed", "audio-capture", "network", "service-not-allowed"].includes(e?.error)) {
          manualStopRef.current = true;
          setRecording(false);
          setMicError(
            e.error === "not-allowed" || e.error === "service-not-allowed"
              ? "Microphone access was denied. Allow it in your browser's settings, or use \"Write instead.\""
              : e.error === "audio-capture"
              ? "No microphone was found. Please use \"Write instead.\""
              : "A network issue interrupted voice recognition. Please try again or use \"Write instead.\""
          );
        }
      };
      recognition.onend = () => {
        if (!manualStopRef.current) {
          try { recognition.start(); } catch { /* already stopped for good */ }
        }
      };
      recognitionRef.current = recognition;
      try { recognition.start(); } catch { /* ignore */ }
    }
    setRecording(true);
  };

  const stopRecording = () => {
    if (submitted) return;
    setSubmitted(true);
    haptic("press");
    if (nativeSpeechRef.current) {
      const session = nativeSpeechRef.current;
      nativeSpeechRef.current = null;
      setRecording(false);
      session.stop().then((t) => onDone?.((t || finalTranscriptRef.current).trim()));
      return;
    }
    manualStopRef.current = true;
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setRecording(false);
    const finalText = (transcript + (interim ? " " + interim : "")).trim();
    setInterim("");
    onDone?.(finalText);
  };

  // Compose pattern after Apple Journal / Day One: the entry's primary
  // action lives in the header, where the keyboard can never cover it —
  // a bottom button on a phone is hidden the moment you start typing.
  const canSubmit = !!text.trim() && !submitted;
  const submitText = () => { if (!canSubmit) return; haptic("press"); setSubmitted(true); onDone?.(text.trim()); };
  const entryStamp = React.useMemo(() => new Date().toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), []);
  const iconBtn: React.CSSProperties = { border: 0, background: "transparent", padding: 6, margin: -6, cursor: "pointer", lineHeight: 0, WebkitTapHighlightColor: "transparent" };
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#17142F", overflow: "hidden" }}>
      <NightDeskBackdrop />
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px 0", minHeight: 46 }}>
        <motion.button type="button" aria-label={recording ? "Stop and discard" : "Cancel"} onClick={onBack} whileTap={{ scale: 0.9 }} style={deskIconBtn}>
          <X size={17} weight="bold" />
        </motion.button>
        {/* When this was said, written like a diary's dateline. */}
        <span style={{ ...hand, fontSize: 19, fontWeight: 600, color: LAMP_TEXT, textShadow: `0 0 12px ${LAMP}55` }}>{entryStamp}</span>
        {textMode ? (
          <Breathe inline amount={1.05} active={canSubmit}>
            <motion.button
              type="button" disabled={!canSubmit} onClick={submitText}
              whileTap={canSubmit ? { scale: 0.95, opacity: 0.85 } : undefined} transition={SETTLE}
              style={{
                position: "relative", ...hand, fontSize: 20, fontWeight: 700, lineHeight: 1, border: 0, borderRadius: 12, padding: "8px 16px", minHeight: 36,
                color: canSubmit ? "#3A2508" : "rgba(242,221,178,0.45)", cursor: canSubmit ? "pointer" : "default", WebkitTapHighlightColor: "transparent",
                backgroundColor: canSubmit ? LAMP : "rgba(255,255,255,0.07)",
                backgroundImage: canSubmit ? `linear-gradient(135deg, #FBE0A6, ${LAMP} 55%, #E3A94F)` : "none",
                boxShadow: canSubmit ? `0 8px 18px -8px ${LAMP}, inset 0 1px 0 rgba(255,255,255,0.5)` : "inset 0 0 0 1px rgba(255,255,255,0.1)",
                transition: "background-color 0.25s, color 0.25s",
              }}
            >
              <span aria-hidden style={{ position: "absolute", inset: 3, borderRadius: 9, border: `1.2px dashed ${canSubmit ? "rgba(90,55,10,0.4)" : "rgba(255,255,255,0.12)"}`, pointerEvents: "none" }} />
              Done
            </motion.button>
          </Breathe>
        ) : !recording ? (
          <Breathe inline amount={1.06}>
            <motion.span role="button" tabIndex={0} onClick={() => { setTextMode(true); setMicError(null); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTextMode(true); setMicError(null); } }} whileTap={{ opacity: 0.6 }} style={{ ...hand, fontSize: 20, fontWeight: 600, color: LAMP_TEXT, cursor: "pointer" }}>
              Write instead
            </motion.span>
          </Breathe>
        ) : (
          <span style={{ width: 32 }} />
        )}
      </div>

      {textMode ? (
        <>
          <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, padding: "18px 20px 16px", display: "flex", flexDirection: "column" }}>
            {/* The prompt is its own object above the entry, not a
            placeholder that vanishes at the first keystroke — it stays
            while you write, and can be swapped for another. */}
            {/* The prompt, on a sticky note stuck to the desk above the page. */}
            <div style={{
              position: "relative", display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 12px 12px 16px", borderRadius: "4px 4px 14px 4px", flexShrink: 0,
              transform: "rotate(-1.2deg)", marginRight: 18,
              backgroundColor: "#FFF1B8", backgroundImage: "linear-gradient(170deg, #FFF6CF 0%, #FFEDA8 70%, #F8DF8E 100%)",
              boxShadow: `0 12px 22px -12px rgba(0,0,0,0.55), 0 0 30px -10px ${LAMP}`,
            }}>
              <span aria-hidden style={{ position: "absolute", top: -7, left: "50%", marginLeft: -26, width: 52, height: 15, transform: "rotate(3deg)", opacity: 0.85,
                backgroundImage: `repeating-linear-gradient(45deg, ${REGION_CONFIG.relationships.color}aa 0 6px, ${REGION_CONFIG.relationships.tint} 6px 12px)` }} />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={promptHint} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} style={{ ...hand, fontSize: 21, fontWeight: 600, lineHeight: 1.2, color: "#4A3A14", flex: 1, wordBreak: "keep-all" }}>
                  {promptHint}
                </motion.div>
              </AnimatePresence>
              <Breathe inline amount={1.1} style={{ lineHeight: 0 }}>
                <motion.button type="button" aria-label="Another prompt" onClick={() => setPromptHint(pickThinkPrompt())} whileTap={{ rotate: 180, opacity: 0.7 }} transition={{ duration: 0.3 }} style={{ ...iconBtn, color: "#8A6A22", marginTop: -3 }}>
                  <ArrowsClockwise size={15} />
                </motion.button>
              </Breathe>
            </div>
            {/* Your page — an open diary on the night desk. */}
            <DiaryNotePaper
              autoFocus fill value={text} onChange={(v) => { setText(v); noteActivity(v); }}
              placeholder="Write whatever feels natural." ariaLabel="Speak your mind"
              style={{ marginTop: 22 }}
            />
            <AnimatePresence>
              {inputGuidance && (
                <motion.div
                  key={inputGuidance}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ ...hand, fontSize: 19, color: LAMP_TEXT, marginTop: 10, marginBottom: 4, lineHeight: 1.25, wordBreak: "keep-all" }}
                >
                  {inputGuidance}
                </motion.div>
              )}
            </AnimatePresence>
            {/* Only offered where this device can turn speech into text
                (the iOS app's web view can't, so it simply isn't shown). */}
            {voiceSupportedRef.current && <div style={{ display: "flex", paddingTop: 10, flexShrink: 0 }}>
              <Breathe inline amount={1.05}>
                <motion.button
                  type="button" onClick={() => { setTextMode(false); setMicError(null); }} whileTap={{ scale: 0.95, opacity: 0.8 }} transition={SETTLE}
                  style={{
                    ...hand, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 19, fontWeight: 600, lineHeight: 1, color: LAMP_TEXT,
                    backgroundColor: "rgba(255,255,255,0.07)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
                    border: 0, borderRadius: shape.full, padding: "5px 14px 5px 5px", cursor: "pointer", WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span style={{ width: 26, height: 26, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff",
                    backgroundImage: `radial-gradient(circle at 32% 28%, ${REGION_CONFIG.relationships.color}, ${REGION_CONFIG.relationships.ink})`, boxShadow: `0 0 12px -2px ${REGION_CONFIG.relationships.color}` }}>
                    <Microphone size={14} weight="fill" />
                  </span>
                  Use voice instead
                </motion.button>
              </Breathe>
            </div>}
          </div>
        </>
      ) : (
        <>
          <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px" }}>
            <AnimatePresence mode="wait">
              {!recording ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  // Fast exit: this runs right after tapping record, and
                  // the recording UI can't appear until it's done.
                  exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}
                >
                  <div style={{ width: "100%", marginBottom: 18 }}><DiaryWritingScene writing={false} /></div>
                  <div style={{ ...display, fontSize: 22, color: dkHeading, textAlign: "center", lineHeight: 1.6, wordBreak: "keep-all" }}>
                    Speak freely.<br />You don't need to organize your thoughts.
                  </div>
                  <div style={{ ...hand, fontSize: 21, fontWeight: 600, color: LAMP_TEXT, textAlign: "center", marginTop: 14, lineHeight: 1.25, wordBreak: "keep-all", minHeight: 20 }}>
                    {promptHint}
                  </div>
                  {!voiceSupportedRef.current && (
                    <div style={{ ...sans, fontSize: 12, color: dkWarn, textAlign: "center", marginTop: 18, lineHeight: 1.6, wordBreak: "keep-all" }}>
                      Voice input isn't available on this device. Tap "Write instead."
                    </div>
                  )}
                  {micError && (
                    <div style={{ ...sans, fontSize: 12, color: dkWarn, textAlign: "center", marginTop: 18, lineHeight: 1.6, wordBreak: "keep-all" }}>
                      {micError}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="recording"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}
                >
                  <div style={{ width: "100%", marginBottom: 18 }}><DiaryWritingScene writing /></div>
                  <div style={{ ...display, fontSize: 24, color: dkHeading, textAlign: "center" }}>Listening…</div>
                  <div style={{ ...hand, fontSize: 21, fontWeight: 600, color: LAMP_TEXT, textAlign: "center", marginTop: 12, lineHeight: 1.25, wordBreak: "keep-all" }}>
                    Say whatever comes to mind.
                  </div>
                  {/* No live transcript here on purpose — watching your own
                      words appear in real time is its own kind of self-
                      editing pressure (perceived anonymity drops sharply
                      once you can see exactly what's being captured).
                      `transcript`/`interim` are still tracked and used once
                      recording stops; they're just not rendered while it's
                      running. */}
                  <AnimatePresence>
                    {inputGuidance && (
                      <motion.div
                        key={inputGuidance}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        style={{ ...sans, fontSize: 13, color: dkBodyLight, textAlign: "center", marginTop: 22, lineHeight: 1.6, wordBreak: "keep-all", maxWidth: 260 }}
                      >
                        {inputGuidance}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div style={{ position: "relative", zIndex: 1, padding: "0 32px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            {recording && <VoiceWaveform levelRef={micLevelRef} />}
            <NeuronOrb recording={recording} onClick={() => (recording ? stopRecording() : startRecording())} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Screen 6 · Processing ─────────────────────────────────────────────────────
// When real typed text is present, this screen actually calls the analysis
// endpoint (server-side LLM call) instead of just running a fixed timer —
// the timer stays as pacing for the still-unimplemented voice/STT path.
// A hung /api/analyze call (slow model, a network stall that never
// actually errors) used to strand the user here indefinitely — no
// AbortController/timeout anywhere in the request, and this screen had no
// back button or cancel affordance. ANALYZE_TIMEOUT_MS bounds the wait;
// past that, the request is aborted and routed through the same onError
// path a real failure already uses. CANCEL_AFFORDANCE_DELAY_MS is
// separate and shorter — gives an impatient (not necessarily stuck) user
// a way out well before the hard timeout, without asserting anything is
// actually wrong.
const ANALYZE_TIMEOUT_MS = 25000;
const CANCEL_AFFORDANCE_DELAY_MS = 6000;

// A small, deterministic node-and-link cluster around a center "seed" —
// the same visual grammar as the Brain Map's own star field and the
// onboarding ripple (MINI_BRAIN_DOTS), scaled down to a single focal
// moment. Not decoration: the processing screen's own copy says
// "Connecting it to past conversations" — this animates that literal
// claim instead of showing an unrelated generic spinner.
const PROCESSING_SATELLITES = [
  { x: 27, y: 37 },
  { x: 73, y: 34 },
  { x: 33, y: 73 },
  { x: 70, y: 71 },
];

function ProcessingConstellation({ step, reducedMotion }: { step: number; reducedMotion: boolean }) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const seedRef = React.useRef<SVGCircleElement>(null);

  // Step 0 "Listening": just the seed, breathing — nothing to connect to
  // yet. Declarative Motion loop, consistent with how the rest of this
  // file handles simple infinite idle states.
  React.useEffect(() => {
    if (!seedRef.current) return;
    if (reducedMotion) {
      seedRef.current.style.opacity = "1";
      return;
    }
    const seed = seedRef.current;
    let cancelled = false;
    let controls: { pause: () => unknown } | undefined;
    void loadAnime().then(({ animate }) => {
      if (cancelled) return;
      controls = animate(seed, {
        scale: [{ to: 1.25, duration: 900, ease: "inOutSine" }, { to: 1, duration: 900, ease: "inOutSine" }],
        loop: true,
      });
    });
    return () => { cancelled = true; controls?.pause(); };
  }, [reducedMotion]);

  // Step 1 "Connecting it to past conversations": satellites and their
  // links to the seed draw in together, staggered outward — the one-shot
  // authored moment this screen earns. pathLength=1 on each <line> lets
  // the dash animation work without computing real pixel lengths.
  React.useEffect(() => {
    if (step !== 1 || !svgRef.current) return;
    const links = svgRef.current.querySelectorAll<SVGLineElement>(".link");
    const satellites = svgRef.current.querySelectorAll<SVGCircleElement>(".satellite");
    if (reducedMotion) {
      links.forEach((l) => { l.style.opacity = "1"; l.style.strokeDashoffset = "0"; });
      satellites.forEach((s) => { s.style.opacity = "1"; });
      return;
    }
    let cancelled = false;
    void loadAnime().then(({ animate, stagger }) => {
      if (cancelled) return;
      animate(links, {
        opacity: [0, 1],
        strokeDashoffset: [1, 0],
        duration: 500,
        delay: stagger(90),
        ease: "outQuad",
      });
      animate(satellites, {
        opacity: [0, 1],
        scale: [0.4, 1],
        duration: 400,
        delay: stagger(90, { start: 120 }),
        ease: "outBack",
      });
    });
    return () => { cancelled = true; };
  }, [step, reducedMotion]);

  // Step 2 "Double-checking the pattern": everything that's now connected
  // settles into one synchronized soft pulse — "the pattern is confirmed,"
  // not a new idle state fighting the step-0 seed breathing above.
  React.useEffect(() => {
    if (step !== 2 || !svgRef.current || reducedMotion) return;
    const all = svgRef.current.querySelectorAll<SVGElement>(".seed, .satellite");
    let cancelled = false;
    void loadAnime().then(({ animate }) => {
      if (cancelled) return;
      animate(all, {
        opacity: [{ to: 1, duration: 260 }, { to: 0.75, duration: 500 }, { to: 1, duration: 500 }],
        ease: "inOutSine",
      });
    });
    return () => { cancelled = true; };
  }, [step, reducedMotion]);

  return (
    <svg ref={svgRef} width="68" height="68" viewBox="0 0 100 100" aria-hidden="true">
      {PROCESSING_SATELLITES.map((p, i) => (
        <line key={i} className="link" x1={50} y1={50} x2={p.x} y2={p.y} stroke={dkAccent} strokeWidth="1.5" opacity={step >= 1 ? 1 : 0} pathLength={1} strokeDasharray={1} strokeDashoffset={step >= 1 ? 0 : 1} />
      ))}
      {PROCESSING_SATELLITES.map((p, i) => (
        <circle key={i} className="satellite" cx={p.x} cy={p.y} r={3.2} fill={dkAccent} opacity={step >= 1 ? 1 : 0} />
      ))}
      <circle ref={seedRef} className="seed" cx={50} cy={50} r={5} fill={dkAccent} style={{ filter: `drop-shadow(0 0 6px ${dkAccentSoft})`, transformOrigin: "50px 50px" }} />
    </svg>
  );
}

export function ScreenProcessing({
  text,
  matchableBeliefs,
  matchablePending,
  priorAssumptions,
  priorConnections,
  aspiration,
  name,
  recentMoods,
  recentEntries,
  onDone,
  onError,
  onCancel,
}: {
  text?: string;
  matchableBeliefs?: Pick<StoredBelief, "id" | "domain" | "statement" | "confidence">[];
  matchablePending?: { id: string; domain: string; statement: string }[];
  priorAssumptions?: StoredAssumption[];
  priorConnections?: { aStatement: string; bStatement: string; note: string }[];
  aspiration?: string | null;
  // Distanced self-talk (Kross & Ayduk) needs a name or "you" to reframe
  // toward — undefined for guests, who get the 2nd-person fallback server-side.
  name?: string;
  // Check-ins from the last few hours (see recentMoodContext), sent as
  // background for reading this entry's feelings.
  recentMoods?: RecentMood[];
  // The last few entries as short gists (recentEntryMemory), so the
  // analysis can tell "this again" from "this is new".
  recentEntries?: EntryMemory[];
  // sessionSummary is undefined whenever /api/summarize-session didn't
  // return one (no key, network error, bad response) — a missing summary
  // never blocks or fails the main analysis, per Feature 3's own spec.
  onDone?: (result: any | null, sessionSummary?: string) => void;
  onError?: (message: string) => void;
  // Distinct from onError: canceling is a decision, not a failure — no
  // error message, just back to Home.
  onCancel?: () => void;
}) {
  const STEPS = ["Listening", "Connecting it to past conversations", "Double-checking the pattern"];
  const [step, setStep] = React.useState(0);
  const [showCancel, setShowCancel] = React.useState(false);
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    if (text) return;
    if (step >= STEPS.length - 1) {
      const t = setTimeout(() => onDone?.(null), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [text, step]);

  React.useEffect(() => {
    const t = setTimeout(() => setShowCancel(true), CANCEL_AFFORDANCE_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (!text) return;
    let cancelled = false;
    const stepTimer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);
    const analyzeAbort = new AbortController();
    const timeoutId = setTimeout(() => analyzeAbort.abort(), ANALYZE_TIMEOUT_MS);

    // Feature 3 — fired alongside /api/analyze, not chained after it, so
    // the summary doesn't add extra wait time on top of the main analysis.
    // Deliberately swallows its own errors to undefined: a missing summary
    // just means the session-summary card skips that paragraph, never a
    // reason to fail the session. Not worth its own timeout — it's already
    // bounded by however long /api/analyze itself takes below.
    const summaryPromise = fetch(apiUrl("/api/summarize-session"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || typeof data?.summary !== "string") return undefined;
        return data.summary as string;
      })
      .catch(() => undefined);

    fetch(apiUrl("/api/analyze"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, matchableBeliefs, matchablePending, priorAssumptions, priorConnections, aspiration, name, recentMoods, recentEntries }),
      signal: analyzeAbort.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Analysis failed.");
        return data;
      })
      .then(async (data) => {
        const sessionSummary = await summaryPromise;
        if (cancelled) return;
        clearTimeout(timeoutId);
        clearInterval(stepTimer);
        setStep(STEPS.length - 1);
        setTimeout(() => { if (!cancelled) onDone?.(data, sessionSummary); }, 500);
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        clearInterval(stepTimer);
        const isTimeout = err instanceof DOMException && err.name === "AbortError";
        onError?.(isTimeout ? "This is taking longer than expected. Please try again." : err instanceof Error ? err.message : "Analysis failed.");
      });
    return () => { cancelled = true; clearInterval(stepTimer); clearTimeout(timeoutId); analyzeAbort.abort(); };
  }, [text]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", backgroundColor: dkBg, padding: 32 }}>
      <ProcessingConstellation step={step} reducedMotion={!!reducedMotion} />
      <div style={{ ...sans, fontSize: 15, color: dkBodyLight, marginTop: 22 }}>{STEPS[step]}</div>
      {showCancel && (
        <motion.span
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
          role="button" tabIndex={0} onClick={onCancel}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCancel?.(); } }}
          style={{ ...sans, fontSize: 13, color: dkBody, marginTop: 28, cursor: "pointer" }}
        >
          Cancel
        </motion.span>
      )}
    </div>
  );
}

// ── Screen 7 · Think complete ─────────────────────────────────────────────────
// Reached when the model found nothing new to report, when analysis
// failed, or when an entry was saved without analysis (no AI consent —
// see appendUnanalyzedEntry in realStore.ts and the "think" case's onDone).
// ── Screen 5.0 · AI-analysis consent ──────────────────────────────────────────
// Two independent checkboxes, each with the disclosures PIPA requires at the
// moment of asking (items / purpose / retention, plus recipient / country /
// timing for the overseas transfer), and an equally prominent way to say no.
// See aiConsent.ts for why it's two consents and what declining does.
export function ScreenAiConsent({
  current,
  onBack,
  onDecide,
}: {
  current: import("./aiConsent").AiConsent | null;
  onBack?: () => void;
  onDecide: (granted: boolean) => void;
}) {
  const copy = AI_CONSENT_COPY[isKoreanLocale() ? "ko" : "en"];
  const wasGranted = !!current && current.version === AI_CONSENT_VERSION && current.sensitive && current.overseas;
  // Never pre-checked on a first ask — consent has to be an affirmative act.
  // Pre-filled only when reviewing a consent that's already in force.
  const [sensitive, setSensitive] = React.useState(wasGranted);
  const [overseas, setOverseas] = React.useState(wasGranted);
  const both = sensitive && overseas;
  const block = (part: { label: string; rows: [string, string][] }, checked: boolean, set: (v: boolean) => void) => (
    <div style={{ marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: ivSurfaceSolid, boxShadow: ivCardShadow }}>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: ivHeading, flexShrink: 0 }} />
        <span style={{ ...sans, fontSize: 15, fontWeight: 600, color: ivHeading, lineHeight: 1.45, wordBreak: "keep-all" }}>{part.label}</span>
      </label>
      <dl style={{ margin: "12px 0 0 28px", display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 6 }}>
        {part.rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt style={{ ...sans, fontSize: 12, fontWeight: 600, color: ivBody, whiteSpace: "nowrap" }}>{k}</dt>
            <dd style={{ ...sans, fontSize: 12, color: ivBody, margin: 0, lineHeight: 1.5, wordBreak: "keep-all" }}>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: ivBg2 }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: ivHeading, marginTop: 10, lineHeight: 1.3, wordBreak: "keep-all" }}>{copy.title}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {/* What agreeing changes, drawn: the trip to Anthropic only runs
            once both boxes are ticked. The legal text below is unchanged. */}
        <div style={{ backgroundColor: ivSurfaceSolid, borderRadius: shape.md, boxShadow: ivCardShadow, padding: 12, marginBottom: 16 }}>
          <DataPathIllustration aiOn={both} lang={isKoreanLocale() ? "ko" : "en"} />
        </div>
        <div style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.7, wordBreak: "keep-all" }}>{copy.intro}</div>
        {block(copy.sensitive, sensitive, setSensitive)}
        {block(copy.overseas, overseas, setOverseas)}
        <div style={{ ...sans, fontSize: 13, color: ivBody, marginTop: 16, lineHeight: 1.6, wordBreak: "keep-all" }}>{copy.refuse}</div>
        <a href={`/legal/privacy${isKoreanLocale() ? ".ko" : ""}.html`} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-block", ...sans, fontSize: 13, fontWeight: 600, color: ivHeading, marginTop: 10, textDecoration: "underline" }}>
          {copy.policyLink} ↗
        </a>
      </div>
      <div style={{ padding: "12px 22px 22px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <motion.button
          type="button" disabled={!both} onClick={() => onDecide(true)} whileTap={both ? { scale: 0.99 } : undefined}
          style={{ width: "100%", padding: "14px 18px", borderRadius: 12, border: "none", backgroundColor: ivHeading, color: ivSurfaceSolid, opacity: both ? 1 : 0.35, cursor: both ? "pointer" : "not-allowed", ...sans, fontSize: 15, fontWeight: 600 }}
        >
          {copy.agree}
        </motion.button>
        <motion.button
          type="button" onClick={() => onDecide(false)} whileTap={{ scale: 0.99 }}
          style={{ width: "100%", padding: "14px 18px", borderRadius: 12, border: `1px solid ${ivDivider}`, backgroundColor: "transparent", color: ivHeading, cursor: "pointer", ...sans, fontSize: 15, fontWeight: 600 }}
        >
          {copy.decline}
        </motion.button>
      </div>
    </div>
  );
}

export function ScreenThinkComplete({ error, onDone, voyage, onSetAspiration }: {
  error?: string; onDone?: () => void;
  // The entry just written, as a step toward who you want to be (see
  // aspirationPath.ts), and where the boat was before it.
  voyage?: { step: Step; closeness: number | null; from: number | null; aspiration: string | null };
  onSetAspiration?: () => void;
}) {
  const headline = voyage ? stepHeadline(voyage.step) : null;
  const short = voyage && voyage.step.dir !== 0 ? (voyage.step.dir > 0 ? (voyage.step.size >= 2 ? "Closer." : "A little closer.") : (voyage.step.size >= 2 ? "Further away." : "A little further.")) : "Got it.";
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#17142F", overflow: "hidden" }}>
      <NightDeskBackdrop />
      <RevealGroup style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
        {error ? (
          <>
            <RevealItem>
              <div style={{ ...display, fontSize: 22, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>
                Couldn't analyze that.
              </div>
            </RevealItem>
            <RevealItem>
              <div style={{ ...sans, fontSize: 13, color: dkWarn, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
                {error}
              </div>
            </RevealItem>
          </>
        ) : (
          <>
            <RevealItem>
              <div style={{ ...display, fontSize: 34, color: dkHeading, lineHeight: 1.15, wordBreak: "keep-all" }}>{short}</div>
            </RevealItem>
            <RevealItem>
              <div style={{ ...sans, fontSize: 15, color: dkBodyLight, marginTop: 10, lineHeight: 1.6, wordBreak: "keep-all" }}>
                {headline ?? (voyage?.aspiration
                  ? "Saved. This one didn't really touch who you want to be, and that's fine."
                  : "Saved to your diary.")}
              </div>
            </RevealItem>
            {voyage?.step.note && voyage.step.dir !== 0 && (
              <RevealItem>
                <div style={{ ...hand, fontSize: 22, fontWeight: 600, color: LAMP_TEXT, marginTop: 14, lineHeight: 1.2, wordBreak: "keep-all" }}>“{voyage.step.note}”</div>
              </RevealItem>
            )}
            {voyage && (
              <RevealItem>
                <div style={{ marginTop: 22 }}>
                  <VoyageCard theme="night" closeness={voyage.closeness} from={voyage.from} change={null} aspiration={voyage.aspiration} onSetAspiration={onSetAspiration} />
                </div>
              </RevealItem>
            )}
          </>
        )}
      </RevealGroup>
      <RevealGroup delay={0.4} style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <RevealItem><PrimaryBtn ivory tone="career" onClick={onDone}>Go home</PrimaryBtn></RevealItem>
      </RevealGroup>
    </div>
  );
}

// ── Screen 6.7 · Crisis support ───────────────────────────────────────────────
// The one deliberate exception to "observe, don't judge" — see
// crisisDetection.ts for why this exists and why it's keyword-based rather
// than a model call. Reached instead of processing/thinkComplete/anything
// else the "think" case's onDone would otherwise route to — checked first,
// so a crisis-flagged entry never reaches /api/analyze or the
// belief/hypothesis pipeline.
// The entry itself is still saved (see appendUnanalyzedEntry in the App
// shell's onDone) — this is about response routing, not about withholding
// or hiding what someone wrote. Real tel:/sms: links, not styled buttons
// wired to JS, so the OS's own dialer/messages app opens directly.
function CrisisResourceCard({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <a
      href={href}
      style={{
        display: "block", textDecoration: "none", padding: "16px 18px", borderRadius: 14,
        backgroundColor: dkCard, border: `1px solid ${dkDivider}`,
      }}
    >
      <div style={{ ...sans, fontSize: 15, fontWeight: 700, color: dkHeading }}>{title}</div>
      <div style={{ ...sans, fontSize: 13, color: dkBody, marginTop: 3, lineHeight: 1.5 }}>{subtitle}</div>
    </a>
  );
}

export function ScreenCrisisSupport({ onContinue }: { onContinue?: () => void }) {
  // This is the one screen in the app where a screen-reader user silently
  // missing that anything changed is unacceptable — everywhere else, a
  // missed transition just means re-exploring the page; here it means the
  // 988/Crisis Text Line resources go unnoticed. Moving focus to the
  // heading is the standard SPA route-change fix: most screen readers
  // announce whatever receives focus, so this reads immediately instead
  // of requiring the person to blindly find it. tabIndex={-1} makes a
  // plain div programmatically focusable without adding it to the normal
  // Tab order (it's not an interactive element itself).
  const headingRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: dkBg }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "48px 28px 24px" }}>
        <div ref={headingRef} tabIndex={-1} style={{ ...display, fontSize: 22, color: dkHeading, lineHeight: 1.5, wordBreak: "keep-all", outline: "none" }}>
          It sounds like you might be going through something really hard right now.
        </div>
        <div style={{ ...sans, fontSize: 15, color: dkBody, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
          If that's true, you don't have to go through it alone. These are free, confidential, and available right now — not just for emergencies, for whatever this is too.
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <CrisisResourceCard
            title="988 Suicide & Crisis Lifeline"
            subtitle="Call or text 988 — free, confidential, 24/7"
            href="tel:988"
          />
          <CrisisResourceCard
            title="Crisis Text Line"
            subtitle="Text HOME to 741741 — a real person, by text"
            href="sms:741741&body=HOME"
          />
          <CrisisResourceCard
            title="Outside the US"
            subtitle="Find a local helpline at findahelpline.com"
            href="https://findahelpline.com"
          />
        </div>

        <div style={{ ...sans, fontSize: 12, color: dkBody, marginTop: 24, lineHeight: 1.6, wordBreak: "keep-all" }}>
          What you wrote is still saved, just like always — nothing else about it changes. Mindscape isn't a substitute for real support, which is exactly why these are here.
        </div>
      </div>
      <div style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <GhostBtn onClick={onContinue}>Continue</GhostBtn>
      </div>
    </div>
  );
}

function buildEmotionVarietyLine(entry: StoredHistoryEntry, priorEntries: StoredHistoryEntry[]): string | null {
  const current = countUniqueEmotions(entry);
  if (current === null) return null;
  const priorCounts = priorEntries
    .slice(-3)
    .map((e) => countUniqueEmotions(e))
    .filter((n): n is number => n !== null);
  if (priorCounts.length === 0) return null;
  const avgPrior = priorCounts.reduce((sum, n) => sum + n, 0) / priorCounts.length;
  const delta = current - avgPrior;
  // Flat comparisons aren't reported — unlike the cognitive-verb trend,
  // where "about the same as usual" is still worth saying, a near-equal
  // emotion count says little on its own and would just add a third
  // near-identical trend line to every card.
  if (Math.abs(delta) < 0.5) return null;
  return delta > 0
    ? "You used a wider range of emotion words today than in recent sessions."
    : "You used a narrower range of emotion words today than in recent sessions.";
}

function buildLanguageObservationLines(entry: StoredHistoryEntry, priorObservations: LanguageObservation[]): string[] {
  const obs = entry.languageObservation;
  if (!obs) return [];
  const lines: string[] = [];

  const trend = compareCognitiveVerbTrend(obs, priorObservations);
  if (trend && obs.cognitiveVerbCount > 0) {
    const examples = extractCognitiveVerbExamples(entry.text, 2);
    const examplePhrase = examples.length > 0 ? `words like ${examples.map((e) => `"${e}"`).join(", ")} ` : "";
    if (trend === "increased") lines.push(`Today you used ${examplePhrase}more than in recent sessions.`);
    else if (trend === "decreased") lines.push(`Today you used ${examplePhrase}less than in recent sessions.`);
    else lines.push(`Today you used ${examplePhrase}about as much as in recent sessions.`);
  }

  const lean = comparePronounLean(obs);
  if (lean === "firstPerson") lines.push("Today you used the word \"I\" a lot.");
  else if (lean === "collectiveOrOther") lines.push("Today you used words like \"we\" and \"they\" more than \"I.\"");

  return lines;
}

export function ScreenSessionSummary({ store, onDone }: { store: Store; onDone?: () => void }) {
  const entry = store.history[store.history.length - 1] ?? null;
  const priorEntries = store.history.slice(0, -1);
  const priorObservations = priorEntries
    .map((e) => e.languageObservation)
    .filter((o): o is LanguageObservation => !!o);
  const lines = entry ? buildLanguageObservationLines(entry, priorObservations) : [];
  const emotionVarietyLine = entry ? buildEmotionVarietyLine(entry, priorEntries) : null;
  if (emotionVarietyLine) lines.push(emotionVarietyLine);
  // The main measure leads: did this entry move toward who you want to be?
  const step = entry ? entryStep(entry) : null;
  const closeness = closenessAt(store.history);
  const before = entry ? closenessAt(priorEntries) : null;
  const headline = step ? stepHeadline(step) : null;
  const short = step && step.dir !== 0 ? (step.dir > 0 ? (step.size >= 2 ? "Closer." : "A little closer.") : (step.size >= 2 ? "Further away." : "A little further.")) : "Got it.";

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#17142F", overflow: "hidden" }}>
      <NightDeskBackdrop />
      {/* This screen is the result of what the person just did, so its
      parts arrive in reading order: the step toward who they want to be,
      the voyage, then what was heard and each observation. */}
      <RevealGroup style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 28px" }}>
        <RevealItem>
          <div style={{ ...display, fontSize: 34, color: dkHeading, lineHeight: 1.15, wordBreak: "keep-all" }}>{short}</div>
        </RevealItem>
        {headline && (
          <RevealItem>
            <div style={{ ...sans, fontSize: 15, color: dkBodyLight, marginTop: 8, lineHeight: 1.55, wordBreak: "keep-all" }}><Emph text={headline} keys={["closer", "away"]} color="#FFFFFF" /></div>
          </RevealItem>
        )}
        {step?.note && step.dir !== 0 && (
          <RevealItem>
            <div style={{ ...hand, fontSize: 22, fontWeight: 600, color: LAMP_TEXT, marginTop: 12, lineHeight: 1.2, wordBreak: "keep-all" }}>“{step.note}”</div>
          </RevealItem>
        )}
        <RevealItem>
          <div style={{ marginTop: 18 }}>
            <VoyageCard theme="night" closeness={closeness} from={before} change={null} aspiration={store.aspiration} />
          </div>
        </RevealItem>
        {entry?.sessionSummary && (
          <RevealItem>
            <div style={{ ...hand, fontSize: 19, fontWeight: 600, color: LAMP_TEXT, marginTop: 22 }}>What you said</div>
            <div style={{ ...sans, fontSize: 14, color: dkBodyLight, marginTop: 4, lineHeight: 1.6, wordBreak: "keep-all" }}>
              {entry.sessionSummary}
            </div>
          </RevealItem>
        )}
        {lines.length > 0 && (
          <div style={{ marginTop: entry?.sessionSummary ? 18 : 12, display: "flex", flexDirection: "column", gap: 8, paddingTop: entry?.sessionSummary ? 16 : 0, borderTop: entry?.sessionSummary ? `1px solid ${dkDivider}` : "none" }}>
            {lines.map((line, i) => (
              <RevealItem key={i}>
                <div style={{ ...sans, fontSize: 13, color: dkBody, lineHeight: 1.65, wordBreak: "keep-all" }}>{line}</div>
              </RevealItem>
            ))}
          </div>
        )}
        {!entry?.sessionSummary && lines.length === 0 && (
          <RevealItem>
            <div style={{ ...sans, fontSize: 15, color: dkBody, marginTop: 12, lineHeight: 1.65, wordBreak: "keep-all" }}>
              Today's thoughts have been added to your record. Nothing is judged or organized — it's just quietly kept.
            </div>
          </RevealItem>
        )}
      </RevealGroup>
      {/* The summary can run to five or six lines; the button waits until
      the last of them is well underway rather than racing them. */}
      <RevealGroup delay={0.55} style={{ padding: "0 28px 40px", flexShrink: 0 }}>
        <RevealItem><PrimaryBtn ivory tone="career" onClick={onDone}>Got it</PrimaryBtn></RevealItem>
      </RevealGroup>
    </div>
  );
}
