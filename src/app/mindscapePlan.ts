import React from "react";
import { supabase } from "./supabaseClient";

export type Plan = "free" | "plus";
export const weeklyReflectionsEnabled = import.meta.env.VITE_WEEKLY_REFLECTION_PREVIEW === "true";
export const PLUS_INTRO_KEY = "mijeong.hasSeenPlusIntro";

export function readPlanPreference(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function savePlanPreference(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Storage may be unavailable. */ }
}

export function useMindscapePlan(userId: string | null, demo: boolean) {
  const [demoPlan, setDemoPlan] = React.useState<Plan>("plus");
  const [access, setAccess] = React.useState<{ userId: string; plus: boolean } | null>(null);
  const [preference, setPreference] = React.useState<{ userId: string; plan: Plan } | null>(null);
  const preferenceKey = userId ? `mijeong.planMode.${userId}` : null;

  React.useEffect(() => {
    if (demo || !userId || !supabase) return;
    let current = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (current) {
        setAccess({ userId, plus: data.user?.id === userId && data.user.app_metadata.mindscape_plan === "plus" });
      }
    }).catch(() => {
      if (current) setAccess({ userId, plus: false });
    });
    return () => { current = false; };
  }, [userId, demo]);

  const checking = !demo && !!userId && access?.userId !== userId;
  const hasPlusAccess = !!userId && access?.userId === userId && access.plus;
  const canUsePlus = demo || hasPlusAccess;
  const selection = preference?.userId === userId ? preference?.plan : preferenceKey && readPlanPreference(preferenceKey);
  const active: Plan = demo ? demoPlan : hasPlusAccess && selection !== "free" ? "plus" : "free";

  function select(plan: Plan) {
    if (demo) { setDemoPlan(plan); return; }
    if (!userId || !preferenceKey || !canUsePlus) return;
    setPreference({ userId, plan });
    savePlanPreference(preferenceKey, plan);
  }

  return { active, canUsePlus, checking, demo, select };
}

export type MindscapePlan = ReturnType<typeof useMindscapePlan>;
