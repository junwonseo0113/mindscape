// ── Navigation gestures: edge swipe-back + scroll memory ─────────────────────
// Both build on screenTransitions.ts: the "back" transition already slides
// the top screen off to the right, so a swipe just drives that same motion
// by finger first, then hands off to it.
import * as React from "react";
import { animate, motionValue, type MotionValue } from "motion/react";
import type { TransitionKind } from "./screenTransitions";

// Every screen's own back control, whatever it's labelled. Pressing it (not
// guessing a destination) keeps each screen's real back logic — return-to
// state, unsaved-draft handling — exactly as if it had been tapped.
const BACK_SELECTOR = '[aria-label="Go back"], [aria-label^="Back"]';

export function findBackButton(layer: Element | null): HTMLElement | null {
  return (layer?.querySelector(BACK_SELECTOR) as HTMLElement | null) ?? null;
}

// Decides whether a released swipe goes back or springs home.
//   offset   px dragged to the right (≥ 0)
//   velocity px/s at release (positive = still moving right)
//   width    px width of the screen
// iOS commits past roughly half the width, or on a quick flick even when
// short. A lower distance threshold feels easier but makes accidental backs
// more likely while scrolling near the edge.
export function shouldCommitBack(offset: number, velocity: number, width: number): boolean {
  if (velocity < -200) return false; // flicked back toward the edge: cancel
  return offset > width * 0.4 || (velocity > 600 && offset > 24);
}

type SwipeBackOptions = {
  enabled: boolean;
  // true once a drag is recognised, false after a cancelled swipe has
  // sprung home — App uses it to mount the "screen underneath" peek.
  onActiveChange?: (active: boolean) => void;
  getLayer: () => Element | null;
  getWidth: () => number;
};

export function useSwipeBack(screen: string, { enabled, getLayer, getWidth, onActiveChange }: SwipeBackOptions) {
  // A fresh value per screen, so the screen leaving keeps its dragged offset
  // while the arriving one starts at 0 (see the comment in App).
  const dragX: MotionValue<number> = React.useMemo(() => motionValue(0), [screen]);
  const g = React.useRef<{ id: number; x0: number; y0: number; active: boolean; canDrag: boolean; samples: [number, number][] } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    // Always track the pointer, even when there's nowhere to go back to, so
    // a tap on the strip is still passed through to what's underneath.
    const canDrag = enabled && !!findBackButton(getLayer());
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, canDrag, samples: [] };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.active) {
      // Mostly vertical → it's a scroll that happened to start at the edge.
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g.current = null; return; }
      if (dx > 8 && s.canDrag) { s.active = true; onActiveChange?.(true); } else return;
    }
    const x = Math.max(0, dx);
    dragX.set(x);
    const now = performance.now();
    s.samples.push([now, x]);
    while (s.samples.length > 2 && now - s.samples[0][0] > 100) s.samples.shift();
  };

  const finish = (e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    g.current = null;
    if (!s.active) {
      // A plain tap on the edge strip: pass it to whatever is underneath
      // (very often the back button itself, which sits near this edge).
      if (!cancelled) {
        const under = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el !== e.currentTarget) as HTMLElement | undefined;
        under?.click();
      }
      return;
    }
    const x = dragX.get();
    const [t0, x0] = s.samples[0] ?? [performance.now(), x];
    const dt = Math.max(1, performance.now() - t0);
    const velocity = ((x - x0) / dt) * 1000;
    const back = findBackButton(getLayer());
    if (!cancelled && back && shouldCommitBack(x, velocity, getWidth())) back.click();
    else animate(dragX, 0, { type: "spring", stiffness: 420, damping: 40 }).then(() => onActiveChange?.(false));
  };

  return {
    dragX,
    edgeHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => finish(e, false),
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => finish(e, true),
    },
  };
}

// ── Scroll memory ─────────────────────────────────────────────────────────────
// Each screen remounts when you return to it, so its lists used to start at
// the top again. Scroll positions are recorded per screen, keyed by the
// scrolled element's child-index path under that screen's root, and put
// back when the screen is returned to (back or tab), never on a fresh visit.
function pathFrom(root: Element, el: Element): string | null {
  const path: number[] = [];
  let cur: Element | null = el;
  while (cur && cur !== root) {
    const parent: Element | null = cur.parentElement;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.children, cur));
    cur = parent;
  }
  return cur === root ? path.join(".") : null;
}

function resolvePath(root: Element, key: string): Element | null {
  let cur: Element | null = root;
  for (const i of key === "" ? [] : key.split(".").map(Number)) cur = cur?.children[i] ?? null;
  return cur;
}

export function useScrollMemory(
  host: React.RefObject<HTMLElement>,
  screen: string,
  kind: TransitionKind,
) {
  const saved = React.useRef(new Map<string, Map<string, number>>());

  React.useEffect(() => {
    const el = host.current;
    if (!el) return;
    const onScroll = (e: Event) => {
      const target = e.target as Element;
      const layer = target.closest?.("[data-screen]");
      if (!layer) return;
      const name = (layer as HTMLElement).dataset.screen!;
      const key = pathFrom(layer, target);
      if (key == null) return;
      let m = saved.current.get(name);
      if (!m) saved.current.set(name, (m = new Map()));
      m.set(key, (target as HTMLElement).scrollTop);
    };
    el.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => el.removeEventListener("scroll", onScroll, { capture: true });
  }, [host]);

  React.useLayoutEffect(() => {
    if (kind !== "back" && kind !== "tab") {
      saved.current.delete(screen); // fresh visit starts at the top
      return;
    }
    const m = saved.current.get(screen);
    const layer = host.current?.querySelector(`[data-screen="${screen}"]`);
    if (!m || !layer) return;
    const restore = () => m.forEach((top, key) => {
      const el = resolvePath(layer, key) as HTMLElement | null;
      if (el && el.scrollTop !== top) el.scrollTop = top;
    });
    restore();
    // Content that sizes itself after first paint (images, measured lists)
    // can clamp the first attempt — try once more on the next frame.
    const id = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(id);
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps
}
