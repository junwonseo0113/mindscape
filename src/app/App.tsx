import React from "react";
import { motion, AnimatePresence, MotionConfig, useReducedMotion, useTransform } from "motion/react";
import { CognitiveRegion } from "./neuralBrainLayout";
import { emptyStore } from "./types";
import { formatDateDots, parseDotDate } from "./dateUtils";
import { apiUrl } from "./apiBase";
import { closenessAt, entryStep, weekChange } from "./aspirationPath";
import { haptic, isNative, notifyNow, syncReminders, syncJourneyWidget, watchWidgetActions, type WidgetAction } from "./native";
import { Capacitor } from "@capacitor/core";
import { StatusBar as NativeStatusBar, Style as StatusBarStyle } from "@capacitor/status-bar";
import { appendUnanalyzedEntry, isMoodCheckIn, mergeAnalysisIntoStore, recentEntryMemory, recentMoodContext } from "./realStore";
import { detectCrisisSignal } from "./crisisDetection";
import { isCloudSyncConfigured } from "./supabaseClient";
import { useScreenTransitionKind, screenVariants, canSwipeBack, type TransitionCustom, type TransitionKind } from "./screenTransitions";
import { useSwipeBack, useScrollMemory } from "./navGestures";
import { cloudDeleteAccount } from "./cloudSync";
import { AI_CONSENT_VERSION, AiConsentContext, hasAiConsent, needsAiConsentDecision } from "./aiConsent";
import { useAppData } from "./dataProvider";
import { matchableCandidates } from "./analysisFramework";
import { loadBrainMap, PeekContext, BrainNodeMapScreen } from "./screenPeeking";
import { loadAnime } from "./animeLoader";
import { computeWeeklySummary, voyageAnchor } from "./entryTiming";
import { TUTORIAL_STEPS, TutorialOverlay } from "./tutorial";
import { evidenceForHypothesis } from "./hypothesisEvidence";
import { ScreenQuoteOfTheDay, ScreenSplash } from "./OpeningScreens";
import { PlanIntroduction } from "./PlanSection";
import { PLUS_INTRO_KEY, readPlanPreference, savePlanPreference, useMindscapePlan, weeklyReflectionsEnabled } from "./mindscapePlan";
import { ScreenHome } from "./HomeScreen";
import { dkBg, mdBg } from "./screenTheme";
import { OpenFromContext, StatusBar } from "./screenUI";

const loadAccountScreens = () => import("./AccountScreens");
const loadOnboardingScreen = () => import("./OnboardingScreen");
const loadAnalysisScreens = () => import("./AnalysisScreens");
const loadWritingScreens = () => import("./WritingScreens");
const loadBeliefMapScreen = () => import("./BeliefMapScreen");
const loadJourneyScreens = () => import("./JourneyScreens");
const loadHypothesisScreens = () => import("./HypothesisScreens");
const loadHistoryScreens = () => import("./HistoryScreens");
const loadProfileScreens = () => import("./ProfileScreens");

const ScreenAuth = React.lazy(() => loadAccountScreens().then((module) => ({ default: module.ScreenAuth })));
const ScreenLogin = React.lazy(() => loadAccountScreens().then((module) => ({ default: module.ScreenLogin })));
const ScreenSignup = React.lazy(() => loadAccountScreens().then((module) => ({ default: module.ScreenSignup })));
const ScreenOnboarding = React.lazy(() => loadOnboardingScreen().then((module) => ({ default: module.ScreenOnboarding })));
const ScreenDiscoveryAnalysis = React.lazy(() => loadAnalysisScreens().then((module) => ({ default: module.ScreenDiscoveryAnalysis })));
const ScreenThink = React.lazy(() => loadWritingScreens().then((module) => ({ default: module.ScreenThink })));
const ScreenProcessing = React.lazy(() => loadWritingScreens().then((module) => ({ default: module.ScreenProcessing })));
const ScreenSessionSummary = React.lazy(() => loadWritingScreens().then((module) => ({ default: module.ScreenSessionSummary })));
const ScreenAiConsent = React.lazy(() => loadWritingScreens().then((module) => ({ default: module.ScreenAiConsent })));
const ScreenThinkComplete = React.lazy(() => loadWritingScreens().then((module) => ({ default: module.ScreenThinkComplete })));
const ScreenCrisisSupport = React.lazy(() => loadWritingScreens().then((module) => ({ default: module.ScreenCrisisSupport })));
const ScreenBeliefMap = React.lazy(() => loadBeliefMapScreen().then((module) => ({ default: module.ScreenBeliefMap })));
const ScreenDrift = React.lazy(() => loadJourneyScreens().then((module) => ({ default: module.ScreenDrift })));
const ScreenJourneyMap = React.lazy(() => loadJourneyScreens().then((module) => ({ default: module.ScreenJourneyMap })));
const ScreenAspirationSetup = React.lazy(() => loadJourneyScreens().then((module) => ({ default: module.ScreenAspirationSetup })));
const ScreenHypotheses = React.lazy(() => loadHypothesisScreens().then((module) => ({ default: module.ScreenHypotheses })));
const ScreenHypothesisDetail = React.lazy(() => loadHypothesisScreens().then((module) => ({ default: module.ScreenHypothesisDetail })));
const ScreenInvestigate = React.lazy(() => loadHypothesisScreens().then((module) => ({ default: module.ScreenInvestigate })));
const ScreenHistory = React.lazy(() => loadHistoryScreens().then((module) => ({ default: module.ScreenHistory })));
const ScreenHistoryDetail = React.lazy(() => loadHistoryScreens().then((module) => ({ default: module.ScreenHistoryDetail })));
const ScreenProfile = React.lazy(() => loadProfileScreens().then((module) => ({ default: module.ScreenProfile })));
const ScreenNotificationSettings = React.lazy(() => loadProfileScreens().then((module) => ({ default: module.ScreenNotificationSettings })));
const ScreenDataPrivacy = React.lazy(() => loadProfileScreens().then((module) => ({ default: module.ScreenDataPrivacy })));
const ScreenPrivacyPolicy = React.lazy(() => loadProfileScreens().then((module) => ({ default: module.ScreenPrivacyPolicy })));
const ScreenTermsOfService = React.lazy(() => loadProfileScreens().then((module) => ({ default: module.ScreenTermsOfService })));
const ScreenHelp = React.lazy(() => loadProfileScreens().then((module) => ({ default: module.ScreenHelp })));


