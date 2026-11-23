import React from "react";
import { weeklyReflectionsEnabled, type MindscapePlan, type Plan } from "./mindscapePlan";
import { accent, ivBody, ivBorder, ivHeading, ivSurfaceSolid } from "./screenTheme";
import { GhostBtn, PrimaryBtn } from "./screenUI";
import { display, sans } from "./typefaces";

const plans: { id: Plan; name: string; detail: string }[] = [
  { id: "free", name: "Free", detail: "Your diary, search and export, plus one AI weekly reflection to try with an account." },
  { id: "plus", name: "Mindscape Plus", detail: "Create a new AI reflection each week and revisit past reflections with links to the entries behind them." },
];

export function PlanSection({ plan, onOpenDiary }: { plan: MindscapePlan; onOpenDiary?: () => void }) {
  return (
    <section aria-label="Mindscape plans" style={{ background: ivSurfaceSolid, border: `1px solid ${ivBorder}`, borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
      <h2 style={{ ...display, fontSize: 25, fontWeight: 400, color: ivHeading, margin: 0 }}>Your plan</h2>
      {plans.map(({ id, name, detail }) => {
        const active = plan.active === id;
        return (
          <div key={id} style={{ borderTop: `1px solid ${ivBorder}`, padding: "12px 0 4px", marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", ...sans }}>
              <strong style={{ color: ivHeading, fontSize: 14 }}>{name}</strong>
              {!plan.checking && active && <span style={{ color: accent, fontSize: 12 }}>Current mode</span>}
            </div>
            <p style={{ ...sans, fontSize: 13, color: ivBody, lineHeight: 1.5, margin: "4px 0 8px" }}>{detail}</p>
            {!active && plan.canUsePlus && (
              <GhostBtn ivory onClick={() => plan.select(id)}>Use {id === "plus" ? "Plus" : "Free"}</GhostBtn>
            )}
          </div>
        );
      })}
      <p role="status" style={{ ...sans, fontSize: 12, color: ivBody, margin: "6px 0 10px" }}>
        {plan.demo ? "Demo Mode uses example entries. Try both plans here." : plan.checking ? "Checking your plan…" : !plan.canUsePlus ? "Plus is currently available to invited accounts." : "Switching modes keeps your saved reflections."}
      </p>
      {(plan.demo || weeklyReflectionsEnabled) && onOpenDiary && <PrimaryBtn ivory onClick={onOpenDiary}>Open Diary</PrimaryBtn>}
    </section>
  );
}

export function PlanIntroduction({ onDismiss, onViewPlans }: { onDismiss: () => void; onViewPlans: () => void }) {
  const dialog = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === "function") {
      element.showModal();
      return () => element.close();
    }
    element.setAttribute("open", "");
    return () => element.removeAttribute("open");
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby="plus-intro-title" aria-describedby="plus-intro-description"
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
      style={{ width: "min(calc(100% - 36px), 340px)", boxSizing: "border-box", background: ivSurfaceSolid, color: ivHeading, padding: 22, border: `1px solid ${ivBorder}`, borderRadius: 18 }}>
      <h2 id="plus-intro-title" style={{ ...display, fontSize: 28, fontWeight: 400, margin: 0 }}>Meet Mindscape Plus</h2>
      <p id="plus-intro-description" style={{ ...sans, fontSize: 14, color: ivBody, lineHeight: 1.6, margin: "8px 0 16px" }}>
        A weekly reflection connects entries and points you back to the moments behind it. Free includes one reflection to try with an account. Plus adds a new reflection each week.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <PrimaryBtn ivory onClick={onViewPlans}>View plans</PrimaryBtn>
        <GhostBtn ivory onClick={onDismiss}>Continue</GhostBtn>
      </div>
    </dialog>
  );
}
