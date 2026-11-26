import React from "react";
import { AiConsentContext, hasAiConsent } from "./aiConsent";
import { DEMO_WEEKLY_REFLECTIONS } from "../demo/demoWeeklyReflections";
import { apiUrl } from "./apiBase";
import { parseDotDate, shortMonthDay } from "./dateUtils";
import { accent, ivBody, ivBorder, ivHeading, ivSurfaceSolid } from "./screenTheme";
import { PrimaryBtn } from "./screenUI";
import { display, sans } from "./typefaces";
import { weeklyReflectionsEnabled, type MindscapePlan } from "./mindscapePlan";
import { supabase } from "./supabaseClient";
import type { Store } from "./types";
import { MAX_ASPIRATION_LENGTH, MAX_REFLECTION_ENTRY_LENGTH, mergeWeeklyReflections, reflectionSource, sanitizeWeeklyReflection, type Portrait, type WeeklyReflection } from "./weeklyReflection";

const SIGN_IN_MESSAGE = "Sign in with an account to try a weekly reflection.";
const FREE_USED_MESSAGE = "You’ve used your free reflection. Mindscape Plus adds a new reflection every week.";
// Errors whose message is written for the person, not a developer.
class ShownError extends Error {}

type Props = {
  store: Store;
  cloudUserId?: string | null;
  plan: MindscapePlan;
  updateStore: (updater: (previous: Store) => Store) => void;
  onOpenEntry?: (index: number) => void;
  onOpenAiConsent: () => void;
};