// Only the sky is preloaded now: Home's orbs are plain HTML (HomeOrbField),
// so three.js is fetched only when a screen that still uses it opens.
function preload3D() { void loadBrainMap(); void loadAnime(); }


const DAILY_REMINDER_LAST_FIRED_KEY = "mijeong.lastDailyReminderFiredDate";
const WEEKLY_SUMMARY_LAST_FIRED_KEY = "mijeong.lastWeeklySummaryFiredDate";

// On a real phone, the fixed 393×852 "device mockup" frame below (rounded
// corners, drop shadow, centered on a desktop backdrop) is exactly wrong —
// it reads as a small floating box with wasted padding around it instead of
// filling the actual screen. This flips the frame to full-bleed (edge to
// edge, no chrome) whenever the viewport itself is phone-width, so the same
// component tree serves both "a nice mockup to review on desktop" and "the
// real app on someone's phone" without a separate mobile build.
function useIsMobileViewport(): boolean {
  const query = "(max-width: 480px)";
  const [isMobile, setIsMobile] = React.useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

// ── App shell ──────────────────────────────────────────────────────────────
// The app is ivory everywhere except the night desk: writing an entry and
// what follows it, plus crisis support. This one list drives the frame's
// fallback colour, the notch strip, the preview status bar, and the iOS
// clock colour, so a new screen is light by default instead of silently
// picking up a dark strip because someone forgot to add it to a second list.
// (The night sky, "brainmap", draws its own full-screen chrome; only the
// iOS clock needs telling about it.)
const DARK_SCREENS = new Set(["think", "processing", "sessionSummary", "thinkComplete", "crisisSupport"]);

export default function App() {
  const [screen, setScreen] = React.useState("splash");
  // In the iOS app, the clock and battery switch to light text on the dark
  // screens (DARK_SCREENS, plus the night sky) and dark text elsewhere.
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const dark = DARK_SCREENS.has(screen) || screen === "brainmap";
    NativeStatusBar.setStyle({ style: dark ? StatusBarStyle.Dark : StatusBarStyle.Light }).catch(() => {});
  }, [screen]);
  // ── Navigation-transition plumbing (see screenTransitions/navGestures) ──
  // transitionOverride forces the next screen change's transition kind;
  // zoomClipRef holds the Home jar's rectangle for the jar <-> Brain Map
  // zoom; contentCache keeps each screen's last element so a swipe-back can
  // show the screen underneath before it's actually navigated to.
  const transitionOverride = React.useRef<TransitionKind | null>(null);
  const zoomClipRef = React.useRef<{ jar: string; full: string } | null>(null);
  const contentCache = React.useRef(new Map<string, React.ReactNode>());
  const contentHostRef = React.useRef<HTMLDivElement>(null);
  // Measures the jar on Home, relative to the screen layer, as clip-path
  // inset() strings: where the map starts (the jar) and where it ends
  // (covering the whole viewport — the map is position:fixed, so on the
  // desktop preview it extends past the phone frame).
  const captureJarClip = (): boolean => {
    const host = contentHostRef.current;
    const jar = host?.querySelector('[data-screen="home"] [data-shared="brain-jar"]');
    if (!host || !jar) { zoomClipRef.current = null; return false; }
    const h = host.getBoundingClientRect();
    const j = jar.getBoundingClientRect();
    zoomClipRef.current = {
      jar: `inset(${j.top - h.top}px ${h.right - j.right}px ${h.bottom - j.bottom}px ${j.left - h.left}px round 28px)`,
      full: `inset(${-h.top}px ${-(window.innerWidth - h.right)}px ${-(window.innerHeight - h.bottom)}px ${-h.left}px round 0px)`,
    };
    return true;
  };
  // A tapped row hands over its rectangle; the next screen grows out of it
  // (the "grow" transition, a slower cousin of Home's orb zoom). Lapses if
  // nothing navigates.
  const openFromRow = React.useCallback((el: HTMLElement) => {
    const host = contentHostRef.current;
    if (!host) return;
    const h = host.getBoundingClientRect();
    const j = el.getBoundingClientRect();
    const clip = {
      jar: `inset(${j.top - h.top}px ${h.right - j.right}px ${h.bottom - j.bottom}px ${j.left - h.left}px round 16px)`,
      full: `inset(${-h.top}px ${-(window.innerWidth - h.right)}px ${-(window.innerHeight - h.bottom)}px ${-h.left}px round 0px)`,
    };
    zoomClipRef.current = clip;
    transitionOverride.current = "grow";
    setTimeout(() => {
      if (transitionOverride.current === "grow" && zoomClipRef.current === clip) transitionOverride.current = null;
    }, 400);
  }, []);
  const leaveBrainMap = () => {
    if (brainMapReturnTo === "home" && zoomClipRef.current) transitionOverride.current = "unzoom";
    setScreen(brainMapReturnTo);
  };
  // Fetch the 3D chunks while the quote screen is up, once the first paint
  // is done — so the opening fades aren't competing with three.js parsing.
  React.useEffect(() => {
    const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
    if (ric) ric(preload3D, { timeout: 1500 }); else setTimeout(preload3D, 600);
  }, []);
  const [hypothesisIndex, setHypothesisIndex] = React.useState(0);
  // Investigate is reachable from two places now — the legacy standalone
  // hypothesisDetail screen, and the Analysis tab's inline discovery body —
  // so its back button needs to know which one to return to.
  const [investigateReturnTo, setInvestigateReturnTo] = React.useState<"hypothesisDetail" | "analysis">("hypothesisDetail");
  // Same idea, for the Brain Map: it's now reachable from both Home's jar
  // and the Mind tab's constellation, and "back" needs to return wherever
  // the trip actually started instead of always landing on Home.
  const [brainMapReturnTo, setBrainMapReturnTo] = React.useState<"home" | "analysis">("home");
  const [historyEntryIndex, setHistoryEntryIndex] = React.useState(0);
  const [thinkText, setThinkText] = React.useState("");
  const [analysisError, setAnalysisError] = React.useState("");
  // Set right before navigating to "brainmap" whenever the trip started
  // from a region-filtered entry point rather than the Brain Map card's own
  // expand button — null just opens the map unfiltered, same as always.
  // (Home no longer has a region-shortcut row — see the vintage ScreenHome
  // comment — so today this is always null coming from Home; left in place
  // for whatever else ends up wanting a filtered entry point.)
  const [brainMapInitialRegion, setBrainMapInitialRegion] = React.useState<CognitiveRegion | null>(null);
  // Same idea, for one specific belief — set when Home's node field is
  // tapped directly on one of its real nodes (see ScreenHome's
  // JarBrainPreview onSelectNode below), so the map opens already flown-in
  // and panel-open on that exact belief instead of the unfiltered overview.
  const [brainMapInitialBeliefId, setBrainMapInitialBeliefId] = React.useState<string | null>(null);
  // The one data provider: `store` is whichever dataset is currently active
  // (curated demo content, or the real on-device store — see
  // src/app/dataProvider.ts), and every screen below reads only that, with
  // no idea which one it's looking at. `realStore`/`updateRealStore` are
  // used only for the pre-home account flow, which is always real even if
  // Demo Mode happens to be on.
  const { isDemoMode, setIsDemoMode, hasSeenTutorial, setHasSeenTutorial, store, updateStore, realStore, updateRealStore, cloudUserId } = useAppData();
  // Consent is a real legal record, so it always lives on the real store —
  // even while browsing Demo Mode, typing into "Speak your mind" sends the
  // person's own words to the AI.
  const plan = useMindscapePlan(cloudUserId, isDemoMode);
  const widgetAspiration = !!realStore.aspiration?.trim();
  const widgetHistory = realStore.history;
  React.useEffect(() => {
    if (!isNative) return;
    syncJourneyWidget({
      hasAspiration: widgetAspiration,
      score: widgetAspiration ? closenessAt(widgetHistory) : null,
      weekChange: widgetAspiration ? weekChange(widgetHistory, voyageAnchor(widgetHistory)) : null,
    });
  }, [widgetAspiration, widgetHistory]);
  const aiAllowed = hasAiConsent(realStore);
  const [aiConsentReturnTo, setAiConsentReturnTo] = React.useState("think");
  // First "Speak your mind" (or the first one after the consent wording
  // changes) goes through the consent screen; after that, straight in —
  // declining is remembered too, so nobody is re-asked on every entry.
  // The feeling from Home's check-in when "Say why" opened this entry, so the
  // writing screen can ask about it. Anything other than a string (a click
  // event, when this is passed straight to onClick) means a plain start.
  const [thinkMood, setThinkMood] = React.useState<string | null>(null);
  const needsConsent = needsAiConsentDecision(realStore);
  const startThink = React.useCallback((mood?: unknown) => {
    setThinkMood(typeof mood === "string" ? mood : null);
    if (needsConsent) {
      setAiConsentReturnTo("think");
      setScreen("aiConsent");
    } else {
      setScreen("think");
    }
  }, [needsConsent]);

  // A refresh or tab-close mid-analysis silently throws away the in-flight
  // /api/analyze call (and, for a Pro entry, the thought itself — it isn't
  // saved to history until mergeAnalysisIntoStore runs in onDone below).
  // Scoped to exactly the "processing" screen: armed the moment it mounts,
  // torn down the moment the screen changes away from it for any reason
  // (a real result, an error routing to thinkComplete, or Cancel routing
  // home), so normal navigation is never blocked once analysis is settled.
  React.useEffect(() => {
    if (screen !== "processing") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [screen]);

  React.useEffect(() => {
    if (!store.settings.dailyReminder) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") Notification.requestPermission();
    const check = () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (hhmm !== store.settings.dailyReminderTime) return;
      const todayStr = formatDateDots(now);
      let lastFired = "";
      try { lastFired = localStorage.getItem(DAILY_REMINDER_LAST_FIRED_KEY) ?? ""; } catch {}
      if (lastFired === todayStr) return;
      try { localStorage.setItem(DAILY_REMINDER_LAST_FIRED_KEY, todayStr); } catch {}
      new Notification("There's a pattern in your thinking.", { body: "Take a minute to reflect on today." });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [store.settings.dailyReminder, store.settings.dailyReminderTime]);

  // iOS app: real reminders that fire with the app closed (native.ts).
  React.useEffect(() => {
    syncReminders({
      daily: store.settings.dailyReminder,
      time: store.settings.dailyReminderTime,
      weekly: store.settings.weeklySummary,
    });
  }, [store.settings.dailyReminder, store.settings.dailyReminderTime, store.settings.weeklySummary]);

  // Weekly-summary Notification — same plain-Notification-API, tab-must-
  // be-open mechanism as the daily reminder above, just checked on an
  // hourly cadence (a "has 7 days passed" question doesn't need minute
  // granularity). Skips firing
  // entirely when there's nothing to report (computeWeeklySummary returns
  // null for zero entries this week) rather than sending an empty recap.
  React.useEffect(() => {
    if (!store.settings.weeklySummary) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") Notification.requestPermission();

    const check = () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      let lastFiredStr = "";
      try { lastFiredStr = localStorage.getItem(WEEKLY_SUMMARY_LAST_FIRED_KEY) ?? ""; } catch { /* private mode */ }
      const lastFired = lastFiredStr ? parseDotDate(lastFiredStr) : null;
      const daysSinceLastFired = lastFired ? Math.floor((now.getTime() - lastFired.getTime()) / (1000 * 60 * 60 * 24)) : Infinity;
      if (daysSinceLastFired < 7) return;
      const summary = computeWeeklySummary(store.history);
      if (!summary) return;
      try { localStorage.setItem(WEEKLY_SUMMARY_LAST_FIRED_KEY, formatDateDots(now)); } catch { /* private mode */ }
      const body = summary.topPattern
        ? `${summary.entryCount} thought${summary.entryCount === 1 ? "" : "s"} this week, most often touching on ${summary.topPattern.toLowerCase()}.`
        : `${summary.entryCount} thought${summary.entryCount === 1 ? "" : "s"} recorded this week.`;
      new Notification("Your week in review", { body });
    };
    check();
    const interval = setInterval(check, 3600000);
    return () => clearInterval(interval);
  }, [store.settings.weeklySummary, store.history]);

  // New-hypothesis alert — unlike the two notifications above, this one is
  // event-driven (fires the instant an entry actually surfaces something
  // new), not polled on a timer, so there's nothing to check periodically
  // here. This effect only requests permission as soon as the setting is
  // turned on, matching the other two, so it's already granted by the time
  // the "processing" case's onDone (below) tries to fire one.
  React.useEffect(() => {
    if (!store.settings.newHypothesisAlert) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") Notification.requestPermission();
  }, [store.settings.newHypothesisAlert]);

  const goToTab = (id: string) => setScreen(id);

  // Interactive tour state — see TutorialOverlay/TUTORIAL_STEPS above.
  // frameRef lets the overlay measure real targets relative
  // to the phone frame; the effect below is the single place that decides
  // "we've arrived at a nav step's destination," whether that arrival came
  // from the real nav-bar tap passing through the spotlight or from the
  // tooltip's own button calling the identical setScreen.
  const [tutorialActive, setTutorialActive] = React.useState(false);
  const [tutorialStep, setTutorialStep] = React.useState(0);
  const [widgetAction, setWidgetAction] = React.useState<WidgetAction | null>(null);
  React.useEffect(() => watchWidgetActions(setWidgetAction), []);

  const [hasSeenPlusIntro, setHasSeenPlusIntro] = React.useState(() => readPlanPreference(PLUS_INTRO_KEY) === "1");
  const showPlusIntro = screen === "home" && hasSeenTutorial && !tutorialActive && !widgetAction && !hasSeenPlusIntro && !isDemoMode && weeklyReflectionsEnabled;
  const dismissPlusIntro = () => {
    savePlanPreference(PLUS_INTRO_KEY, "1");
    setHasSeenPlusIntro(true);
  };
  const frameRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!tutorialActive) return;
    const step = TUTORIAL_STEPS[tutorialStep];
    if (step?.navTo && screen === step.navTo) {
      setTutorialStep((s) => s + 1);
    }
  }, [screen, tutorialActive, tutorialStep]);
  // The single trigger for "should the tour start now" — arriving at Home
  // at all, for any reason (guest/signup onboarding, but also a returning
  // user logging into an existing account, which skips onboarding
  // entirely and used to skip the tour with it). Wiring this only into
  // onboarding's onDone meant anyone who already had an account never saw
  // it. Fires at most once per browser: hasSeenTutorial flips true the
  // moment the tour starts, and this effect's own condition then never
  // matches again.
  React.useEffect(() => {
    if (screen === "home" && !hasSeenTutorial && !tutorialActive) {
      setTutorialStep(0);
      setTutorialActive(true);
    }
  }, [screen, hasSeenTutorial, tutorialActive]);
  const finishTutorial = () => { setTutorialActive(false); setHasSeenTutorial(true); };
  const advanceTutorial = () => {
    const step = TUTORIAL_STEPS[tutorialStep];
    if (step?.navTo) { setScreen(step.navTo); return; }
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) { finishTutorial(); return; }
    setTutorialStep((s) => s + 1);
  };

  // Shared by both the legacy hypothesisDetail screen and the Analysis
  // tab's inline discovery body, so agree/disagree behaves identically no
  // matter which one the user reached it through.
  const agreeToHypothesis = (index: number) => {
    updateStore((prev) => ({
      ...prev,
      hypotheses: prev.hypotheses.map((h, i) => (i === index ? { ...h, reaction: "agree" as const } : h)),
    }));
  };
  const rejectBelief = (beliefId: string) => {
    updateStore((prev) => ({
      ...prev,
      beliefs: prev.beliefs.map((b) => (b.id === beliefId ? { ...b, userReaction: "rejected" as const } : b)),
    }));
  };
  // aspirationSetup is reachable from both ScreenDrift ("Mind" tab) and
  // ScreenJourneyMap (Profile) now — this is which one "Save"/back should
  // land on, set right before navigating in from either entry point.
  const [aspirationReturnTo, setAspirationReturnTo] = React.useState("drift");
  React.useEffect(() => {
    if (!widgetAction) return;
    if (screen === "think" && widgetAction === "write") {
      setWidgetAction(null);
      return;
    }
    if (!hasSeenTutorial || tutorialActive || !["home", "analysis", "discoveryAnalysis", "history", "profile"].includes(screen)) return;
    setWidgetAction(null);
    if (widgetAction === "write") startThink();
    else if (widgetAction === "diary") setScreen("history");
    else if (store.aspiration) setScreen("journeyMap");
    else {
      setAspirationReturnTo("home");
      setScreen("aspirationSetup");
    }
  }, [widgetAction, screen, hasSeenTutorial, tutorialActive, startThink, store.aspiration]);
  const [driftReturnTo, setDriftReturnTo] = React.useState("analysis");
  // Distinct from rejectBelief above: reacting to a belief as "Today's
  // Discovery" never hides it from "Unconscious Patterns" — only the dedicated reject
  // link there does that.
  const agreeToBeliefDiscovery = (beliefId: string) => {
    updateStore((prev) => ({
      ...prev,
      beliefs: prev.beliefs.map((b) => (b.id === beliefId ? { ...b, discoveryReaction: "agree" as const } : b)),
    }));
  };

  // Disagreeing with a discovery no longer just records a reason — it asks
  // the model for a genuinely different reading of the same evidence and
  // loops (see /api/reinterpret in vite.config.ts). reinterpretingKey scopes
  // the in-flight request to exactly one hypothesis/belief so two discovery
  // surfaces can never race each other.
  const [reinterpretingKey, setReinterpretingKey] = React.useState<string | null>(null);

  async function requestReinterpretation(currentText: string, evidenceQuotes: string[], rejectedTexts: string[]) {
    if (!aiAllowed) throw new Error("AI analysis is turned off. You can turn it on in Profile → Data & Privacy.");
    const res = await fetch(apiUrl("/api/reinterpret"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentText, evidenceQuotes, rejectedTexts }),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error || "Couldn't get another interpretation.");
    return data as { interpretation: string | null; confidence: number | null; exhausted: boolean; note?: string };
  }

  const disagreeWithHypothesis = async (index: number) => {
    const key = `hyp:${index}`;
    if (reinterpretingKey) return;
    const h = store.hypotheses[index];
    if (!h) return;
    setReinterpretingKey(key);
    try {
      const quotes = evidenceForHypothesis(h, store.beliefs).map((e) => e.quote);
      const result = await requestReinterpretation(h.title, quotes, h.rejectedTitles ?? []);
      updateStore((prev) => ({
        ...prev,
        hypotheses: prev.hypotheses.map((x, i) => {
          if (i !== index) return x;
          if (result.exhausted || !result.interpretation) {
            return { ...x, reaction: "disagree" as const, exhausted: true };
          }
          return {
            ...x,
            title: result.interpretation as string,
            confidence: typeof result.confidence === "number" ? result.confidence : x.confidence,
            rejectedTitles: [...(x.rejectedTitles ?? []), x.title],
            reaction: null,
          };
        }),
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setReinterpretingKey(null);
    }
  };

  const disagreeWithBeliefDiscovery = async (beliefId: string) => {
    const key = `belief:${beliefId}`;
    if (reinterpretingKey) return;
    const b = store.beliefs.find((x) => x.id === beliefId);
    if (!b) return;
    setReinterpretingKey(key);
    try {
      const currentText = b.discoveryInterpretationOverride ?? b.statement;
      const quotes = b.evidenceQuotes.map((q) => q.quote);
      const result = await requestReinterpretation(currentText, quotes, b.rejectedStatements ?? []);
      updateStore((prev) => ({
        ...prev,
        beliefs: prev.beliefs.map((x) => {
          if (x.id !== beliefId) return x;
          if (result.exhausted || !result.interpretation) {
            return { ...x, discoveryReaction: "disagree" as const, discoveryExhausted: true };
          }
          const previousText = x.discoveryInterpretationOverride ?? x.statement;
          return {
            ...x,
            discoveryInterpretationOverride: result.interpretation as string,
            rejectedStatements: [...(x.rejectedStatements ?? []), previousText],
            discoveryReaction: null,
          };
        }),
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setReinterpretingKey(null);
    }
  };

  let content: React.ReactNode = null;
  switch (screen) {
    case "quote": content = <ScreenQuoteOfTheDay onDone={() => setScreen("auth")} />; break;
    case "splash": content = <ScreenSplash onDone={() => setScreen("quote")} />; break;
    case "auth": content = <ScreenAuth onEmailStart={() => setScreen(realStore.account ? "login" : "signup")} onGuest={() => setScreen("onboarding")} />; break;
    case "login": content = (
      <ScreenLogin
        account={realStore.account}
        onBack={() => setScreen("auth")}
        onGoSignup={() => setScreen("signup")}
        onLogin={(upgradedPasswordHash) => {
          if (upgradedPasswordHash) {
            updateRealStore((prev) => (prev.account ? { ...prev, account: { ...prev.account, password: upgradedPasswordHash } } : prev));
          }
          setScreen("home");
        }}
      />
    ); break;
    case "signup": content = (
      <ScreenSignup
        onBack={() => setScreen("auth")}
        onGoLogin={() => setScreen("login")}
        onSignup={(account) => {
          updateRealStore((prev) => ({ ...prev, account }));
          setScreen("onboarding");
        }}
      />
    ); break;
    case "onboarding": content = (
      <ScreenOnboarding
        initialAspiration={realStore.aspiration}
        onSaveAspiration={(aspiration) => {
          updateRealStore((prev) => prev.aspiration === aspiration
            ? prev
            : { ...prev, aspiration, aspirationSetDate: formatDateDots(new Date()) });
        }}
        onDone={() => setScreen("home")}
      />
    ); break;
    case "home": content = (
      <ScreenHome
        onNavSelect={goToTab}
        onStartThink={startThink}
        onOpenVoyage={() => { setDriftReturnTo("home"); setScreen("drift"); }} onSetAspiration={() => { setAspirationReturnTo("home"); setScreen("aspirationSetup"); }}
        onOpenBrainMap={(region, beliefId) => { setBrainMapInitialRegion(region ?? null); setBrainMapInitialBeliefId(beliefId ?? null); setBrainMapReturnTo("home"); if (captureJarClip()) transitionOverride.current = "zoom"; setScreen("brainmap"); }}
        store={store}
        updateStore={updateStore}
      />
    ); break;
    case "brainmap": content = (
      <React.Suspense fallback={<div style={{ flex: 1, backgroundColor: "#ffffff" }} />}>
        <BrainNodeMapScreen beliefs={store.beliefs} connections={store.connections} onBack={leaveBrainMap} modernist initialActiveRegion={brainMapInitialRegion} initialSelectedBeliefId={brainMapInitialBeliefId} />
      </React.Suspense>
    ); break;
    // Mind and Analysis were one tab's worth of content split in two (both
    // led with the same daily discovery), so they're one screen again: Mind.
    // "discoveryAnalysis" stays as an alias for older links and returns.
    case "analysis":
    case "discoveryAnalysis": content = (
      <ScreenDiscoveryAnalysis
        onNavSelect={goToTab}
        onOpenArtifact={(id) => { if (id === "drift") setDriftReturnTo("analysis"); setScreen(id); }}
        onOpenBrainMap={(region) => { setBrainMapInitialRegion(region ?? null); setBrainMapInitialBeliefId(null); setBrainMapReturnTo("analysis"); setScreen("brainmap"); }}
        store={store}
        updateStore={updateStore}
        onAgreeHypothesis={agreeToHypothesis}
        onDisagreeHypothesis={disagreeWithHypothesis}
        onInvestigateHypothesis={(index) => {
          setHypothesisIndex(index);
          setInvestigateReturnTo("analysis");
          setScreen("investigate");
        }}
        onAgreeBeliefDiscovery={agreeToBeliefDiscovery}
        onDisagreeBeliefDiscovery={disagreeWithBeliefDiscovery}
        reinterpretingKey={reinterpretingKey}
      />
    ); break;
    case "think": content = (
      <ScreenThink
        mood={thinkMood}
        onBack={() => setScreen("home")}
        onDone={(text) => {
          setThinkText(text);
          setAnalysisError("");
          // Checked before anything else — a crisis-
          // flagged entry never reaches /api/analyze or the belief/
          // hypothesis pipeline. The entry is still saved (see
          // appendUnanalyzedEntry below) — this is about where it routes
          // to next, not about withholding what was written. See
          // crisisDetection.ts for why this is the one exception to
          // "observe, don't judge."
          if (detectCrisisSignal(text)) {
            updateStore((prev) => appendUnanalyzedEntry(prev, text));
            setScreen("crisisSupport");
          } else if (!aiAllowed) {
            // No consent → the entry is kept on-device only and never sent
            // to /api/analyze. ScreenThinkComplete's no-error state ("added
            // to your record") is exactly the right message for this.
            updateStore((prev) => appendUnanalyzedEntry(prev, text));
            setScreen("thinkComplete");
          } else {
            setScreen("processing");
          }
        }}
      />
    ); break;
    case "processing": content = (
      <ScreenProcessing
        text={thinkText}
        matchableBeliefs={matchableCandidates(store).beliefs}
        matchablePending={matchableCandidates(store).pending}
        priorAssumptions={store.assumptions}
        priorConnections={store.connections.map((c) => ({
          aStatement: store.beliefs.find((b) => b.id === c.a)?.statement ?? "",
          bStatement: store.beliefs.find((b) => b.id === c.b)?.statement ?? "",
          note: c.note,
        }))}
        aspiration={store.aspiration}
        name={store.account?.name}
        recentMoods={recentMoodContext(store.history)}
        recentEntries={recentEntryMemory(store.history)}
        onDone={(result, sessionSummary) => {
          if (result) {
            const merged = mergeAnalysisIntoStore(store, result, thinkText, sessionSummary);
            haptic("success");
            const foundNewPattern = merged.beliefs.length > store.beliefs.length || merged.hypotheses.length > store.hypotheses.length;
            if (store.settings.newHypothesisAlert && foundNewPattern && isNative) notifyNow("A new pattern showed up", "Take a look at what your recent thoughts have in common.");
            if (store.settings.newHypothesisAlert && typeof Notification !== "undefined" && Notification.permission === "granted") {
              if (foundNewPattern) new Notification("A new pattern showed up", { body: "Take a look at what your recent thoughts have in common." });
            }
            updateStore(() => merged);
            setScreen("sessionSummary");
          } else {
            setScreen("thinkComplete");
          }
        }}
        onError={(msg) => { setAnalysisError(msg); setScreen("thinkComplete"); }}
        onCancel={() => setScreen("home")}
      />
    ); break;
    case "sessionSummary": content = <ScreenSessionSummary store={store} onDone={() => setScreen("analysis")} />; break;
    case "aiConsent": content = (
      <ScreenAiConsent
        current={realStore.aiConsent ?? null}
        onBack={() => setScreen(aiConsentReturnTo === "think" ? "home" : aiConsentReturnTo)}
        onDecide={(granted) => {
          updateRealStore((prev) => ({
            ...prev,
            aiConsent: { sensitive: granted, overseas: granted, decidedAt: new Date().toISOString(), version: AI_CONSENT_VERSION },
          }));
          setScreen(aiConsentReturnTo);
        }}
      />
    ); break;
    case "thinkComplete": content = (
      <ScreenThinkComplete
        error={analysisError}
        onDone={() => setScreen("home")}
        voyage={analysisError ? undefined : (() => {
          const written = store.history.filter((e) => !isMoodCheckIn(e));
          const latest = written[written.length - 1];
          if (!latest) return undefined;
          return { step: entryStep(latest), closeness: closenessAt(store.history), from: closenessAt(store.history.filter((e) => e.id !== latest.id)), aspiration: store.aspiration };
        })()}
        onSetAspiration={() => { setAspirationReturnTo("home"); setScreen("aspirationSetup"); }}
      />
    ); break;
    case "crisisSupport": content = <ScreenCrisisSupport onContinue={() => setScreen("home")} />; break;
    case "beliefs": content = (
      <ScreenBeliefMap onBack={() => setScreen("analysis")} store={store} onRejectBelief={rejectBelief} />
    ); break;
    case "assumptions": content = (
      <ScreenBeliefMap onBack={() => setScreen("home")} store={store} />
    ); break;
    case "drift": content = (
      <ScreenDrift onBack={() => setScreen(driftReturnTo)} store={store} onSetupAspiration={() => { setAspirationReturnTo("drift"); setScreen("aspirationSetup"); }} />
    ); break;
    case "journeyMap": content = (
      <ScreenJourneyMap onBack={() => setScreen("profile")} store={store} onSetupAspiration={() => { setAspirationReturnTo("journeyMap"); setScreen("aspirationSetup"); }} />
    ); break;
    case "aspirationSetup": content = (
      <ScreenAspirationSetup
        initialValue={store.aspiration}
        onBack={() => setScreen(aspirationReturnTo)}
        onSave={(value) => {
          updateStore((prev) => ({ ...prev, aspiration: value, aspirationSetDate: formatDateDots(new Date()) }));
          setScreen(aspirationReturnTo);
        }}
      />
    ); break;
    case "hypotheses": content = (
      <ScreenHypotheses onBack={() => setScreen("home")} store={store} onOpen={(i) => { setHypothesisIndex(i); setScreen("hypothesisDetail"); }} />
    ); break;
    case "hypothesisDetail": content = (
      <ScreenHypothesisDetail
        index={hypothesisIndex}
        store={store}
        onBack={() => setScreen("hypotheses")}
        onInvestigate={() => {
          setInvestigateReturnTo("hypothesisDetail");
          setScreen("investigate");
        }}
        onAgree={() => agreeToHypothesis(hypothesisIndex)}
        onDisagree={() => disagreeWithHypothesis(hypothesisIndex)}
        reinterpreting={reinterpretingKey === `hyp:${hypothesisIndex}`}
      />
    ); break;
    case "investigate": {
      const investigatedHypothesis = store.hypotheses[hypothesisIndex] ?? store.hypotheses[0];
      content = investigatedHypothesis?.investigate ? (
        <ScreenInvestigate investigate={investigatedHypothesis.investigate} onBack={() => setScreen(investigateReturnTo)} />
      ) : (
        <ScreenHypotheses onBack={() => setScreen("home")} store={store} onOpen={(i) => { setHypothesisIndex(i); setScreen("hypothesisDetail"); }} />
      );
      break;
    }
    case "history": content = (
      <ScreenHistory
        onNavSelect={goToTab}
        store={store}
        updateStore={updateStore}
        cloudUserId={cloudUserId}
        plan={plan}
        onOpenAiConsent={() => { setAiConsentReturnTo("history"); setScreen("aiConsent"); }}
        onOpenEntry={(i) => { setHistoryEntryIndex(i); setScreen("historyDetail"); }}
      />
    ); break;
    case "historyDetail": content = <ScreenHistoryDetail index={historyEntryIndex} store={store} onBack={() => setScreen("history")} />; break;
    case "profile": content = (
      <ScreenProfile
        onBack={() => goToTab("home")}
        onNavSelect={goToTab}
        store={store}
        updateStore={updateStore}
        isDemoMode={isDemoMode}
        onToggleDemoMode={setIsDemoMode}
        onOpenSettings={(s) => setScreen(s === "notifications" ? "notifications" : s === "dataPrivacy" ? "dataPrivacy" : "help")}
        onOpenJourneyMap={() => setScreen("journeyMap")}
        plan={plan}
        onOpenDiary={() => goToTab("history")}
      />
    ); break;
    case "notifications": content = (
      <ScreenNotificationSettings
        settings={store.settings}
        onBack={() => setScreen("profile")}
        onChange={(settings) => updateStore((prev) => ({ ...prev, settings }))}
      />
    ); break;
    case "dataPrivacy": content = (
      <ScreenDataPrivacy
        store={store}
        onBack={() => setScreen("profile")}
        onResetData={() => {
          updateStore(() => emptyStore());
          setScreen("profile");
        }}
        onOpenPrivacyPolicy={() => setScreen("privacyPolicy")}
        onOpenTermsOfService={() => setScreen("termsOfService")}
        aiConsentOn={aiAllowed}
        onOpenAiConsent={() => { setAiConsentReturnTo("dataPrivacy"); setScreen("aiConsent"); }}
        onDeleteAccount={
          isCloudSyncConfigured && cloudUserId && !isDemoMode
            ? async () => {
                // Server-side delete first: if it fails, nothing local is
                // touched and the screen shows the error. Only once the
                // account is really gone is the local copy cleared too.
                // (updateRealStore may still try one push with the old
                // user id before onAuthStateChange clears it — that push is
                // rejected by the FK/RLS and only logged; see cloudSync.ts.)
                await cloudDeleteAccount();
                updateRealStore(() => emptyStore());
                setScreen("auth");
              }
            : undefined
        }
      />
    ); break;
    case "privacyPolicy": content = (
      <ScreenPrivacyPolicy onBack={() => setScreen("dataPrivacy")}
      />
    ); break;
    case "termsOfService": content = (
      <ScreenTermsOfService onBack={() => setScreen("dataPrivacy")}
      />
    ); break;
    case "help": content = <ScreenHelp onBack={() => setScreen("profile")} onReplayTutorial={() => { setTutorialStep(0); setTutorialActive(true); setScreen("home"); }} />; break;
    default: content = <ScreenHome onNavSelect={goToTab} onStartThink={startThink} onOpenVoyage={() => { setDriftReturnTo("home"); setScreen("drift"); }} onSetAspiration={() => { setAspirationReturnTo("home"); setScreen("aspirationSetup"); }} onOpenBrainMap={(region, beliefId) => { setBrainMapInitialRegion(region ?? null); setBrainMapInitialBeliefId(beliefId ?? null); setBrainMapReturnTo("home"); if (captureJarClip()) transitionOverride.current = "zoom"; setScreen("brainmap"); }} store={store} updateStore={updateStore} />;
  }
  content = <AiConsentContext.Provider value={aiAllowed}>{content}</AiConsentContext.Provider>;
  contentCache.current.set(screen, content);

  const isMobileViewport = useIsMobileViewport();
  const reduceMotion = useReducedMotion();
  // See screenTransitions.ts — every route change keeps one opaque layer on
  // screen, and the direction (deeper / back / tab) is read from a visit stack.
  const { kind: transitionKind, below: screenBelow } = useScreenTransitionKind(screen, transitionOverride);
  const transitionCustom: TransitionCustom = { kind: transitionKind, reduce: !!reduceMotion, clip: zoomClipRef.current ?? undefined };
  // Edge swipe-back + scroll memory (navGestures.ts). The swipe drives the
  // current screen's own inner layer by finger, then presses that screen's
  // real back button, so the regular "back" transition finishes the move.
  const swipeEnabled = canSwipeBack(screen) && !tutorialActive;
  // While a swipe is in progress, the screen it will return to is drawn
  // underneath (from its last rendered element) with iOS-style parallax and
  // a fading dim, instead of the bare frame showing through.
  const [peekOpen, setPeekOpen] = React.useState(false);
  React.useEffect(() => { setPeekOpen(false); }, [screen]);
  const { dragX, edgeHandlers } = useSwipeBack(screen, {
    enabled: swipeEnabled,
    onActiveChange: setPeekOpen,
    getLayer: () => contentHostRef.current?.querySelector(`[data-screen="${screen}"]`) ?? null,
    getWidth: () => contentHostRef.current?.clientWidth ?? 393,
  });
  const dragShadow = useTransform(dragX, [0, 80], ["0px 0px 0px rgba(0,0,0,0)", "-10px 0px 28px rgba(0,0,0,0.16)"]);
  const peekProgress = (v: number) => 1 - Math.min(1, v / (contentHostRef.current?.clientWidth || 393));
  const peekX = useTransform(dragX, (v) => `${-8 * peekProgress(v)}%`);
  const peekDim = useTransform(dragX, (v) => 0.12 * peekProgress(v));
  const peekContent = peekOpen && screenBelow ? contentCache.current.get(screenBelow) : undefined;
  useScrollMemory(contentHostRef, screen, transitionKind);
  // The fake "9:41 + battery" status bar is mockup chrome for the desktop
  // preview — a real phone already has its own real status bar, so showing
  // ours too would just be a second, wrong clock sitting under the actual
  // one. Safe-area padding (below) takes over its job of clearing the
  // notch on mobile instead.
  const showStatusBar = !["quote", "splash"].includes(screen) && !isMobileViewport;
  // Light frame fallback, notch strip and preview status-bar text for every
  // screen except the dark ones (see DARK_SCREENS above). It has to match
  // each screen's own background, or the notch padding shows a wrong-colored
  // strip and crossfades flash the wrong color.
  const isModernistScreen = !DARK_SCREENS.has(screen);

  // Think is the app's one self-disclosure moment — the disinhibition-theory
  // note this roadmap draws from asks for the whole frame to read as a
  // slightly more private space while it's open: a faint dimming (not just
  // ScreenThink's own already-dark background) plus a distinct threshold
  // motion on the way in and out, instead of the plain fade every other
  // screen uses.
  const isThink = screen === "think";

  return (
    <MotionConfig reducedMotion="user">
    <OpenFromContext.Provider value={openFromRow}>
    <div style={{ minHeight: "100dvh", backgroundColor: "#EDEAE4", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobileViewport ? 0 : 20 }}>
      <div
        ref={frameRef}
        className={isModernistScreen ? "theme-modernist" : undefined}
        style={{
          width: isMobileViewport ? "100%" : 393,
          height: isMobileViewport ? "100dvh" : 852,
          borderRadius: isMobileViewport ? 0 : 40,
          overflow: "hidden",
          boxShadow: isMobileViewport ? "none" : "0 20px 60px rgba(0,0,0,0.25)",
          backgroundColor: dkBg,
          display: "flex", flexDirection: "column", position: "relative",
          // Clears the real notch/Dynamic Island whenever the fake status
          // bar isn't the one doing that job (mobile, or the status-bar-
          // less splash screen) — a no-op (0px) anywhere without a real
          // safe area, so it's always safe to include. When the fake bar
          // IS doing that job (desktop preview), this stays the same fixed
          // value for every screen — switching it per screen (e.g. 0 for
          // Home, 30 elsewhere) made the whole frame visibly jump on every
          // screen change, since AnimatePresence crossfades the *content*
          // but this padding lives on the frame itself, outside that
          // animation, so it was snapping instantly. Home still runs its
          // photo edge-to-edge behind the transparent overlay — it just
          // does that itself now (a negative margin on its own hero, see
          // ScreenHome) instead of asking the shared frame to change shape
          // under it.
          paddingTop: showStatusBar ? 30 : "env(safe-area-inset-top)",
        }}
      >
        {/* Animated fallback behind every screen. Screen-specific photos and
        surfaces still paint themselves above this; this layer only prevents
        a hard mdBg/dkBg color snap from showing through during a crossfade. */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ backgroundColor: isModernistScreen ? mdBg : dkBg }}
          transition={{ duration: reduceMotion ? 0.01 : 0.18, ease: "easeOut" }}
          style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}
        />
        <div ref={contentHostRef} style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 1 }}>
          {peekContent && (
            <motion.div
              aria-hidden
              {...({ inert: "" } as any)}
              style={{ position: "absolute", inset: 0, zIndex: 0, display: "flex", flexDirection: "column", pointerEvents: "none", x: peekX }}
            >
              <React.Suspense fallback={null}>
                <PeekContext.Provider value={true}>{peekContent}</PeekContext.Provider>
              </React.Suspense>
              <motion.div style={{ position: "absolute", inset: 0, backgroundColor: "#000", opacity: peekDim }} />
            </motion.div>
          )}
          <AnimatePresence initial={false} custom={transitionCustom}>
            <motion.div
              key={screen}
              data-screen={screen}
              custom={transitionCustom}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}
            >
              <motion.div style={{ x: dragX, boxShadow: dragShadow, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
                <React.Suspense fallback={<div aria-busy="true" style={{ flex: 1, backgroundColor: isModernistScreen ? mdBg : dkBg }} />}>
                  {content}
                </React.Suspense>
              </motion.div>
            </motion.div>
          </AnimatePresence>
          {swipeEnabled && (
            <div aria-hidden {...edgeHandlers} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, zIndex: 5, touchAction: "none" }} />
          )}
        </div>

        {/* Genuinely transparent now — an absolute overlay drawn on top of
        the real screen content instead of a flex row that used to reserve
        its own strip of the frame's flat mdBg/dkBg fallback color behind
        it. That fallback color rarely matched whatever screen was actually
        showing (Home's photo especially), which is what read as a visibly
        cut-off band sitting on top of the screen. Non-interactive so it
        never blocks a tap at the very top of whatever's under it. */}
        {showStatusBar && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, pointerEvents: "none" }}>
            <StatusBar modernist={isModernistScreen} />
          </div>
        )}

        {/* Session dimming — a faint scrim over the whole frame (status bar
        included), not just ScreenThink's own dark background, so opening
        the session reads as the room's lights dropping a notch. ~12% black,
        within the note's 10-15% range. */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ opacity: isThink ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.24, ease: "easeOut" }}
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.12)", pointerEvents: "none", zIndex: 40 }}
        />

        {showPlusIntro && (
          <PlanIntroduction onDismiss={dismissPlusIntro} onViewPlans={() => { dismissPlusIntro(); goToTab("profile"); }} />
        )}
        {tutorialActive && TUTORIAL_STEPS[tutorialStep] && (
          <TutorialOverlay
            step={TUTORIAL_STEPS[tutorialStep]}
            stepIndex={tutorialStep}
            totalSteps={TUTORIAL_STEPS.length}
            frameRef={frameRef}
            screen={screen}
            onNext={advanceTutorial}
            onSkip={finishTutorial}
          />
        )}
      </div>
    </div>
    </OpenFromContext.Provider>
    </MotionConfig>
  );
}
