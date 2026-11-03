import { useEffect, useRef } from 'react';

/** Slow compositor-only drift; pause work while the app's tab is hidden. */
export default function EveningAtmosphere() {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      if (layer.current) layer.current.style.animationPlayState = document.hidden ? 'paused' : 'running';
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return <div ref={layer} className="evening-atmosphere-motion" aria-hidden="true"/>;
}