export function WeeklyReflectionPanel({ store, cloudUserId, plan, updateStore, onOpenEntry, onOpenAiConsent }: Props) {
  const aiAllowed = React.useContext(AiConsentContext);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  const request = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => request.current?.abort(), []);

  const checkingPlan = plan.checking;
  const plus = plan.active === "plus";
  const saved = plan.demo
    ? DEMO_WEEKLY_REFLECTIONS.slice(0, plus ? undefined : 1)
    : mergeWeeklyReflections(store.weeklyReflections, [store.weeklyReflection]);
  // Reflections need an account: the server counts the free one per
  // account, so a device-only guest can't create one.
  const signedIn = !!cloudUserId && !!supabase;
  const source = !plan.demo && weeklyReflectionsEnabled && signedIn && !checkingPlan && (plus || !saved.length)
    ? reflectionSource(store.history, new Date(), saved.map((reflection) => reflection.weekStart))
    : null;

  async function generate() {
    if (!source || request.current) return;
    if (!aiAllowed) {
      onOpenAiConsent();
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");
    const timeout = window.setTimeout(() => controller.abort("timeout"), 30000);
    try {
      const session = (await supabase?.auth.getSession())?.data.session;
      if (!session || session.user.id !== cloudUserId) throw new ShownError(SIGN_IN_MESSAGE);
      const response = await fetch(apiUrl("/api/weekly-reflection"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          entries: source.entries.map((entry) => entry.text.trim().slice(0, MAX_REFLECTION_ENTRY_LENGTH)),
          ...(store.aspiration?.trim() && store.aspiration.trim().length <= MAX_ASPIRATION_LENGTH ? { aspiration: store.aspiration.trim() } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const { code } = await response.json().catch(() => ({ code: undefined }));
        if (code === "sign_in_required") throw new ShownError(SIGN_IN_MESSAGE);
        if (code === "free_used") throw new ShownError(FREE_USED_MESSAGE);
        if (response.status === 403 && plus) throw new ShownError("Your Plus access couldn’t be verified.");
        throw new Error("Reflection request failed");
      }
      const { summary, evidence, portrait } = await response.json();
      const reflection = sanitizeWeeklyReflection({
        weekStart: source.weekStart,
        summary,
        portrait,
        entryIds: Array.isArray(evidence) ? evidence.map((index) => source.entries[index]?.id) : null,
      });
      if (!reflection) throw new Error("Invalid reflection");
      if (controller.signal.aborted) return;
      updateStore((previous) => {
        const existing = mergeWeeklyReflections(previous.weeklyReflections, [previous.weeklyReflection]);
        if (!hasAiConsent(previous) || existing.some(({ weekStart }) => weekStart === reflection.weekStart) ||
            (!plus && existing.length)) return previous;
        const ids = new Set(previous.history.map((entry) => entry.id));
        if (!reflection.entryIds.every((id) => ids.has(id))) return previous;
        return plus
          ? { ...previous, weeklyReflections: mergeWeeklyReflections(existing, [reflection]) }
          : { ...previous, weeklyReflection: reflection };
      });
    } catch (failure) {
      if (!controller.signal.aborted || controller.signal.reason === "timeout") {
        setError(failure instanceof ShownError ? failure.message : "Couldn’t create your reflection. Try again in a moment.");
      }
    } finally {
      window.clearTimeout(timeout);
      request.current = null;
      if (!controller.signal.aborted || controller.signal.reason === "timeout") setPending(false);
    }
  }

  function renderReflection(reflection: WeeklyReflection) {
    return (
      <details key={reflection.weekStart} style={{ borderTop: `1px solid ${ivBorder}`, padding: "10px 0", marginTop: 8 }}>
        <summary style={{ ...sans, fontSize: 13, fontWeight: 600, color: ivHeading, cursor: "pointer" }}>
          {formatWeek(reflection.weekStart)}
        </summary>
        <p style={{ ...sans, fontSize: 14, lineHeight: 1.55, color: ivBody, margin: "8px 0" }}>{reflection.summary}</p>
        {reflection.portrait && <PortraitPair portrait={reflection.portrait} />}
        {onOpenEntry && (
          <ul aria-label="Supporting entries" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {reflection.entryIds.map((id) => {
              const index = store.history.findIndex((entry) => entry.id === id);
              if (index < 0) return null;
              const entry = store.history[index];
              return (
                <li key={id}>
                  <button type="button" onClick={() => onOpenEntry(store.history.length - 1 - index)}
                    style={{ ...sans, color: accent, background: "none", border: 0, padding: "8px 0", minHeight: 44, textDecoration: "underline", textAlign: "left", cursor: "pointer" }}>
                    {shortMonthDay(entry.date)} · {entry.text.trim().slice(0, 36)}{entry.text.trim().length > 36 ? "…" : ""}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </details>
    );
  }

  const description = plan.demo
    ? (plus ? "Demo Mode · Two example weeks, each linked to its diary entries." : "Demo Mode · One example reflection. Switch to Plus in Profile to see the archive.")
    : checkingPlan ? "Checking your plan…"
    : !weeklyReflectionsEnabled ? "New reflections are currently unavailable."
    : !signedIn ? SIGN_IN_MESSAGE
    : source ? `Use short diary excerpts to find what repeats across ${formatWeek(source.weekStart)}.`
    : plus ? "Analyze two diary entries in a week to create that week’s reflection."
    : saved.length ? FREE_USED_MESSAGE
    : "Analyze two diary entries in the same week to try your free reflection.";

  return (
    <section aria-label="Weekly reflection" style={{ margin: "8px 0 16px", padding: "16px 18px", border: `1px solid ${ivBorder}`, borderLeft: `3px solid ${accent}`, borderRadius: 12, background: ivSurfaceSolid }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "2px 10px" }}>
        <h2 style={{ ...display, fontSize: 24, color: ivHeading, margin: 0 }}>Weekly reflection</h2>
        {!checkingPlan && <span style={{ ...sans, fontSize: 12, color: accent, fontWeight: 600 }}>{plus ? "Mindscape Plus" : "Free plan"}</span>}
      </div>
      <p style={{ ...sans, fontSize: 14, lineHeight: 1.55, color: ivBody, margin: "8px 0" }}>{description}</p>
      {source && (
        <PrimaryBtn ivory disabled={pending} onClick={generate}>
          {pending ? "Creating reflection…" : !aiAllowed ? "Enable AI analysis" : plus ? "Create weekly reflection" : "Create free reflection"}
        </PrimaryBtn>
      )}
      {error && <p role="alert" style={{ ...sans, fontSize: 13, color: ivBody, margin: "8px 0 0" }}>{error}</p>}
      {saved.map(renderReflection)}
    </section>
  );
}

function formatWeek(weekStart: string) {
  const start = parseDotDate(weekStart);
  if (!start) return weekStart;
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const dates = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${dates.format(start)} – ${dates.format(end)}`;
}

// Who you said you want to be, beside who this week showed: the distance
// in words, not just a number.
function PortraitPair({ portrait }: { portrait: Portrait }) {
  const column = (title: string, traits: string[], tint: string) => (
    <div style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 12, backgroundColor: `${tint}14`, boxShadow: `inset 0 0 0 1px ${tint}33` }}>
      <div style={{ ...sans, fontSize: 11, fontWeight: 600, letterSpacing: 0.3, color: ivBody, marginBottom: 6 }}>{title}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {traits.map((t) => <li key={t} style={{ ...sans, fontSize: 13, lineHeight: 1.4, color: ivHeading }}>{t}</li>)}
      </ul>
    </div>
  );
  return (
    <div role="group" aria-label="Who you said you want to be, and who this week showed" style={{ display: "flex", gap: 8, margin: "4px 0 10px" }}>
      {column("Who you said", portrait.said, "#E2A847")}
      {column("This week showed", portrait.showed, "#5B8FB9")}
    </div>
  );
}
