/** Home is the observatory; the working screens are its quieter adjoining rooms. */
export function eveningTone(screen: string): string {
  if (["quote", "splash", "auth", "login", "signup", "onboarding"].includes(screen)) return "arrival";
  if (["history", "historyDetail"].includes(screen)) return "journal";
  if (["analysis", "beliefs", "assumptions", "brainmap"].includes(screen)) return "mind";
  if (["discoveryAnalysis", "hypotheses", "hypothesisDetail", "investigate"].includes(screen)) return "analysis";
  if (["think", "processing", "thinkComplete", "sessionSummary"].includes(screen)) return "recording";
  if (["idealSelf", "drift", "aspirationSetup"].includes(screen)) return "aspiration";
  if (["paywall", "softPaywall", "checkout", "manageSubscription"].includes(screen)) return "membership";
  if (screen === "crisisSupport") return "support";
  return "account";
}
