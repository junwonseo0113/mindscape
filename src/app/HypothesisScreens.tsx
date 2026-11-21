import React from "react";
import { motion } from "motion/react";
import { Store, StoredBelief, StoredHistoryEntry, StoredHypothesis } from "./types";
import { display, mono, sans } from "./typefaces";
import { isLikelyRuminating } from "./analysisFramework";
import { mdBg, mdCard, mdCardShadow, mdHeading, mdBody, mdBodyLight, mdFaint, mdAccent, mdAccentText, mdAccentSoft, mdTrack, mdDivider, mdWarn, mdWarnSoft, mdWarnTag, mdWarnTagText } from "./screenTheme";
import { PrimaryBtn, BackButton, ConfidenceBar, ScreenPivot, AlignedRowCompare } from "./screenUI";
import { evidenceForHypothesis } from "./hypothesisEvidence";
import { beliefEmotionGranularity } from "./emotionGranularity";
import { NeuralBeliefGraph3D } from "./screenPeeking";
import { DiscoveryBeliefList } from "./HomeScreen";
import { ReactionButtons } from "./insightUI";

// ── Screen 11 · Active Hypotheses ─────────────────────────────────────────────
// Falls back to a generic reflective question when a hypothesis doesn't
// carry its own (real hypotheses don't yet) — same wording either way, so
// the detail screen never has to know why a question is showing.
const GENERIC_HYPOTHESIS_QUESTION = "Is this insight helping you right now, or holding you back?";

