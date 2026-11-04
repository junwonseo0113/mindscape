import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import type { Store, StoredBelief } from './types';
import './unconscious-patterns.css';

type View = 'Beliefs' | 'Interpretations' | 'Connections';
const views: View[] = ['Beliefs', 'Interpretations', 'Connections'];
type Props = {
  store: Store;
  onBack?: () => void;
  renderBelief: (belief: StoredBelief, returnToOverview: () => void) => React.ReactNode;
  renderInterpretations: () => React.ReactNode;
  renderConnections: (openBelief: (id: string) => void) => React.ReactNode;
  about: React.ReactNode;
};

/** Presentation state stays local; no changes to analysis or persistence. */
export default function UnconsciousPatterns({ store, onBack, renderBelief, renderInterpretations, renderConnections, about }: Props) {
  const [view, setView] = useState<View>('Beliefs');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const aboutButton = useRef<HTMLButtonElement>(null);
  const tabs = useRef(new Map<View, HTMLButtonElement>());
  const positions = useRef<Record<View, number>>({ Beliefs: 0, Interpretations: 0, Connections: 0 });
  const returnFocus = useRef<string | null>(null);
  const restorePending = useRef(false);
  const id = useId();
  const visibleBeliefs = store.beliefs.filter(belief => belief.userReaction !== 'rejected');
  const selected = visibleBeliefs.find(belief => belief.id === selectedId);

  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = selected || aboutOpen ? 0 : positions.current[view];
    if (selected || aboutOpen) heading.current?.focus({ preventScroll: true });
    else if (restorePending.current) {
      const target = returnFocus.current ? scroller.current?.querySelector<HTMLButtonElement>(`[data-open-belief="${CSS.escape(returnFocus.current)}"]`) : null;
      (returnFocus.current === 'about' ? aboutButton.current : target ?? tabs.current.get(view))?.focus({ preventScroll: true });
      restorePending.current = false;
    }
  }, [view, selectedId, !!selected, aboutOpen]);

  function openBelief(beliefId: string) {
    positions.current[view] = scroller.current?.scrollTop ?? 0;
    returnFocus.current = beliefId;
    setSelectedId(beliefId);
  }
  function returnToOverview() {
    restorePending.current = true;
    setSelectedId(null);
    setAboutOpen(false);
  }
  function openAbout() {
    positions.current[view] = scroller.current?.scrollTop ?? 0;
    returnFocus.current = 'about';
    setAboutOpen(true);
  }
  function changeView(next: View) {
    positions.current[view] = scroller.current?.scrollTop ?? 0;
    setView(next);
  }

  return <section className="patterns-screen" aria-label={aboutOpen ? 'About this analysis' : 'Unconscious Patterns'} data-pattern-view={aboutOpen ? 'about' : selected ? 'detail' : view}>
    <header className="patterns-header">
      <div className="patterns-topline">
        <button type="button" className="patterns-back" onClick={selected || aboutOpen ? returnToOverview : onBack}>
          ← {selected || aboutOpen ? `Back to ${view}` : 'Back to Mind'}
        </button>
        {!selected && !aboutOpen && <button ref={aboutButton} type="button" className="patterns-about-toggle" onClick={openAbout}>About this analysis</button>}
      </div>
      <h1 ref={heading} tabIndex={-1}>{aboutOpen ? 'About this analysis' : selected ? 'Belief details' : 'Unconscious Patterns'}</h1>
      {!selected && !aboutOpen && <p className="patterns-intro">{store.beliefs.length > 0 ? 'Things that keep showing up in your actual words and actions, without you consciously realizing it.' : 'No patterns discovered yet. Log your first thought with "Speak your mind" — we\'ll start finding patterns from there.'}</p>}
      {!selected && !aboutOpen && <div className="patterns-tabs" role="tablist" aria-label="Pattern views">
        {views.map((item, index) => <button type="button" key={item} role="tab" id={`${id}-${item}`} aria-selected={view === item} aria-controls={`${id}-panel-${item}`} tabIndex={view === item ? 0 : -1} ref={button => { if (button) tabs.current.set(item, button); }} onClick={() => changeView(item)} onKeyDown={event => {
          let next: View | undefined;
          if (event.key === 'ArrowRight') next = views[(index + 1) % views.length];
          if (event.key === 'ArrowLeft') next = views[(index + views.length - 1) % views.length];
          if (event.key === 'Home') next = views[0];
          if (event.key === 'End') next = views[views.length - 1];
          if (next) { event.preventDefault(); changeView(next); tabs.current.get(next)?.focus(); }
        }}>{item}</button>)}
      </div>}
    </header>
    <div className="patterns-scroll" ref={scroller} onScroll={() => { if (!selected && !aboutOpen && scroller.current) positions.current[view] = scroller.current.scrollTop; }}>
      {aboutOpen ? <section className="patterns-about" aria-label="About this analysis">{about}</section> : selected ? renderBelief(selected, returnToOverview) : <div role="tabpanel" id={`${id}-panel-${view}`} aria-labelledby={`${id}-${view}`} tabIndex={0}>
        {view === 'Beliefs' && <>
          <h2 className="patterns-section-title">Core Unconscious Beliefs</h2>
          {visibleBeliefs.length === 0 ? <p className="patterns-empty">No unconscious beliefs discovered yet.</p> : <div className="patterns-summaries">
            {visibleBeliefs.map(belief => <button type="button" className="patterns-summary" key={belief.id} data-open-belief={belief.id} onClick={() => openBelief(belief.id)}>
              <span className="patterns-domain">{belief.domain}</span>
              <span className="patterns-statement">{belief.statement}</span>
              <span className="patterns-summary-bottom"><span>{belief.evidenceCount} pieces of evidence</span><span className="patterns-open-label">View belief →</span></span>
              {belief.status === 'supported' && <span className="patterns-status">Confirmed repeatedly</span>}
              {belief.status === 'conflicted' && <span className="patterns-status">Conflicting entries exist</span>}
            </button>)}
          </div>}
        </>}
        {view === 'Interpretations' && renderInterpretations()}
        {view === 'Connections' && renderConnections(openBelief)}
      </div>}
    </div>
  </section>;
}
