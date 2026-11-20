// ── Native phone features ────────────────────────────────────────────────────
// What the iOS app adds on top of the shared React code: haptic taps,
// real reminders (local notifications, which fire even when the app is
// closed), and speech-to-text through iOS's own recogniser. On the web
// every function here is a quiet no-op, so callers never branch.
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { SpeechRecognition } from "@capgo/capacitor-speech-recognition";

export const isNative = Capacitor.isNativePlatform();

// ── Haptics ──
export type HapticKind = "tap" | "press" | "success";
export function haptic(kind: HapticKind = "tap") {
  if (!isNative) return;
  const run = kind === "success"
    ? Haptics.notification({ type: NotificationType.Success })
    : Haptics.impact({ style: kind === "press" ? ImpactStyle.Medium : ImpactStyle.Light });
  run.catch(() => {});
}

// ── Reminders ──
const DAILY_ID = 1001;
const WEEKLY_ID = 1002;
let nextAlertId = 2000;

async function canNotify(): Promise<boolean> {
  const status = await LocalNotifications.checkPermissions();
  if (status.display === "granted") return true;
  if (status.display === "denied") return false;
  return (await LocalNotifications.requestPermissions()).display === "granted";
}

// Replaces whatever was scheduled with what the settings say now. The daily
// nudge repeats at the chosen time; the weekly one on Sunday evening.
export async function syncReminders(opts: { daily: boolean; time: string; weekly: boolean }) {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }, { id: WEEKLY_ID }] });
    if (!opts.daily && !opts.weekly) return;
    if (!(await canNotify())) return;
    const [hour, minute] = opts.time.split(":").map((n) => parseInt(n, 10));
    const notifications = [];
    if (opts.daily) {
      notifications.push({
        id: DAILY_ID, title: "There's a pattern in your thinking.", body: "Take a minute to write about today.",
        schedule: { on: { hour: Number.isFinite(hour) ? hour : 21, minute: Number.isFinite(minute) ? minute : 0 }, allowWhileIdle: true },
      });
    }
    if (opts.weekly) {
      notifications.push({
        id: WEEKLY_ID, title: "Your week in Mindscape", body: "See which thoughts came back most this week.",
        schedule: { on: { weekday: 1, hour: 19, minute: 0 }, allowWhileIdle: true },
      });
    }
    await LocalNotifications.schedule({ notifications });
  } catch { /* reminders are best-effort */ }
}

// A one-off alert right now (e.g. "a new pattern showed up").
export async function notifyNow(title: string, body: string) {
  if (!isNative) return;
  try {
    if (!(await canNotify())) return;
    await LocalNotifications.schedule({ notifications: [{ id: nextAlertId++, title, body, schedule: { at: new Date(Date.now() + 1000) } }] });
  } catch { /* best-effort */ }
}

// ── Speech to text ──
// One listening session through iOS's recogniser. `onText` gets the whole
// transcript so far each time it changes; iOS ends a session on its own
// after about a minute, so it's quietly restarted and the earlier text is
// kept in front of the new one.
export type NativeSpeechSession = { stop: () => Promise<string> };

export async function startNativeSpeech(handlers: {
  onText: (text: string) => void;
  onLevel?: (level: number) => void;
  onError: (message: string) => void;
}): Promise<NativeSpeechSession | null> {
  const perm = await SpeechRecognition.requestPermissions().catch(() => null);
  if (!perm || perm.speechRecognition !== "granted") {
    handlers.onError("Microphone or speech access is off. Turn it on in Settings → Mindscape, or tap \"Write instead.\"");
    return null;
  }
  let before = "";
  let current = "";
  let stopping = false;
  const listeners: PluginListenerHandle[] = [];
  const full = () => [before, current].filter(Boolean).join(" ").trim();
  const begin = () => SpeechRecognition.start({ language: "en-US", partialResults: true, addPunctuation: true, popup: false });

  listeners.push(await SpeechRecognition.addListener("partialResults", (e) => {
    current = e.matches?.[0] ?? current;
    handlers.onText(full());
  }));
  listeners.push(await SpeechRecognition.addListener("audioLevel", (e: any) => handlers.onLevel?.(Number(e?.level) || 0)));
  listeners.push(await SpeechRecognition.addListener("listeningState", (e: any) => {
    const stopped = e?.state === "stopped" || e?.status === "stopped";
    if (stopped && !stopping) {
      before = full();
      current = "";
      begin().catch(() => {});
    }
  }));
  listeners.push(await SpeechRecognition.addListener("error", (e: any) => {
    if (stopping) return;
    handlers.onError(e?.message ? `Voice input stopped: ${e.message}` : "Voice input stopped. Tap the button to try again, or use \"Write instead.\"");
  }));

  try {
    await begin();
  } catch (err: any) {
    listeners.forEach((l) => l.remove());
    handlers.onError(err?.message ? `Couldn't start voice input: ${err.message}` : "Couldn't start voice input.");
    return null;
  }

  return {
    stop: async () => {
      stopping = true;
      await SpeechRecognition.stop().catch(() => {});
      listeners.forEach((l) => l.remove());
      return full();
    },
  };
}