export function ScreenHypotheses({ onBack, onOpen, store }: { onBack?: () => void; onOpen?: (i: number) => void; store: Store }) {
  const items = store.hypotheses;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
        <div style={{ ...display, fontSize: 28, color: mdHeading, marginTop: 10 }}>AI's Hypotheses</div>
        <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 6, lineHeight: 1.5 }}>Not certain. Agree or push back to help refine it together.</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        {items.length === 0 ? (
          <div style={{ ...sans, fontSize: 13, color: mdBody, lineHeight: 1.7, wordBreak: "keep-all", padding: "12px 0" }}>
            Once enough thoughts build up, the AI's higher-level theories spanning multiple unconscious beliefs will show up here.
          </div>
        ) : (
          items.map((h, i) => (
            <motion.div
              key={h.id} role="button" tabIndex={0} onClick={() => onOpen?.(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (() => onOpen?.(i))?.(); } }} whileTap={{ scale: 0.99, opacity: 0.9 }}
              style={{ padding: "18px 0", borderBottom: i < items.length - 1 ? `1px solid ${mdDivider}` : "none", cursor: "pointer" }}
            >
              <div style={{ ...display, fontSize: 20, color: mdHeading, lineHeight: 1.5, wordBreak: "keep-all" }}>{h.title}</div>
              <div style={{ marginTop: 12 }}>
                <ConfidenceBar value={h.confidence} modernist />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {h.domains.map((d: string) => (
                  <span key={d} style={{ ...sans, fontSize: 11, color: mdBody, backgroundColor: mdTrack, padding: "3px 9px", borderRadius: 999 }}>{d}</span>
                ))}
              </div>
              {h.reaction && (
                <div style={{ ...sans, fontSize: 11, color: h.reaction === "agree" ? mdAccentText : mdWarn, marginTop: 8 }}>
                  {h.reaction === "agree" ? "Agreed" : "Said no"}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Screen 12 · Hypothesis detail ─────────────────────────────────────────────
// The full "Today's Discovery" experience for a hypothesis-sourced discovery —
// everything the old standalone "AI's Hypotheses" detail page showed, plus the
// related-neurons/contradictory-evidence/evolution sections. Extracted so
// it can render identically whether it's reached through the legacy
// ScreenHypothesisDetail wrapper (back button + this body) or embedded
// inline as Analysis's first section (no wrapper, no back button — it's
// already inside a tab).
function HypothesisDiscoveryBody({
  h,
  store,
  onAgree,
  onDisagree,
  reinterpreting,
  onInvestigate,
}: {
  h: StoredHypothesis;
  store: Store;
  onAgree?: () => void;
  onDisagree?: () => void;
  reinterpreting?: boolean;
  onInvestigate?: () => void;
}) {
  const reaction = h.reaction;
  const exhausted = !!h.exhausted;
  const settled = reaction === "agree" || exhausted;
  const question = h.question ?? GENERIC_HYPOTHESIS_QUESTION;
  const evidence = evidenceForHypothesis(h, store.beliefs);

  // The beliefs this hypothesis actually crosses — reused for both the
  // "related activated neurons" mini-brain and the contradictory-evidence
  // list below, so both sections stay honest to the same underlying data
  // instead of inventing a separate notion of "related."
  const relatedBeliefs = h.relatedBeliefIds
    .map((id) => store.beliefs.find((b) => b.id === id))
    .filter((b): b is StoredBelief => !!b)
    .map((belief) => ({
      ...belief,
      emotionGranularity: beliefEmotionGranularity(belief, store.history),
      ruminationLikely: isLikelyRuminating(belief, store.connections, store.history),
    }));
  const relatedBeliefIds = new Set(relatedBeliefs.map((b) => b.id));
  const relatedConnections = store.connections.filter((c) => relatedBeliefIds.has(c.a) && relatedBeliefIds.has(c.b));
  const contradictoryEntries = relatedBeliefs
    .flatMap((b) => (b.contradictoryEntryIds ?? []).map((id) => ({ belief: b, entry: store.history.find((e) => e.id === id) })))
    .filter((x): x is typeof x & { entry: StoredHistoryEntry } => !!x.entry);

  return (
    <div>
      <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em" }}>Today's Discovery</div>
      <div style={{ ...display, fontSize: 22, color: mdHeading, marginTop: 10, lineHeight: 1.5, wordBreak: "keep-all" }}>{h.title}</div>
      <div style={{ marginTop: 18 }}><ConfidenceBar value={h.confidence} modernist /></div>
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {h.domains.map((d: string) => (<span key={d} style={{ ...sans, fontSize: 11, color: mdBody, backgroundColor: mdTrack, padding: "3px 9px", borderRadius: 999 }}>{d}</span>))}
      </div>

      {evidence.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Conversations Behind This</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {evidence.map((e, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 12, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ ...mono, fontSize: 11, color: mdFaint }}>{e.date}</span>
                  {e.domain && <span style={{ ...sans, fontSize: 11, color: mdAccentText, backgroundColor: mdAccentSoft, padding: "2px 8px", borderRadius: 999 }}>{e.domain}</span>}
                </div>
                <div style={{ ...display, fontSize: 17, fontStyle: "italic", color: mdBodyLight, marginTop: 6, lineHeight: 1.55, wordBreak: "keep-all" }}>"{e.quote}"</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {relatedBeliefs.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Related Active Neurons</div>
          <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            These are the actual places in the brain where the unconscious beliefs behind this discovery are activated.
          </div>
          <div style={{ marginTop: 12 }}>
            <React.Suspense fallback={<div style={{ height: 200 }} />}>
              <NeuralBeliefGraph3D beliefs={relatedBeliefs} connections={relatedConnections} height={200} defaultStructureMode />
            </React.Suspense>
          </div>
          <DiscoveryBeliefList beliefIds={h.relatedBeliefIds} store={store} />
        </div>
      )}

      {contradictoryEntries.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>Conflicting Entries</div>
          <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            There are entries that pointed a different way from this conclusion — the confidence score reflects that.
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {contradictoryEntries.map(({ belief, entry }, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 12, backgroundColor: mdWarnSoft, borderLeft: `2px solid ${mdWarn}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ ...mono, fontSize: 11, color: mdFaint }}>{entry.date}</span>
                  <span style={{ ...sans, fontSize: 11, color: mdWarnTagText, backgroundColor: mdWarnTag, padding: "2px 8px", borderRadius: 999 }}>{belief.domain}</span>
                </div>
                <div style={{ ...display, fontSize: 17, fontStyle: "italic", color: mdBodyLight, marginTop: 6, lineHeight: 1.55, wordBreak: "keep-all" }}>"{entry.text}"</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {h.investigate && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em" }}>How This Belief Has Changed</div>
          <div style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>
            {h.investigate.originNote}
          </div>
          <div style={{ marginTop: 14 }}>
            <AlignedRowCompare
              rows={[
                { label: h.investigate.compareLabel1, steps: h.investigate.compareSteps1 },
                { label: h.investigate.compareLabel2, steps: h.investigate.compareSteps2, accent: true },
              ]}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: mdAccentSoft, borderLeft: `2px solid ${mdAccent}` }}>
        <div style={{ ...display, fontSize: 17, fontStyle: "italic", color: mdHeading, lineHeight: 1.65, wordBreak: "keep-all" }}>{question}</div>
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={{ ...sans, fontSize: 12, fontWeight: 600, color: mdBody, letterSpacing: "0.06em", marginBottom: 12 }}>What do you think of this hypothesis?</div>
        {!settled && (
          <>
            <ReactionButtons
              reaction={reaction}
              onReact={(r) => (r === "agree" ? onAgree?.() : onDisagree?.())}
              disabled={reinterpreting}
              dark
            />
            {reinterpreting && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 12, textAlign: "center" }}>
                Looking for another interpretation…
              </motion.div>
            )}
          </>
        )}
        {settled && exhausted && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ ...sans, fontSize: 12, color: mdBody, marginTop: 12, lineHeight: 1.5, wordBreak: "keep-all", textAlign: "center" }}>
            There doesn't seem to be another way to read the same evidence. We'll take another look once new entries come in.
          </motion.div>
        )}
        {settled && !exhausted && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: mdAccent, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, lineHeight: 1 }}>✓</span>
            <span style={{ ...sans, fontSize: 12, color: mdBody }}>Logged. This hypothesis's confidence goes up a bit.</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Legacy standalone route (reached only via the still-intact ScreenHypotheses
// list, no longer linked from Home) — same body, just wrapped with its own
// back button and page chrome.
export function ScreenHypothesisDetail({
  index,
  onBack,
  onInvestigate,
  onAgree,
  onDisagree,
  reinterpreting,
  store,
}: {
  index: number;
  onBack?: () => void;
  onInvestigate?: () => void;
  onAgree?: () => void;
  onDisagree?: () => void;
  reinterpreting?: boolean;
  store: Store;
}) {
  const h = store.hypotheses[index] ?? store.hypotheses[0];
  if (!h) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
      <div style={{ padding: "16px 22px 12px", flexShrink: 0 }}>
        <BackButton onClick={onBack} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 22px 24px" }}>
        <HypothesisDiscoveryBody h={h} store={store} onAgree={onAgree} onDisagree={onDisagree} reinterpreting={reinterpreting} onInvestigate={onInvestigate} />
      </div>
    </div>
  );
}

// ── Screen 12.5 · Investigate (deep dive into one hypothesis) ────────────────
// A short guided walk through the evidence trail: where the pattern first
// appeared, what changed between then and now, and how it connects to other
// patterns already surfaced — closing on the same reflective question grammar
// as the hypothesis card itself, not a new one. Takes the investigation
// content directly (rather than looking a hypothesis up itself) since the
// caller already knows exactly which one is open.
export function ScreenInvestigate({ investigate, onBack }: { investigate: NonNullable<StoredHypothesis["investigate"]>; onBack?: () => void }) {
  const inv = investigate;
  const [step, setStep] = React.useState(0);
  const steps = 4;

  let body: React.ReactNode;
  if (step === 0) {
    body = (
      <ScreenPivot
        kicker="Dig deeper"
        statement={<>Let's find out<br />where this pattern<br />first started.</>}
        cta={<PrimaryBtn onClick={() => setStep(1)} modernist>Start</PrimaryBtn>}
      />
    );
  } else if (step === 1) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "52px 22px 90px" }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em" }}>The First Time This Showed Up</div>
          <div style={{ marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: mdCard, boxShadow: mdCardShadow }}>
            <div style={{ ...mono, fontSize: 11, color: mdFaint }}>{inv.origin.date}</div>
            <div style={{ ...display, fontSize: 20, fontStyle: "italic", color: mdBodyLight, marginTop: 8, lineHeight: 1.6, wordBreak: "keep-all" }}>"{inv.origin.quote}"</div>
          </div>
          <div style={{ ...sans, fontSize: 13, color: mdBody, marginTop: 18, lineHeight: 1.75, wordBreak: "keep-all" }}>{inv.originNote}</div>
        </div>
      </div>
    );
  } else if (step === 2) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: mdBg }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "52px 22px 90px" }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 600, color: mdAccentText, letterSpacing: "0.04em" }}>Then and Now, Side by Side</div>
          <div style={{ marginTop: 18 }}>
            <AlignedRowCompare
              rows={[
                { label: inv.compareLabel1, steps: inv.compareSteps1 },
                { label: inv.compareLabel2, steps: inv.compareSteps2, accent: true },
              ]}
            />
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <ScreenPivot
        kicker="Connection to another pattern"
        statement={inv.related}
        cta={<PrimaryBtn onClick={onBack} modernist>Back to the hypothesis</PrimaryBtn>}
      />
    );
  }

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px 0", zIndex: 2 }}>
        <BackButton onClick={step === 0 ? onBack : () => setStep(step - 1)} />
        <span style={{ ...mono, fontSize: 11, color: mdFaint }}>{step + 1} / {steps}</span>
      </div>
      <div style={{ height: "100%" }}>{body}</div>
      {step > 0 && step < steps - 1 && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 22px max(24px, calc(12px + env(safe-area-inset-bottom)))" }}>
          <PrimaryBtn onClick={() => setStep(step + 1)} modernist>Next</PrimaryBtn>
        </div>
      )}
    </div>
  );
}
