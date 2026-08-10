// ── Single data provider ─────────────────────────────────────────────────────
// The one place that decides "demo or real" — every screen just receives a
// `store: Store` and an `updateStore` function from the app shell and has no
// idea which source it's looking at. Flip isDemoMode (via the toggle in
// Profile, or by clearing the localStorage key below) and the entire app
// switches between curated demo content and a real, on-device, initially-
// empty user store without a single screen's code changing.
import React from "react";
import type { Store } from "./types";
import { loadStore, saveStore } from "./realStore";
import { DEMO_STORE } from "../demo/demoData";

const DEMO_MODE_KEY = "mijeong.isDemoMode";
// Defaults to Demo Mode: this app has no real backend/auth distinguishing
// "a designer reviewing the UI" from "a real user," so the safer default is
// the one that doesn't silently show a stranger's-eye-view empty app to
// whoever opens it during development. Toggle off in Profile to see the
// real first-time experience.
const DEFAULT_IS_DEMO_MODE = true;

function loadIsDemoMode(): boolean {
  try {
    const raw = localStorage.getItem(DEMO_MODE_KEY);
    if (raw === null) return DEFAULT_IS_DEMO_MODE;
    return raw === "1";
  } catch {
    return DEFAULT_IS_DEMO_MODE;
  }
}

function saveIsDemoMode(value: boolean) {
  try {
    localStorage.setItem(DEMO_MODE_KEY, value ? "1" : "0");
  } catch {
    // private-mode / storage-full — non-fatal, just won't persist the toggle
  }
}

// First-time feature tour (생각 말하기/브레인/마인드/기록/프로필) — shown once,
// right after onboarding, then never again unless explicitly replayed from
// 도움말. Separate from onboarding's own "who do you want to be" identity
// question; this one's just "here's what each tab does."
const TUTORIAL_SEEN_KEY = "mijeong.hasSeenTutorial";

function loadHasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function saveHasSeenTutorial(value: boolean) {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, value ? "1" : "0");
  } catch {
    // private-mode / storage-full — non-fatal, just won't persist
  }
}

export function useAppData() {
  const [isDemoMode, setIsDemoModeState] = React.useState(loadIsDemoMode);
  const [hasSeenTutorial, setHasSeenTutorialState] = React.useState(loadHasSeenTutorial);
  const [realStore, setRealStore] = React.useState<Store>(loadStore);
  // Demo reactions (agreeing with a hypothesis, etc.) are intentionally
  // ephemeral — same as the old local-state-only demo behavior, they reset
  // on reload instead of persisting, since DEMO_STORE is example content,
  // not anyone's real data.
  const [demoStore, setDemoStore] = React.useState<Store>(DEMO_STORE);

  const setIsDemoMode = (value: boolean) => {
    setIsDemoModeState(value);
    saveIsDemoMode(value);
  };

  // Replayable (from 도움말), so this takes an explicit value rather than
  // only ever being settable to true.
  const setHasSeenTutorial = (value: boolean) => {
    setHasSeenTutorialState(value);
    saveHasSeenTutorial(value);
  };

  const store = isDemoMode ? demoStore : realStore;

  // Always targets real, on-device storage regardless of the current mode
  // — used only for the pre-home account/onboarding flow (signup, login
  // routing, the aspiration asked during onboarding), since creating your
  // actual account is a real action even if you happen to have Demo Mode
  // switched on for browsing. Every other mutation goes through the
  // mode-aware updateStore below.
  const updateRealStore = (updater: (prev: Store) => Store) => {
    setRealStore((prev) => {
      const next = updater(prev);
      saveStore(next);
      return next;
    });
  };

  const updateStore = (updater: (prev: Store) => Store) => {
    if (isDemoMode) {
      setDemoStore((prev) => updater(prev));
    } else {
      updateRealStore(updater);
    }
  };

  return { isDemoMode, setIsDemoMode, hasSeenTutorial, setHasSeenTutorial, store, updateStore, realStore, updateRealStore };
}
